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

var CapServer = (function() {
  
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
  var decodeCapID = function(ser) {
    var m = decodeSerialization(ser);
    return m[1];
  }
  
  var nullCapID = "urn:x-cap:00000000-0000-0000-0000-000000000000";
  
  var callAsAJAX = function(f, data, success, failure) {
    setTimeout(function() {
      try {
          var response;
          response = f(data);
          if(success) success(response);
      }
      catch(e) {
          if(failure) failure({status: 500, 
                               message: "exception thrown"});
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
  
  
  
  
  
  
  
  
  
  var Capability = function(capID, ser, iface) {
    this.capID = capID;
    this.ser = ser;
    this.iface = iface;
  };
  Capability.prototype.invoke = function(data, success, failure) {
    // TODO(mzero): should check if iface is dead, and if so, re-resolve it
    this.iface.invoke(this.ser, data, success, failure);
  };
  Capability.prototype.invokeSync = function(data) {
    // TODO(mzero): should check if iface is dead, and if so, re-resolve it
    return this.iface.invokeSync(this.ser, data);
  };
  Capability.prototype.serialize = function() {
    return this.ser;
  }
  Capability.prototype.getCapID = function() {
    // TODO(mzero): this is here for unit testing... not sure it should be
    return this.capID;
  }

  
  // FIXME(mzero): this is bork'd (definitely)
  var deadCap = Object.freeze(new Capability(nullCapID, nullCapID, deadImpl));
  
  
  
  var CapServer = function(snapshot) {
    this.reviveMap = {};  // map capID -> key or cap or url
    this.implMap = {};    // map capID -> impls
    this.capMap = {};     // map capID -> caps
    this.resolver = null;
    this.instanceID = newUUIDv4();
    this.instanceResolver = function(id) { return null; };
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
  };
  
  CapServer.prototype._mint = function(capID) {
    if (capID in this.capMap) {
      return this.capMap[capID];
    }
    var ser = encodeSerialization(this.instanceID, capID);
    var cap = Object.freeze(new Capability(capID, ser, this.publicInterface));
    this.capMap[capID] = cap;
    return cap;
  }
  
  CapServer.prototype._getImpl = function(ser) {
    var capID = decodeCapID(ser);
    if (! (capID in this.implMap)) {
      this.revive(capID);
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
    delete this.capMap[capID];
  };
    
  CapServer.prototype.revokeAll = function() {
    this.reviveMap = {};
    this.implMap = {};
    this.capMap = {}
  };
    
  CapServer.prototype.restore = function(ser) {
    if (/^https?:/.test(ser)) {
      return this.grant(ser);
    }
    var m = decodeSerialization(ser);
    if (m) {
      var instID = m[0];
      var capID = m[1];
      var instServer = 
        (instID == this.instanceID) ? this : this.instanceResolver(instID);

      if (instServer) {
        return instServer.revive(capID);        
      }
    }
    return deadCap;
  };
  
  CapServer.prototype.revive = function(capID) {
    if (! (capID in this.implMap)) {
      var info = this.reviveMap[capID];
      if (info) {
        if (info.restoreKey) {
          if (this.resolver) {
            var item = this.resolver(info.restoreKey);
            this.implMap[capID] = buildImplementation(item);
          }
        }
        else if (info.restoreCap) {
          var innerCap = this.restore(info.restoreCap);
          this.implMap[capID] = new ImplWrap(innerCap);
        }
      }
    }
    
    return this._mint(capID);
  };
    
  CapServer.prototype.setResolver = function(r) { this.resolver = r; };
  
  CapServer.prototype.snapshot = function() {
    snapshot = {
      id: this.instanceID,
      map: this.reviveMap,
    };
    return JSON.stringify(snapshot);
  };

  CapServer.prototype.setInstanceResolver = function(resolver) {
    this.instanceResolver = resolver;
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
  
  return CapServer;
})();
