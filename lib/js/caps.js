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

/**
 * caps.js - a belay capability abstraction for Javascript clients.
 * Only CapServer, Capability and newUUIDv4 are relevant to users of the Belay
 * framework, all other functions and types are implementation details
 * and subject to change without notice.
 */

/*
Globals used:
  JSON.stringify
  JSON.parse
*/

if (!('freeze' in Object)) {
  Object.freeze = function(x) { return x; };
}

var CAP_EXPORTS = (function() {

  /****************************************************************************/
  /** UTILITY FUNCTIONS *******************************************************/
  /****************************************************************************/

  /**
   * Generates a new UUIDv4 using a cryptographically secure
   * random number generator if the browser supports JS Crypto,
   * or uses the standard Math.random() generator.
   *
   * See RFC 4122 for more information on UUIDs:
   * http://www.ietf.org/rfc/rfc4122.txt 
   */
  var newUUIDv4 = (function() {
    var r;
      // handle for a random 16-bit int generator

    if (typeof window !== 'undefined' && window !== null &&
    'crypto' in window && 'getRandomValues' in window.crypto) {
      // variant which uses the brower provided, cryptography
      // grade random number generator.
      var randomShort = new Int16Array(1);
      r = function() {
        window.crypto.getRandomValues(randomShort);
        return randomShort[0] + 0x8000;
      }
    } else {
      // if the browser doesn't support JS crypto, or we are
      // in a context where we can't use it (i.e. shared worker
      // in chrome), we just use the standard Math.random().
      r = function() { return Math.floor(Math.random() * 0x10000); };
    }

    var s = function(x) { return ('000' + x.toString(16)).slice(-4); };
    var u = function() { return s(r()); };
    var v = function() { return s(r() & 0x0fff | 0x4000); };
    var w = function() { return s(r() & 0x3fff | 0x8000); };

    // the actual UUIDv4 generator
    return function() {
      return u() + u() + '-' + u() + '-' + v() +
             '-' + w() + '-' + u() + u() + u();
    }
  })();

  var uuidv4RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var isUUIDv4 = function(u) { return uuidv4RE.test(u); };
  
  /**
    Used for creating new names for windows from (secret) uuids.
    Hashes the *bits* of the uuid, using SHA-256, and returns the first 128 bits
    of the resulting hash, represented as a hex string.
    
    newInstanceId provides the canonical form for instanceIds for CapServers.
  */
  var newInstanceId = function(uuid) {
    if (typeof uuid !== 'string') throw 'newInstanceId: Got non-string value.';
    if (!isUUIDv4(uuid))          throw 'newInstanceId: Got non-uuid v4 value.';
    
    var uuidbits = sjcl.codec.hex.toBits(uuid.replace(/-/g, ''));
    var hashedbits = sjcl.hash.sha256.hash(uuidbits);
    
    return sjcl.codec.hex.fromBits(hashedbits).substring(0, 32);
  };
  
  var instanceIdRE = /^[0-9a-f]{32}$/;
  var isInstanceId = function(b) { return instanceIdRE.test(b); };
  
  var validInstId = function(id) {
    return isUUIDv4(id) || isInstanceId(id);
  };

  var newCapId = newUUIDv4;

  var encodeSerialization = function(instanceId, capId) {
    return 'urn:x-cap:' + instanceId + ':' + capId;
  };

  var decodeSerialization = function(ser) {
    var m = ser.match(/^urn:x-cap:([-0-9a-f]{32,36}):([-0-9a-f]{36})$/);
    if (m) {
      m.shift();
    }
    return m;
  };

  var decodeInstanceId = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[0] : nullInstanceId;
  };

  var decodeCapId = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[1] : nullCapId;
  };

  var nullInstanceId = '00000000-0000-0000-0000-000000000000';
  var nullCapId = '00000000-0000-0000-0000-000000000000';
  var nullSer = encodeSerialization(nullInstanceId, nullCapId);

  var isURL = function(str) {
     return /^https?:/.test(str);
  }

  var makeAsyncAJAX = function(url, method, data, success, failure) {
     var xhr = new XMLHttpRequest();
     xhr.open(method, url);
     xhr.onreadystatechange = function() {
       if (xhr.readyState === 4) {
         if (xhr.status >= 200 && xhr.status < 300) {
           success(xhr.responseText);
         }
         else {
           failure({ status: xhr.status, message: xhr.statusText });
         }
       }
     };
     xhr.send(data);
   };

  /****************************************************************************/
  /** ImplHandler *************************************************************/
  /****************************************************************************/

  var badRequest = Object.freeze(
      {status: 400, message: 'bad request'});
  var notFound = Object.freeze(
      {status: 404, message: 'not found'});
  var methodNotAllowed = Object.freeze(
      {status: 405, message: 'method not allowed'});
  var internalServerError = Object.freeze(
      {status: 500, message: 'internal server error'});

  var deadImpl = Object.freeze({
    invoke: function(method, d, sk, fk) {
      fk(notFound);
    }
  });

  /**
   * Not part of the user API.
   */
  var ImplHandler = function(server, handler) {
      this.server = server;
      this.handler = handler;
  };
  ImplHandler.prototype.invoke = function(method, data, sk, fk) {
    if (method == 'GET' || method == 'DELETE') {
      if (data !== undefined) {
        fk(badRequest);
        return;
      }
    }
    else {
      data = this.server.dataPostProcess(data);
    }

    var skk;
    if (method == 'PUT' || method == 'DELETE') {
      skk = function(result) {
        if (result === undefined) sk();
        else fk(internalServerError);
      }
    }
    else if (method == 'GET' || method == 'POST') {
      var server = this.server;
      skk = function(result) {
        sk(server.dataPreProcess(result));
      }
    }

    try {
      var h = this.handler;
      if (method == 'GET' && h.get) h.get(skk, fk);
      else if (method == 'PUT' && h.put) h.put(data, skk, fk);
      else if (method == 'POST' && h.post) h.post(data, skk, fk);
      else if (method == 'DELETE' && h.remove) h.remove(skk, fk);
      else fk(methodNotAllowed);
    }
    catch (e) {
      fk(internalServerError);
    }
  };

  var ImplURL = function(url) { this.url = url; };
  ImplURL.prototype.invoke = function(m, d, s, f) {
     makeAsyncAJAX(this.url, m, d, s, f);
  };

  var ImplWrap = function(server, innerCap) {
    this.server = server;
    this.inner = innerCap; };
  ImplWrap.prototype.invoke = function(m, d, s, f) {
    var me = this;
    var wrappedS = function(result) {
      return s(me.server.dataPreProcess(result));
    };
    this.inner.invoke(m, this.server.dataPostProcess(d), wrappedS, f);
  };

  /****************************************************************************/
  /** Capability **************************************************************/
  /****************************************************************************/


  /**
   * A Javascript abstraction of invokeable capabilities.
   * Capability invocation is always asynchronous from the client, and can be 
   * performed through one of get, post, put or remove.
   */
  var Capability = function(ser, server) {
    this.ser = ser;
    this.server = server;
  };

  /**
   * invokes the capability using the specified method, passing
   * the specified data.
   *
   * One of success(resp) or failure(err) will be invoked 
   * asynchronously when the call completes, where resp will be
   * a deserialized JSON value returned by the capability, and
   * err will be an object with two fields:
   *  - status: the http status code describing the error as an integer.
   *  - message: a human readable stirng describing the error.
   *
   * Clients should not normally call invoke() directly, it is
   * recommended that one of get, post, put or remove be called
   * instead.
   */
  Capability.prototype.invoke = function(method, data, success, failure) {
    var me = this;
    if (method == 'PUT' || method == 'POST') {
      data = this.server.dataPreProcess(data);
    }
    else {
      if (data !== undefined) {
        throw ('Capability.invoke ' + method +
               ' called with request data' + data);
      }
    }
    var wrappedSuccess = function(result) {
      if (success) {
        if (method == 'GET' || method == 'POST') {
          result = me.server.dataPostProcess(result);
        }
        else {
          result = undefined;
        }
        success(result);
      }
    };
    var wrappedFailure = function(err) { if (failure) { failure(err); } };

    this.server.privateInterface.invoke(this.ser, method, data,
                                        wrappedSuccess, wrappedFailure);
  };

  /**
   * Issues a GET request to the capability, for capabilities that
   * require no request data.
   *
   * See the definition of invoke for more information about the 
   * success / failure handlers.
   */
  Capability.prototype.get = function(success, failure) {
    this.invoke('GET', undefined, success, failure);
  };

  /**
   * Issues a PUT request to the capability, with the data provided
   * (which must be a JSON serializable value).
   *
   * See the definition of invoke for more information about the 
   * success / failure handlers.
   */
  Capability.prototype.put = function(data, success, failure) {
    this.invoke('PUT', data, success, failure);
  };

  /**
   * Issues a POST request to the capability, with the data provided
   * (which must be a JSON serializable value).
   *
   * See the definition of invoke for more information about the 
   * success / failure handlers.
   */
  Capability.prototype.post = function(data, success, failure) {
    this.invoke('POST', data, success, failure);
  };

  /**
   * Issues a DELETE request to the capability.
   *
   * See the definition of invoke for more information about the 
   * success / failure handlers.
   */
  Capability.prototype.remove = function(success, failure) {
    this.invoke('DELETE', undefined, success, failure);
  };

  /**
   * Returns the URL form of the capability represented by the
   * capability instance.
   */
  Capability.prototype.serialize = function() {
    return this.ser;
  };

  Object.freeze(Capability.prototype);
  Object.freeze(Capability);

  /****************************************************************************/
  /** CapServer ***************************************************************/
  /****************************************************************************/

  /**
   * Provides facilities to grant, revoke and restore capabilities.
   */
  var CapServer = function(instanceId, snapshot) {
    this.reviveMap = {};  // map capId -> key or cap or url
    this.implMap = {};    // map capId -> impls
    this.reviver = null;
    this.sync = null;
    if (instanceId !== undefined) {
      if (typeof(instanceId) !== 'string' || !validInstId(instanceId)) {
        throw new TypeError(
          'CapServer: bad instance identifier: ' + instanceId);
      }
    }
    this.instanceId = instanceId;

    this.resolver = function(id) { return null; };
    if (snapshot) {
      snapshot = JSON.parse(snapshot);
      this.reviveMap = snapshot.map;
    }

    this.publicInterface = (function(me) {
      return Object.freeze({
        invoke: function(ser, method, data, success, failure) {
          me._getImpl(ser).invoke(method, data, success, failure);
        }
      });
    })(this);

    this.privateInterface = (function(me) {
      return Object.freeze({
        invoke: function(ser, method, data, success, failure) {
          if (isURL(ser)) {
            return makeAsyncAJAX(ser, method, data, success, failure);
          }

          var instanceId = decodeInstanceId(ser);
          if (me.instanceId && instanceId == me.instanceId) {
            me._getImpl(ser).invoke(method, data, success, failure);
            return;
          } else {
            var publicInterface = me.resolver(instanceId);
            if (publicInterface) {
              publicInterface.invoke(ser, method, data, success, failure);
              return;
            }
          }

          return deadImpl.invoke(method, data, success, failure);
        }
      });
    })(this);
  };

  CapServer.prototype._sync = function() {
    if (this.sync) this.sync(this._snapshot());
  };

  CapServer.prototype._mint = function(capId) {
    if (!this.instanceId) {
      throw 'CapServer: no instanceId in mint()';
    }
    var ser = encodeSerialization(this.instanceId, capId);
    var cap = Object.freeze(new Capability(ser, this));
    return cap;
  };

  CapServer.prototype._getImpl = function(ser) {
    var capId = decodeCapId(ser);
    if (! (capId in this.implMap)) {
      var info = this.reviveMap[capId];
      if (info) {
        if (info.restoreKey) {
          if (this.reviver) {
            this.implMap[capId] = this._build(this.reviver(info.restoreKey));
          }
        }
        else if (info.restoreCap) {
          var innerCap = this.restore(info.restoreCap);
          this.implMap[capId] = new ImplWrap(this, innerCap);
        }
      }
    }
    return this.implMap[capId] || deadImpl;
  };

  CapServer.prototype._grant = function(impl, key) {
    var capId = newCapId();

    if (impl === null) { impl = deadImpl; }
    this.implMap[capId] = impl;
    if (key) { this.reviveMap[capId] = { restoreKey: key }; }
    this._sync();
    // TODO(mzero): should save URL and cap items in reviveMap

    return this._mint(capId);
  };

  /**
   * grants a capability to invoke the service provided by item (see the
   * definition of build for more information on legal item values).
   *
   * If it is intended that this capability be peristent, i.e. be reusable
   * after the instance has been closed and relaunched at some point in the
   * future, a string key must be provided which can be used to reconstruct
   * the handler. Reconstructing the handler is performed by the function
   * provided to setReviver().
   */
  CapServer.prototype.grant = function(item, key) {
    return this._grant(this._build(item), key);
  };

  /**
   * grants a persistent capability to invoke a capability whose handler can be
   * reconstructed using the function provided to setReviver().
   */
  CapServer.prototype.grantKey = function(key) {
    return this._grant(this._build(this.reviver(key)), key);
  };

  // TODO(jpolitz): get rid of wrap?  get rid of resolvable?
  CapServer.prototype.wrap = function(innerCap, resolvable) {
    var capId = newCapId();

    this.implMap[capId] = new ImplWrap(this, innerCap);
    this.reviveMap[capId] = { restoreCap: innerCap.serialize() };

    return this._mint(capId);
  };

  CapServer.prototype._build = function(item) {
    var t = typeof item;

    var checkFnArgs = function(fn, params) {
      if (typeof fn === 'function' && typeof fn.length === 'number') {
        return fn.length >= params ? 'async' : 'sync';
      }
      return false;
    }

    var consistentHandler = function(obj) {
      var a = [checkFnArgs(obj.get, 1),
                checkFnArgs(obj.put, 2),
                checkFnArgs(obj.post, 2),
                checkFnArgs(obj.remove, 1)];

      var foundHandler = false;
      var handlerType = false;
      for (var i = 0; i < a.length; i++) {
        if (!foundHandler && a[i]) {
          foundHandler = true;
          handlerType = a[i];
        }
        else if (handlerType && a[i] && handlerType !== a[i]) {
          throw 'Inconsistent handlers';
        }
      }
      return foundHandler ? handlerType : false;
    }

    if (item === null) return deadImpl;
    else if (t === 'string' && isURL(item)) return this._buildURL(item);
    else if (t === 'function') {
      switch (checkFnArgs(item, 2)) {
        case 'sync': return this._buildSyncFunction(item);
        case 'async': return this._buildAsyncFunction(item);
        default: throw 'Invalid length on function';
      }
    }
    else if (t === 'object') {
      if (Object.getPrototypeOf(item) === Capability.prototype) {
        return new ImplWrap(this, item);
      }
      if (typeof item.invoke === 'function' &&
          item.invoke.length === 4) {
        return item;
      }
      switch (consistentHandler(item)) {
        case 'sync': return this._buildSyncHandler(item);
        case 'async': return this._buildAsyncHandler(item);
        default: throw 'build() given an object with no handlers';
      }
    }
    else return deadImpl;
  };

  CapServer.prototype._buildAsyncHandler = function(h) {
    return new ImplHandler(this, h);
  };

  CapServer.prototype._buildSyncHandler = function(h) {
    ah = {};
    if (h.get) ah.get = function(sk, fk)    { sk(h.get()); };
    if (h.put) ah.put = function(d, sk, fk) { sk(h.put(d)); };
    if (h.post) ah.post = function(d, sk, fk) { sk(h.post(d)); };
    if (h.remove) ah.remove = function(sk, fk)    { sk(h.remove()); };
    return new ImplHandler(this, ah);
  };

  CapServer.prototype._buildSyncFunction = function(f) {
    return new ImplHandler(this, {
      get: function(sk, fk)    { sk(f()); },
      put: function(d, sk, fk) { sk(f(d)); },
      post: function(d, sk, fk) { sk(f(d)); }
    });
  };

  CapServer.prototype._buildAsyncFunction = function(f) {
    return new ImplHandler(this, {
      get: function(sk, fk)    { f(undefined, sk, fk); },
      put: function(d, sk, fk) { f(d, sk, fk); },
      post: function(d, sk, fk) { f(d, sk, fk); }
    });
  };

  CapServer.prototype._buildURL = function(url) {
    if (typeof url !== 'string') { return deadImpl; }
    return new ImplURL(url);
  };

  /**
   * Revokes the provided capability URL, if it was issued by
   * this capability server.
   */
  CapServer.prototype.revoke = function(ser) {
    var capId = decodeCapId(ser);
    delete this.reviveMap[capId];
    delete this.implMap[capId];
    this._sync();
  };

  /**
   * Revokes all capabilities that have ever been issued by this
   * capability server.
   */
  CapServer.prototype.revokeAll = function() {
    this.reviveMap = {};
    this.implMap = {};
    this._sync();
  };

  /**
   * Constructs a Capability object from the serialized URL form
   * of the capability.
   */
  CapServer.prototype.restore = function(ser) {
    return Object.freeze(new Capability(ser, this));
  };

  /**
   * Allows a custom capability reviver to be set for this
   * capability server. The value passed should be a function of
   * form function(key) and return a capability handler, which can be
   * in one of the following forms:
   *  - No-argument functions.
   *  - Single argument functions.
   *  - Functions of form 
   *    function(data, successCallback, failureCallback) { ... }
   *    which are responsible for invoking successCallback or failureCallback 
   *    when the request has been serviced.
   *  - A Capability object. A new capability will be created which acts as a 
   *    proxy to the provided capability.
   *  - A URL string for a capability.
   *  - A handler object, either either has an invoke function of form
   *    invoke(method, data, successCallback, failureCallback)
   *    or has a subset of the following functions defined:
   *
   *    get([successCallback, failureCallback])
   *    post(data, [successCallback, failureCallback])
   *    put(data, [successCallback, failureCallback])
   *    remove([successCallback, failureCallback])
   *
   *    note that the functions defined must be consistently asynchronous
   *    or synchronous, i.e. all or none must accept callback functions.
   */
  CapServer.prototype.setReviver = function(r) { this.reviver = r; };

  CapServer.prototype._snapshot = function() {
    var snapshot = {
      id: this.instanceId,
      map: this.reviveMap
    };
    return JSON.stringify(snapshot);
  };

  /**
   * Not part of the public API.
   * Sets the function which will be invoked to determine where a capability
   * will be handled, locally or forwarded to another location. 
   */
  CapServer.prototype.setResolver = function(resolver) {
    this.resolver = resolver;
  };

  /**
   * Sets the function which will be invoked whenever the internal state
   * of the capability server is changed. The function should be of form
   * function(data) where data is a JSON encoded object containing the
   * internal state of the capability server, which should be persisted by
   * the function through whatever means are available (typically, invoking
   * a server cap to store the information for retrieval in a future session).
   */
  CapServer.prototype.setSyncNotifier = function(sync) {
    if(typeof(sync) !== 'function' || sync.length < 1) {
      throw new TypeError('the sync notifier must be a function that takes ' +
          'at least one argument');
    }
    this.sync = sync;
  };

  /**
   * Serializes the provided javascript value for transmission
   * as the request data to a capability.
   */
  CapServer.prototype.dataPreProcess = function(w) {
    if (w === undefined) return w;
    return JSON.stringify({ value: w }, function(k, v) {
      if (typeof(v) == 'function') {
        throw new TypeError('Passing a function');
      }
      try { // TODO(jpolitz): replace try with an if check
        if (Object.getPrototypeOf(v) === Capability.prototype) {
          return { '@': v.serialize() };
        }
      } catch (e) { }
      return v;
    });
  };

  /**
   * Deserializes the provided string, retrieved as the response
   * to a capability invocation, to a javascript value.
   */
  CapServer.prototype.dataPostProcess = function(w) {
    if (w === undefined || w === null || w.trim() === '') return undefined;
    var me = this;
    return JSON.parse(w, function(k, v) {
      try { // TODO(jpolitz): replace try with an if check
        var k = Object.keys(v);
        if (k.length == 1 && k[0] == '@') {
          return me.restore(v['@']);
        }
      }
      catch (e) { }
      return v;
    }).value;
  };

  Object.freeze(CapServer.prototype);
  Object.freeze(CapServer);

  function now() {
    return (new Date()).valueOf();
  }

  /****************************************************************************/
  /** CapTunnel ***************************************************************/
  /****************************************************************************/

  /**
   * Communication abstraction used by the client side belay environment.
   * Not part of the user API.
   */
  var CapTunnel = function(port) {
    var me = this;

    this.localResolver = function(instanceId) { return null; };
    this.remoteResolverProxy =
        function(instanceId) { return me.sendInterface; };
    this.transactions = {};
    this.txCounter = 1000;
    this.tunnelServer = new CapServer(); // "The radish server..."
    this.tunnelServer.setResolver(
        function(instanceId) { return me.sendInterface; });

    this.sendInterface = Object.freeze({
      invoke: function(ser, m, d, s, f) { me.sendInvoke(ser, m, d, s, f); }
    });

    var lastRecvTime = now();
    var lastSendTime = 0;

    this.postMessage = function(msg) {
      lastSendTime = now();
      port.postMessage(msg);
    }

    this.handleClose = function() {
      for (tx in this.transactions) {
        var fk = this.transactions[tx].failure;
        if (fk) fk({
          status: 504,
          message: 'CapTunnel communication failed'
        });
      }

      if (this.onclosed) this.onclosed();
    }

    port.onmessage = function(event) {
      lastRecvTime = now();
      var message = event.data;
      if (message.op == 'invoke') { me.handleInvoke(message); }
      else if (message.op == 'response') { me.handleResponse(message); }
      else if (message.op == 'outpost') { me.handleOutpost(message); }
      else if (message.op === 'ping') {
        me.postMessage({ op: 'pong'});
      }
      else if (message.op === 'pong') {
        // lastRecvTime is always updated; nothing to do
      }
    };

    var pingTimerId;
    // ensure CHECK_INTERVAL < RECV_INTERVAL
    var CHECK_INTERVAL = 5000; // check if we need to send every 5s
    var RECV_INTERVAL = 6000; // ensure we recv every 6s

    var sendPingCheckRecv = function(_) {
      var tNow = now();
      var nextTimeCheckWillRun = tNow + CHECK_INTERVAL;
      var receiveDeadline = lastRecvTime + RECV_INTERVAL;
      var sendDeadline = lastSendTime + RECV_INTERVAL;

      if (tNow > receiveDeadline) {
        clearInterval(pingTimerId);
        me.handleClose();
      } else if (nextTimeCheckWillRun >= sendDeadline) {
        me.postMessage({ op: 'ping' });
      }
    };

    sendPingCheckRecv();
    pingTimerId = setInterval(sendPingCheckRecv, CHECK_INTERVAL);
  };

  CapTunnel.prototype.sendOutpost = function(outpost) {
    var message = {
      op: 'outpost',
      outpostData: this.tunnelServer.dataPreProcess(outpost)
    };
    this.postMessage(message);
  };

  CapTunnel.prototype.handleOutpost = function(message) {
    this._outpost = this.tunnelServer.dataPostProcess(message.outpostData);
    if (this.hasOwnProperty('_outpostHandler')) {
      this._outpostHandler(this._outpost);
    }
  };

  CapTunnel.prototype.setOutpostHandler = function(callback) {
    this._outpostHandler = callback;
    if (this.hasOwnProperty('_outpost')) {
      this._outpostHandler(this._outpost);
    }
  };

  CapTunnel.prototype.sendInvoke = function(ser, method, data, success, failure)
  {
    var txId = this.txCounter++;
    this.transactions[txId] = { success: success, failure: failure };
    var msg = {
      op: 'invoke',
      txId: txId,
      ser: ser,
      method: method,
      data: this.toWire(data)
    };
    this.postMessage(msg);
  };

  CapTunnel.prototype.handleInvoke = function(message) {
    var iface = this.localResolver(decodeInstanceId(message.ser));
    if (iface) {
      var me = this;
      iface.invoke(message.ser, message.method, this.fromWire(message.data),
          function(data) { me.sendResponse(message.txId, 'success', data); },
          function(err) { me.sendResponse(message.txId, 'failure', err); });
    } else {
      this.sendResponse(message.txId, 'failure', { status: 404 });
    }
  };

  CapTunnel.prototype.sendResponse = function(txId, type, data) {
    var msg = {
      op: 'response',
      txId: txId,
      type: type,
      data: this.toWire(data)
    };
    this.postMessage(msg);
  };

  CapTunnel.prototype.handleResponse = function(message) {
    var tx = this.transactions[message.txId];
    if (tx) {
      delete this.transactions[message.txId];
      if (message.type == 'success') {
        if (tx.success) { tx.success(this.fromWire(message.data)); }
      }
      if (message.type == 'failure') {
        if (tx.failure) { tx.failure(this.fromWire(message.data)); }
      }
    }
  };

  CapTunnel.prototype.toWire = function(data) { return data; };
  CapTunnel.prototype.fromWire = function(data) { return data; };

  CapTunnel.prototype.setLocalResolver = function(resolver) {
    this.localResolver = resolver;
  };

  Object.freeze(CapTunnel.prototype);
  Object.freeze(CapTunnel);

  /****************************************************************************/
  /** PUBLIC EXPORTS **********************************************************/
  /****************************************************************************/

  return {
    CapServer: CapServer,
    CapTunnel: CapTunnel,
    newUUIDv4: newUUIDv4,
    newInstanceId: newInstanceId
  };
})();

var CapServer = CAP_EXPORTS.CapServer;
var CapTunnel = CAP_EXPORTS.CapTunnel;
var newUUIDv4 = CAP_EXPORTS.newUUIDv4;
var newInstanceId = CAP_EXPORTS.newInstanceId;

// TODO(jasvir): Once everything is modulized, replace this file with a wrapper
if (typeof define === 'function' && define.amd) {
  define(function() { return CAP_EXPORTS; });
}
