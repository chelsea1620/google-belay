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
  
  var nullCapID = "urn:x-cap:00000000-0000-0000-0000-000000000000";
  
  var emptyXHR = undefined; // should be a frozen structure
  
  var callAsAJAX = function(f, opts) {
    var type = opts.type || 'GET';
    var request = opts.data;
    setTimeout(function() {
      var response;
      var ok = true;
      if (type == 'GET')        response = f();
      else if (type == 'PUT')   f(request);
      else if (type == 'POST')  response = f(request);
      else                      ok = false;
      
      if (ok) {
        if (opts.success) opts.success(response, "success", {});
        if (opts.complete) opts.complete({}, "success");
      }
      else {
        if (opts.error) opts.error({}, "error", undefined);
        if (opts.complete) opts.complete({}, "error");
      }
    }, 0);
  }
  
  var errorAsAJAX = function(opts) {
    setTimeout(function() {
      if (opts.error) opts.error({}, "error", undefined);
      if (opts.complete) opts.complete("error", {});
    }, 0);
  }
  
  var makeAsyncAJAX = function(url, opts) {
    opts.url = url;
    jQuery.ajax(opts);
    // TODO(mzero): this probably needs more sanitization options
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
    invoke:     function(opts) { errorAsAJAX(opts); },
    invokeSync: function(v) { return undefined; },
  });

  var ImplFunction = function(f) { this.f = f; }
  ImplFunction.prototype.invoke = function(opts) { callAsAJAX(this.f, opts); };
  ImplFunction.prototype.invokeSync = function(v) { return this.f(v); };

  var ImplURL = function(url) { this.url = url; }
  ImplURL.prototype.invoke = function(opts) { makeAsyncAJAX(this.url, opts); };
  ImplURL.prototype.invokeSync = function(v) { return makeSyncAJAX(this.url, 'POST', v); };
  
  var ImplWrap = function(innerCap) { this.inner = innerCap; }
  ImplWrap.prototype.invoke = function(opts) { this.inner.invoke(opts); }
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
  Capability.prototype.invoke = function(opts) {
    // TODO(mzero): should check if iface is dead, and if so, re-resolve it
    this.iface.invoke(this.capID, opts);
  };
  Capability.prototype.invokeSync = function(v) {
    // TODO(mzero): should check if iface is dead, and if so, re-resolve it
    return this.iface.invokeSync(this.capID, v);
  };
  Capability.prototype.revoke = function() {
    // TODO(mzero): this is probably not right to have available
    this.iface.revoke(this);
  }
  Capability.prototype.serialize = function() {
    return this.ser;
  }
  Capability.prototype.getCapID = function() {
    // TODO(mzero): this is here for unit testing... not sure it should be
    return this.capID;
  }

  
  // FIXME(mzero): this is bork'd (maybe?)
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
    
    this.externalInterface = (function(me) {
      return Object.freeze({
        invoke: function(capID, opts) { me._getImpl(capID).invoke(opts); },
        invokeSync: function(capID, v) { return me._getImpl(capID).invokeSync(v); },
        revoke: function(cap) { me.revoke(cap); }
      });
    })(this);

    this.publicInterface = (function(me) {
      return Object.freeze({
        invoke: function(ser, data, success, failure) {
          var m = decodeSerialization(ser);
          var capID = m[1];
          var opts = { success: function(data, status, xhr) { success(data); },
                       failure: function(xhr, status, message) { 
                                  failure({status: status,
                                           message: message});
                                },
                       data: data,
                       type: 'POST' };
          me._getImpl(capID).invoke(opts);

      }});
    })(this);
  };
  
  CapServer.prototype._mint = function(capID) {
    if (capID in this.capMap) {
      return this.capMap[capID];
    }
    var ser = encodeSerialization(this.instanceID, capID);
    var cap = Object.freeze(new Capability(capID, ser, this.externalInterface));
    this.capMap[capID] = cap;
    return cap;
  }
  
  CapServer.prototype._getImpl = function(capID) {
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
  
  CapServer.prototype.revoke = function(cap) {
    var capID = cap.capID;
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
