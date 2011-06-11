/*

CapServer
  See: http://goo.gl/hBgTu

Globals used:
  JSON.stringify
  JSON.parse
  jQuery.ajax
  
*/

if (!('freeze' in Object)) {
  Object.freeze = function(x) { return x; };
};

var CAP_EXPORTS = (function() {
  
  // == UTILITIES ==
  
  var newUUIDv4 = function() {
    var r = function() { return Math.floor(Math.random() * 0x10000); }
    var s = function(x) { return ("000" + x.toString(16)).slice(-4); }
    var u = function() { return s(r()); }
    var v = function() { return s(r() & 0x0fff | 0x4000); }
    var w = function() { return s(r() & 0x3fff | 0x8000); }
    return u()+u()+'-'+u()+'-'+v()+'-'+w()+'-'+u()+u()+u();
  }

  var newCapID = newUUIDv4;
  var encodeSerialization = function(instID, capID) {
    return "urn:x-cap:" + instID + ":" + capID;
  }
  var decodeSerialization = function(ser) {
    var m = ser.match(/^urn:x-cap:([-0-9a-f]{36}):([-0-9a-f]{36})$/)
    if (m) {
      m.shift();
    }
    return m;
  }
  var decodeInstID = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[0] : nullInstID;
  }
  var decodeCapID = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[1] : nullCapID;
  }
  
  var nullInstID = "00000000-0000-0000-0000-000000000000";
  var nullCapID = "00000000-0000-0000-0000-000000000000";
  var nullSer = encodeSerialization(nullInstID, nullCapID);

  var callAsAJAX = function(f, data, success, failure) {
    setTimeout(function() {
      try {
          var response;
          response = f(data);
          if(success) success(response);
      }
      catch(e) {
          if(failure) failure({status: 500, message: "exception thrown"});
      }
    }, 0);
  }
  
  var errorAsAJAX = function(data, success, failure) {
    setTimeout(function() {
      if (failure) failure({status: 404});
    }, 0);
  }
  
  var makeAsyncAJAX = function(url, data, success, failure) {
    jQuery.ajax({ data: data,
                  type: 'POST',
                  url: url,
                  success: function(data, status, xhr) { success(data); },
                  error: function(xhr, status, message) { 
                           failure({status: Number(xhr.status) || 501,
                                    message: message});
                }});
  }
  
  var makeSyncAJAX = function(url, method, data) {
    var resp;
    jQuery.ajax({
      url: url,
      type: method,
      data: data,
      async: false,
      success: function(v) { resp = v; }
    });
    return resp;
  }
  
  // == THE FOUR IMPLEMENTATION TYPES ==
  
  var deadImpl = Object.freeze({
    invoke:     function(d, s, f) { errorAsAJAX(d, s, f); },
    invokeSync: function(v) { return undefined; },
  });

  var ImplFunction = function(fn) { this.fn = fn; }
  ImplFunction.prototype.invoke = function(d, s, f) { callAsAJAX(this.fn, d, s, f); };
  ImplFunction.prototype.invokeSync = function(v) { return this.fn(v); };

  var ImplURL = function(url) { this.url = url; }
  ImplURL.prototype.invoke = function(d, s, f) { makeAsyncAJAX(this.url, d, s, f); };
  ImplURL.prototype.invokeSync = function(v) { return makeSyncAJAX(this.url, 'POST', v); };
  
  var ImplWrap = function(innerCap) { this.inner = innerCap; }
  ImplWrap.prototype.invoke = function(d, s, f) { this.inner.invoke(d, s, f); }
  ImplWrap.prototype.invokeSync = function(v) { return this.inner.invokeSync(v); }
  
  var buildImplementation = function(item) {
    var t = typeof(item);
    if (t == "function")  return new ImplFunction(item);
    if (t == "string")    return new ImplURL(item);
    if (item === null)    return deadImpl; // careful: typeof(null) == "object"
    if (t == "object")    return new ImplWrap(item)
    else                  return deadImpl;
  };
  
  
  
  
  
  
  
  
  var Capability = function(ser, iface) {
    this.ser = ser;
    this.iface = iface;
  };
  Capability.prototype.invoke = function(data, success, failure) {
    this.iface.invoke(this.ser, data, success, failure);
  };
  Capability.prototype.invokeSync = function(data) {
    return this.iface.invokeSync(this.ser, data);
  };
  Capability.prototype.serialize = function() {
    return this.ser;
  }

  
  
  
  var CapServer = function(snapshot) {
    this.reviveMap = {};  // map capID -> key or cap or url
    this.implMap = {};    // map capID -> impls
    this.reviver = null;
    this.instanceID = newUUIDv4();
    this.resolver = function(id) { return null; };
    if (snapshot) {
      snapshot = JSON.parse(snapshot);
      this.reviveMap = snapshot.map;
      this.instanceID = snapshot.id;
    }
    
    this.publicInterface = (function(me) {
      return Object.freeze({
        invoke: function(ser, data, success, failure) {
          me._getImpl(ser).invoke(data, success, failure);
        },
        invokeSync: function(ser, data) {
          return me._getImpl(ser).invokeSync(data);
        }
      });
    })(this);

    this.privateInterface = (function(me) {
      return Object.freeze({
        invoke: function(ser, data, success, failure) {
          if (/^https?:/.test(ser)) {
            return makeAsyncAjax(ser, data, success, failure);
          }

          var instID = decodeInstID(ser);
          if(instID == me.instanceID) {
            me._getImpl(ser).invoke(data, success, failure);
          } else {
            var publicInterface = me.resolver(instID);
            if(publicInterface) {
              publicInterface.invoke(ser, data, success, failure);
            }
          }

          return deadImpl.invoke(data, success, failure);
        },
        invokeSync: function(ser, data) {
          if (/^https?:/.test(ser)) {
            return makeSyncAjax(ser, data);
          }
          var instID = decodeInstID(ser);
          if(instID == me.instanceID) {
            return me._getImpl(ser).invokeSync(data);
          } else {
            var publicInterface = me.resolver(instID);
            if(publicInterface) {
              return publicInterface.invokeSync(ser, data);
            }
          }

          return deadImpl.invokeSync(data);
        }
      });
    })(this);
  };
  
  CapServer.prototype._mint = function(capID) {
    var ser = encodeSerialization(this.instanceID, capID);
    var cap = Object.freeze(new Capability(ser, this.publicInterface));
    return cap;
  };
  
  CapServer.prototype._getImpl = function(ser) {
    var capID = decodeCapID(ser);
    if (! (capID in this.implMap)) {
      var info = this.reviveMap[capID];
      if (info) {
        if (info.restoreKey) {
          if (this.reviver) {
            var item = this.reviver(info.restoreKey);
            this.implMap[capID] = buildImplementation(item);
          }
        }
        else if (info.restoreCap) {
          var innerCap = this.restore(info.restoreCap);
          this.implMap[capID] = new ImplWrap(innerCap);
        }
      }
    }
    return this.implMap[capID] || deadImpl;
  };
  
  CapServer.prototype.grant = function(item, key) {
    var capID = newCapID();

    this.implMap[capID] = buildImplementation(item);
    if (key) { this.reviveMap[capID] = { restoreKey: key } }
    // TODO(mzero): should save URL and cap items in reviveMap

    return this._mint(capID);
  };
  
  // TODO(jpolitz): get rid of wrap?  get rid of resolvable?
  CapServer.prototype.wrap = function(innerCap, resolvable) {
    var capID = newCapID();

    this.implMap[capID] = new ImplWrap(innerCap);
    this.reviveMap[capID] = { restoreCap: innerCap.serialize() };
    
    return this._mint(capID);
  };
  
  CapServer.prototype.revoke = function(ser) {
    var capID = decodeCapID(ser);
    delete this.reviveMap[capID];
    delete this.implMap[capID];
  };
    
  CapServer.prototype.revokeAll = function() {
    this.reviveMap = {};
    this.implMap = {};
  };
    
  CapServer.prototype.restore = function(ser) {
    return Object.freeze(new Capability(ser, this.privateInterface));
  };
  
  CapServer.prototype.setReviver = function(r) { this.reviver = r; };
  
  CapServer.prototype.snapshot = function() {
    snapshot = {
      id: this.instanceID,
      map: this.reviveMap,
    };
    return JSON.stringify(snapshot);
  };

  CapServer.prototype.setResolver = function(resolver) {
    this.resolver = resolver;
  };
  
  CapServer.prototype.dataPreProcess = function(v) {
    return JSON.stringify({ value: v }, function(k,v) {
      if (typeof(v) == 'function') {
        throw new TypeError('Passing a function');
      }
      try {
        if (Object.getPrototypeOf(v) === Capability.prototype) {
          return { '@': v.serialize() };
        }
      } catch(e) { }
      return v;
    });
  };
  
  CapServer.prototype.dataPostProcess = function(w) {
    var me = this;
    return JSON.parse(w, function(k,v){
      try {
        var k = Object.keys(v);
        if (k.length == 1 && k[0] == '@') {
          return me.restore(v['@']);
        }
      }
      catch(e) { }
      return v;
    }).value;
  };
  
  
  var CapTunnel = function(port) {
    var me = this;

    this.port = port;
    this.localResolver = function(instID) { return null; };
    this.remoteResolverProxy = function(instID) { return me.sendInterface; };
    this.transactions = {};
    this.txCounter = 1000;

    this.sendInterface = Object.freeze({
      invoke: function(ser, d, s, f) { me.sendInvoke(ser, d, s, f); },
      invokeSync: function(ser, d) { throw "Can't invokeSync through a tunnel"; }
      });

    port.onmessage = function(event) {
      var message = event.data;
      if (message.op == "invoke")         { me.handleInvoke(message); }
      else if (message.op == "response")  { me.handleResponse(message); }
    }
  };

  CapTunnel.prototype.sendInvoke = function(ser, data, success, failure) {
    var txID = this.txCounter++;
    this.transactions[txID] = { success: success, failure: failure };
    this.port.postMessage({
      op: "invoke",
      txID: txID,
      ser: ser,
      data: this.toWire(data)
    });
    // TODO(mzero): something with a timeout
  };
  
  CapTunnel.prototype.handleInvoke = function(message) {
    var iface = this.localResolver(decodeInstID(message.ser));
    if (iface) {
      var me = this;
      iface.invoke(message.ser, this.fromWire(message.data),
          function(data) { me.sendResponse(message.txID, "success", data); },
          function(err) { me.sendResponse(message.txID, "failure", err); });
    } else {
      this.sendResponse(message.txID, "failure", { status: 404 });
    }
  };
  
  CapTunnel.prototype.sendResponse = function(txID, type, data) {
    this.port.postMessage({
      op: "response",
      txID: txID,
      type: type,
      data: this.toWire(data)
    });
  };
  
  CapTunnel.prototype.handleResponse = function(message) {
    var tx = this.transactions[message.txID];
    if (tx) {
      delete this.transactions[message.txID];
      if (message.type == "success") {
        if (tx.success) { tx.success(this.fromWire(message.data)); }
      }
      if (message.type == "failure") {
        if (tx.failure) { tx.failure(this.fromWire(message.data)); }
      }
    }
  };

  CapTunnel.prototype.toWire = function(data) { return data; }
  CapTunnel.prototype.fromWire = function(data) { return data; }

  CapTunnel.prototype.setLocalResolver = function(resolver) {
    this.localResolver = resolver;
  };



  return {
    CapServer: CapServer,
    CapTunnel: CapTunnel
  };
})();

var CapServer = CAP_EXPORTS.CapServer;
var CapTunnel = CAP_EXPORTS.CapTunnel;

