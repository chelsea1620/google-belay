var InstanceManager = function() {
  this.instances = [];
  var my = this;
  // TODO(mzero): better be only one of these, should assert that
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

describe('CapTunnels', function() {
  var instance;

  beforeEach(function() {
    instance = instanceManager.openWindowed('testInstance.html');
    waitsFor(function() { return instance.initialized(); },
        'initialized timeout', 1000);
  });

  afterEach(function() {
    instanceManager.closeAll();
    instance = null;
  });

  it('should get notice of a new window', function() {
    runs(function() {
      expect(instance.ready).toBeTruthy();
      expect(typeof instance.initialSer).toEqual('string');
      expect(typeof instance.remoteInstID).toEqual('string');
      expect(typeof instance.tunnel).not.toBe(null);
    });
  });


  describe('with local capservers', function() {
    var localServer1, localServer2;

    beforeEach(function() {
      localServer1 = new CapServer();
      localServer2 = new CapServer();

      var ifaceMap = {};
      ifaceMap[instance.remoteInstID] = instance.tunnel.sendInterface;
      ifaceMap[localServer1.instanceID] = localServer1.publicInterface;
      ifaceMap[localServer2.instanceID] = localServer2.publicInterface;

      var resolver = function(instID) { return ifaceMap[instID] || null; };
      instance.tunnel.setLocalResolver(resolver);
      localServer1.setResolver(resolver);
      localServer2.setResolver(resolver);
    });

    it('should be able to invoke a remote cap', function() {
      var result;
      var done = false;
      runs(function() {
        var remoteSeedCap = localServer1.restore(instance.initialSer);
        remoteSeedCap.invoke('answer',
          function(data) { result = data; done = true; },
          function(err) { done = true; });
      });
      waitsFor(function() { return done; }, 'invoke timeout', 250);
      runs(function() { expect(result).toEqual(42); });
    });

    it('should be able to invoke a local cap from the remote side', function() {
      var invokeWithThreeCap;
      runs(function() {
        var remoteSeedCap = localServer1.restore(instance.initialSer);
        remoteSeedCap.invoke('invokeWithThree',
          function(data) { invokeWithThreeCap = data; },
          function(err) { });
      });
      waitsFor(function() { return invokeWithThreeCap; },
          'get invokeWithThree cap', 250);

      var received = false;
      var succeeded = false;
      var receivedMessage;
      var threeResult;
      runs(function() {
        var receiveCap = localServer1.grant(function(v) {
          received = true;
          receivedMessage = v;
          return v + 42;
        });
        invokeWithThreeCap.invoke(receiveCap,
          function(result) {
             succeeded = true;
             threeResult = result;
          },
          function(result) {
          });
      });
      waitsFor(function() { return received; },
          'invoking invokeWithThree cap', 250);
      runs(function() {
        expect(receivedMessage).toEqual(3);
  expect(succeeded).toBe(true);
  expect(threeResult).toBe(32);
      });
    });

    it('should be able to invoke remote caps in async-mode', function() {
      /* receiveCap = function(v) { return v + 42; };
       * asyncResult =
       *   remoteSeedCap.invoke("remoteAsync").invoke(receiveCap)
       *
       * expect(force(asyncResult)).toBe(1041)
       *
       */

      var remoteAsyncCap;
      runs(function() {
        var remoteSeedCap = localServer1.restore(instance.initialSer);
        remoteSeedCap.invoke('remoteAsync',
          function(data) { remoteAsyncCap = data; },
          function(err) { });
      });

      waitsFor(function() { return remoteAsyncCap; },
               'get remoteAsync cap', 250);

      var asyncResult = false;
      var messageFromRemote = false;

      runs(function() {
        var receiveCap = localServer1.grant(function(v) {
          messageFromRemote = [v];
          return v + 42;
        });
        remoteAsyncCap.invoke(receiveCap,
                  function(v) { asyncResult = [v]; },
            function(result) { });
      });
      waitsFor(function() { return asyncResult && messageFromRemote; },
               'get asyncResult', 250);
      runs(function() {
        expect(messageFromRemote[0]).toEqual(999);
  expect(asyncResult[0]).toBe(1041);
      });

    });
  });
});
