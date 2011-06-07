var InstanceManager = function() {
  this.instances = [];
  var my = this
  // TODO(mzero): better be only one of these, either assert or make work with multiple
  window.addEventListener('message', function(e) {
    for (i in my.instances) {
      if (e.source == my.instances[i].window) {
        return my.instances[i].handleMessage(e);
      }
    }
    return false;
  });
};

InstanceManager.prototype.openWindowed = function(url) {
  var w = window.open(url, '_blank');
  // TODO(mzero): only works if the user has allowed pop-ups!
  var i = new InstanceManager.Instance(w);
  this.instances.push(i);
  setTimeout(function() { i.noResponse(); }, 250);
  return i;
};

InstanceManager.prototype.closeAll = function() {
  for (i in this.instances) {
    this.instances[i].close();
  }
};

InstanceManager.Instance = function(window) {
  this.window = window;
  this.ready = false;
  this.dead = false;
};

InstanceManager.Instance.prototype.initialized = function() {
  return this.ready || this.dead;
};

InstanceManager.Instance.prototype.noResponse = function() {
  this.dead = true;
};

InstanceManager.Instance.prototype.handleMessage = function(e) {
  if (e.data == "ready") {
    this.ready = true;
    return true;
  }
  return false;
};

InstanceManager.Instance.prototype.close = function() {
  this.window.close();
};

describe("WindowedInstances", function() {
  var instanceManager;
  
  beforeEach(function() {
    instanceManager = new InstanceManager();
  })
  
  afterEach(function() {
    instanceManager.closeAll();
  })
  
  it("should timeout waiting for a broken window", function() {
    var i = instanceManager.openWindowed(''); // empty string defaults to about:blank
    waitsFor(function() { return i.initialized(); }, "initialized timeout", 1000);
    runs(function() {
      expect(i.ready).not.toBeTruthy();
      expect(i.dead).toBeTruthy();
    });
  });
  
  it("should communicate to a new window", function() {
    var i = instanceManager.openWindowed("file://localhost/Users/mzero/Projects/belay-ses/tests/testInstance.html");
    
    waitsFor(function() { return i.initialized(); }, "initialized timeout", 1000);
    runs(function() {
      expect(i.ready).toBeTruthy();
      expect(i.dead).not.toBeTruthy();
    });
  })
  
});
