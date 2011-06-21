describe('CapTunnels', function() {
  var tunnel;

  beforeEach(function() {
    var remotePort = windowManager.open('testInstance.html', 'test_window');
    tunnel = new CapTunnel(remotePort);
    waitsFor(function() { return remotePort.ready(); },
        'ready timeout', 1000);
  });

  afterEach(function() {
    windowManager.closeAll();
    tunnel = null;
  });

  it('should get notice of a new window', function() {
    runs(function() {
      expect(tunnel).toBeDefined();
      expect(tunnel).not.toBe(null);
    });
  });


  describe('with local capservers', function() {
    var localServer1, localServer2;

    beforeEach(function() {
      waitsFor(function() { return tunnel.outpost; },
          'outpost read timeout', 1000);

      runs(function() {
        expect(typeof tunnel.outpost.instID).toEqual('string');
        expect(typeof tunnel.outpost.seedSer).toEqual('string');

        localServer1 = new CapServer();
        localServer2 = new CapServer();

        var ifaceMap = {};
        ifaceMap[tunnel.outpost.instID] = tunnel.sendInterface;
        ifaceMap[localServer1.instanceID] = localServer1.publicInterface;
        ifaceMap[localServer2.instanceID] = localServer2.publicInterface;

        var resolver = function(instID) { return ifaceMap[instID] || null; };
        tunnel.setLocalResolver(resolver);
        localServer1.setResolver(resolver);
        localServer2.setResolver(resolver);
      });
    });

    it('should be able to invoke a remote cap', function() {
      var result;
      var done = false;
      runs(function() {
        var remoteSeedCap = localServer1.restore(tunnel.outpost.seedSer);
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
        var remoteSeedCap = localServer1.restore(tunnel.outpost.seedSer);
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
        var remoteSeedCap = localServer1.restore(tunnel.outpost.seedSer);
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
