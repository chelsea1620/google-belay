var InstanceManager = function() {
  this.instances = [];
  var my = this
  // TODO(mzero): better be only one of these, either assert or make work with multiple
  window.addEventListener('message', function(e) {
    for (i in my.instances) {
      if (e.source == my.instances[i].window) {
        e.data.port = e.ports[0];
        return my.instances[i].windowReady(e.data);
      }
    }
    return false;
  });
};

var instanceManager = new InstanceManager();

InstanceManager.prototype.openWindowed = function(url) {
  var w = window.open(url, 'testInstance');
  // TODO(mzero): only works if the user has allowed pop-ups!
  var i = new InstanceManager.Instance(w);
  this.instances.push(i);
  return i;
};

InstanceManager.prototype.closeAll = function() {
  for (i in this.instances) {
    this.instances[i].close();
  }
  this.instances = [];
};

InstanceManager.Instance = function(window) {
  this.window = window;
  this.ready = false;
  this.remoteInstID = null;
  this.initialSer = null;
  this.tunnel = null;
};

InstanceManager.Instance.prototype.initialized = function() {
  return this.ready;
};

InstanceManager.Instance.prototype.windowReady = function(data) {
  this.remoteInstID = data.instID;
  this.initialSer = data.ser;
  this.ready = true;
  this.tunnel = new CapTunnel(data.port);
};

InstanceManager.Instance.prototype.close = function() {
//  this.window.close();
};

describe("CapTunnels", function() {

  var instance;
  
  beforeEach(function() {
    instance = instanceManager.openWindowed("file:///home/jpolitz/src/google-belay/tests/testInstance.html");
  });
  
  afterEach(function() {
    instanceManager.closeAll();
    instance = null;
  });
  
  it("should get notice of a new window", function() {
    
    waitsFor(function() { return instance.initialized(); }, "initialized timeout", 1000);
    runs(function() {
      expect(instance.ready).toBeTruthy();
      expect(typeof instance.initialSer).toEqual("string");
      expect(typeof instance.remoteInstID).toEqual("string");
      expect(typeof instance.tunnel).not.toBe(null);
    });
  });
     
  
  it("should be able to invoke a remote cap", function() {
    waitsFor(function() { return instance.initialized(); }, "initialized timeout", 1000);
    var localServer;
    var localCap;
    var result;
    var done = false;
    runs(function() { 
      localServer = new CapServer();
      localCap = localServer.restore(instance.initialSer);
      localServer.setResolver(function(instID) {
        if(instID === instance.remoteInstID) {
          return instance.tunnel.sendInterface;
        }
        return null;
      });
      localCap.invoke(45, 
                      function(data) { result = data; done = true; },
                      function(err) { done = true; })
    });
    waitsFor(function() { return done; }, "invoke timeout", 250);
    runs(function() { expect(result).toEqual(55); });
  });

});
