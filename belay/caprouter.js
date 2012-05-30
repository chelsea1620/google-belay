// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var ROUTER_EXPORTS = (function() {
  'use strict';

  // TODO(mzero): should be more robust in face of localStorage randomness
  // i.e.: there could be things in localStorage that are of the wrong format
  // so there should be try/catch blocks around those things that might throw

  var RESPONSE_TIMEOUT = 1000;  // timeout invocations in 1sec

  var EXPIRY_DELAY = 15 * 1000;  // pause before doing expires check at start up
  var EXPIRY_TIMEOUT = 60 * 1000;  // expire anything 1min. old

  var LIVENESS_UPDATE = 250;
  var LIVENESS_DEFAULT_MAXAGE = LIVENESS_UPDATE * 4;

  var freeze = ('freeze' in Object) ? Object.freeze : function(x) { return x; };
  var now = ('now' in Date) ? Date.now : function() { return +(new Date); };

  var decodeInstanceId = function(ser) {
    var m = ser.match(/^urn:x-cap:([-0-9a-f]{32,36}):([-0-9a-f]{36})$/);
    return m ? m[1] : null;
  };

  var theLocalStorageMedium = null;

  var LocalStorageMedium = function() {
    var me = this;

    this.handlers = { };

    setTimeout(function() { me.expireMessages(EXPIRY_TIMEOUT); }, EXPIRY_DELAY);

    theLocalStorageMedium = this;
    this.storageEventListener = function(e) { me.handleStorageEvent(e); };
    window.addEventListener('storage', this.storageEventListener, false);

    this.timer = setInterval(
      function() { me.updateRoutables(); }, LIVENESS_UPDATE);
  };

  LocalStorageMedium.prototype.close = function() {
    clearInterval(this.timer);
    window.removeEventListener('storage', this.storageEventListener);
    theLocalStorageMedium = null;
  };

  function getLocalStorageMedium() {
    if (theLocalStorageMedium === null) {
      theLocalStorageMedium = new LocalStorageMedium();
    }
    return theLocalStorageMedium;
  }

  LocalStorageMedium.prototype.key = function(op, id, tx) {
    // keys are of the format: lsm,<op>,<id>,<tx>
    // values are the JSON.stringify of { t: <timestamp>, m: <msg> }
    return ['lsm', op, id, tx].join(',');
  }

  LocalStorageMedium.prototype.postMessage = function(op, id, tx, msg) {
    if (id in this.handlers) {
      var h = this.handlers[id];
      h(op, id, tx, msg);
    }
    else {
      var key = this.key(op, id, tx);
      var data = JSON.stringify({ t: now(), m: msg });
      localStorage.setItem(key, data);
    }
  };

  LocalStorageMedium.prototype.addMessageHandler = function(id, h) {
    this.handlers[id] = h;
    this.updateRoutables();
  };

  LocalStorageMedium.prototype.handleStorageEvent = function(e) {
    if (e.newValue === null) return;

    var parts = e.key.split(',');
    try {
      if (parts && parts[0] == 'lsm') {
        var op = parts[1];
        var id = parts[2];
        var tx = parts[3];

        if (id in this.handlers) {
          localStorage.removeItem(e.key);

          var payload = JSON.parse(e.newValue);

          var h = this.handlers[id];
          (h)(op, id, tx, payload.m);
        }
      }
    } catch (e) { }
  };

  LocalStorageMedium.prototype.saveMessage = function(op, id, msg) {
    this.postMessage(op, id, 0, msg);
  };

  LocalStorageMedium.prototype.retrieveMessage = function(op, id) {
    var key = this.key(op, id, 0);
    var payload = localStorage.getItem(key);
    try {
      var msg = JSON.parse(payload).m;
      localStorage.removeItem(key);
      return msg;
    } catch (e) { }
    return null;
  };

  LocalStorageMedium.prototype.updateRoutables = function() {
    var payload = JSON.stringify({ t: now() });
    for (var id in this.handlers) {
      var key = this.key('live', 0, id);
      localStorage.setItem(key, payload);
    }
  };

  LocalStorageMedium.prototype.isRoutable = function(id, maxAge) {
    if (id in this.handlers) { return true; }
    if (maxAge === undefined) { maxAge = LIVENESS_DEFAULT_MAXAGE; }
    var key = this.key('live', 0, id);
    var payload = localStorage.getItem(key);
    try {
      var timestamp = JSON.parse(payload).t;
      return (now() - timestamp) <= maxAge;
    }
    catch (e) { }
    return false;
  };

  LocalStorageMedium.prototype.expireMessages = function(delta) {
    var cutoff = now() - delta;
    var keysToKill = [];

    for (var i = localStorage.length - 1; i >= 0; --i) {
      var key = localStorage.key(i);
      try {
        var parts = key.split(',');
        if (parts[0] == 'lsm') {
          var payload = localStorage.getItem(key);
          var timestamp = JSON.parse(payload).t;
          if (timestamp < cutoff) {
            keysToKill.push(key);
          }
        }
      } catch (e) { }
    }
    for (var j in keysToKill) {
      localStorage.removeItem(keysToKill[j]);
    }
  };


  var CapRouter = function() {
    var me = this;

    this.replyId = newUUIDv4();
    this.ifaces = {};
    this.transactions = {};

    this.resolver = function(instanceId) {
      var iface = me.ifaces[instanceId];
      return iface ? iface : me.sendInterface;
    }
    this.sendInterface = Object.freeze({
      invoke: function(ser, m, d, s, f) { me.sendInvoke(ser, m, d, s, f); }
    });

    this.routerServer = new CapServer(); // "The radish server..."
    this.routerServer.setResolver(this.resolver);

    this.medium = getLocalStorageMedium();

    this.medium.addMessageHandler(this.replyId, function(op, id, tx, msg) {
      if (op == 'response') {
        var t = me.transactions[tx];
        if (t) {
          delete me.transactions[tx];
          clearTimeout(t.timer);
          if (msg.type == 'success') {
            if (t.success) { t.success(msg.data); }
          }
          if (msg.type == 'failure') {
            if (t.failure) { t.failure(msg.data); }
          }
        }
      }
    });
  };

  CapRouter.prototype.close = function() {
    this.medium.close();
  };

  CapRouter.prototype.addInterface = function(instanceId, iface) {
    var me = this;
    this.ifaces[instanceId] = iface;
    this.medium.addMessageHandler(instanceId, function(op, id, tx, msg) {
      if (op == 'invoke') {
        iface.invoke(msg.ser, msg.method, msg.data,
          function(data) { me.sendResponse(msg.reply, tx, 'success', data); },
          function(err) { me.sendResponse(msg.reply, tx, 'failure', err); });
      }
    });
  };

  CapRouter.prototype.isRoutable = function(instanceId, maxAge) {
    if (instanceId in this.ifaces) { return true; }
    return this.medium.isRoutable(instanceId, maxAge);
  }

  CapRouter.prototype.sendInvoke = function(ser, method, data, success, failure)
  {
    var me = this;
    var dest = decodeInstanceId(ser);
    if (!dest) {
      failure({ status: 400, message: 'Unparsable capability'});
      return;
    }
    var tx = newUUIDv4();
    var timer = setTimeout(function() {
      delete me.transactions[tx];
      failure({ status: 504, message: 'Router Timeout'});
    }, RESPONSE_TIMEOUT);

    this.transactions[tx] =
      { success: success, failure: failure, timer: timer };

    var msg = {
      reply: this.replyId,
      ser: ser,
      method: method,
      data: data
    };
    this.medium.postMessage('invoke', dest, tx, msg);
  };

  CapRouter.prototype.sendResponse = function(reply, tx, type, data) {
    var msg = {
      type: type,
      data: data
    };
    this.medium.postMessage('response', reply, tx, msg);
  };

  CapRouter.prototype.storeStart = function(id, data) {
    var msg = this.routerServer.dataPreProcess(data);
    this.medium.saveMessage('start', id, msg);
  }

  CapRouter.prototype.retrieveStart = function(id) {
    var msg = this.medium.retrieveMessage('start', id);
    if (msg) {
      var data = this.routerServer.dataPostProcess(msg);
      return data;
    }
    else {
      return null;
    }
  }

  CapRouter.prototype.expireMessages = function(delta) {
    this.medium.expireMessages(delta);
  }

  freeze(CapRouter.prototype);
  freeze(CapRouter);

  return {
    CapRouter: CapRouter,
    getLocalStorageMedium: getLocalStorageMedium
  };
})();

var CapRouter = ROUTER_EXPORTS.CapRouter;
var getLocalStorageMedium = ROUTER_EXPORTS.getLocalStorageMedium;
