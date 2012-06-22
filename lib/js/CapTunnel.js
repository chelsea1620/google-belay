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

define (['./utils', './CapServer'], function(utils, CapServer) {
  'use strict';

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
      for (var tx in this.transactions) {
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
    var iface = this.localResolver(utils.decodeInstanceId(message.ser));
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

  return CapTunnel;
});

