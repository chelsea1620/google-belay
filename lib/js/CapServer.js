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

define(['./utils'], function(utils) {
  'use strict';

  var newCapId = utils.newUUIDv4;

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
    this.reviveMap = {};  // map capId -> name and args, or cap, or url
    this.implMap = {};    // map capId -> impls
    this.namedHandlers = {};  // map name -> item generating function
    this.sync = null;
    if (instanceId !== undefined) {
      if (typeof(instanceId) !== 'string' || !utils.validInstId(instanceId)) {
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

          var instanceId = utils.decodeInstanceId(ser);
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
    var ser = utils.encodeSerialization(this.instanceId, capId);
    var cap = Object.freeze(new Capability(ser, this));
    return cap;
  };

  CapServer.prototype._getImpl = function(ser) {
    var capId = utils.decodeCapId(ser);
    if (! (capId in this.implMap)) {
      try {      
        var info = this.reviveMap[capId];
        if (info) {
          if (info.restoreCap) {
            var innerCap = this.restore(info.restoreCap);
            this.implMap[capId] = new ImplWrap(this, innerCap);
          }
          else if (info.restoreName) {
            if (info.restoreName in this.namedHandlers) {
              var handler = this.namedHandlers[info.restoreName];
              var item = handler.apply(undefined, info.restoreArgs);
              this.implMap[capId] = this._build(item);
            }
          }
        }
      }
      catch (e) { }
    }
    return this.implMap[capId] || deadImpl;
  };

  CapServer.prototype._grant = function(impl) {
    var capId = newCapId();

    if (impl === null) { impl = deadImpl; }
    this.implMap[capId] = impl;
    this._sync();
    // TODO(mzero): should save URL and cap items in reviveMap

    return this._mint(capId);
  };

  /**
   * grants a capability to invoke the service provided by item (see the
   * definition of build for more information on legal item values).
   */
  CapServer.prototype.grant = function(item) {
    return this._grant(this._build(item));
  };

  // TODO(jpolitz): get rid of wrap?
  CapServer.prototype.wrap = function(innerCap) {
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
        default: throw 'Object with no handlers';
      }
    }
    else throw 'Unusable handler';
  };

  CapServer.prototype._buildAsyncHandler = function(h) {
    return new ImplHandler(this, h);
  };

  CapServer.prototype._buildSyncHandler = function(h) {
    var ah = {};
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
    var capId = utils.decodeCapId(ser);
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
   * Grant a cabaility based on a name and additional arguments. The item for
   * responding to this capability will be supplied by a call some handler
   * registered via setNamedHandler(). Such grants can be serialized and
   * restored. The additional arguments, which must be BCAP-JSON-able, are
   * passed to the handler and "safe" arguments which are untamperable.
   */
  CapServer.prototype.grantNamed = function(name, _varargs) {
    var capId = newCapId();
    this.reviveMap[capId] = {
        restoreName: name,
        restoreArgs: Array.prototype.slice.call(arguments, 1)
      };
    this._sync();
    return this._mint(capId);
  }

  /**
   * Register a handler for a class of named capabilities. When a capability
   * that was granted by name is invoked, if needed, this handler will be used
   * to recreate an item for it. The arguments that were passed to grantName()
   * are passed to the this handler, and the result should be a capability item.
   */
  CapServer.prototype.setNamedHandler = function(name, handler) {
    if (typeof handler === 'function') {
      this.namedHandlers[name] = handler;
    } else {
      throw 'NamedHandler generators must be functions';
    }
  };

  /**
   * Revoke all grants for a given name, based on an selection function. The
   * function is passed the same arguments the handler generator is, and if
   * it return true, then the corresponding cap is revoked.
   */
  CapServer.prototype.revokeNamed = function(name, selector) {
    for (var k in this.reviveMap) {
      if (!this.reviveMap.hasOwnProperty(k)) continue;

      var r = this.reviveMap[k];
      if ('restoreName' in r
          && r.restoreName === name
          && selector.apply(undefined, r.restoreArgs)) {
        delete this.implMap[k];
        delete this.reviveMap[k];
      }
    }
  };

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

  /****************************************************************************/
  /** PUBLIC EXPORTS **********************************************************/
  /****************************************************************************/

  return CapServer;
});
