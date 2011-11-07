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

function createRemoteEnd(port) {
  var tunnel = new CapTunnel(port);
  var server = new CapServer(newUUIDv4());
  tunnel.setLocalResolver(function(instID) {
    return server.publicInterface;
  });
  server.setResolver(tunnel.remoteResolverProxy);
  
  var invokeWithThreeCap = server.grant(function(v) {
    v.post(3);
    return 32;
  });

  var invokeMyAsync = 
    server.grant(function(remoteReceiveCap, sk, fk) {
      setTimeout(function() { remoteReceiveCap.post(999, sk, fk); }, 0);
    });
  
  var seedCap = server.grant(function(v) { 
    if (v == "answer") { return 42; }
    if (v == "invokeWithThree") { return invokeWithThreeCap; }
    if (v == "remoteAsync") { return invokeMyAsync; }
    return undefined;
  });

  var seedAsyncCap = server.grant(function(v, sk, fk) {
    if (v == 'ignore') { return; }
    return;
  })

  var outpost = {
      instID: server.instanceID,
      seeds: [ seedCap, seedAsyncCap ]
  };

  setTimeout(function() {
    tunnel.sendOutpost(outpost);
  }, 10);
}

describe('CapTunnels', function() {
  var tunnel;

  beforeEach(function() {
    var channel = new MessageChannel();
    createRemoteEnd(channel.port1)
    tunnel = new CapTunnel(channel.port2);
  });

  afterEach(function() {
    tunnel = null;
  });

  describe('with local capservers', function() {
    var localServer1;

    var outpostData;
    beforeEach(function() {
      outpostData = false;
      tunnel.setOutpostHandler(function(msg) { outpostData = msg; });
      waitsFor(function() { return outpostData; },
          'outpost read timeout', 1000);

      runs(function() {
        localServer1 = new CapServer(newUUIDv4());

        expect(typeof outpostData.instID).toEqual('string');
        expect(outpostData.seeds.length).toEqual(2);
        expect(typeof outpostData.seeds[0]).toEqual('object');
        expect(typeof outpostData.seeds[1]).toEqual('object');

        var ifaceMap = {};
        ifaceMap[outpostData.instID] = tunnel.sendInterface;
        ifaceMap[localServer1.instanceID] = localServer1.publicInterface;

        var resolver = function(instID) { return ifaceMap[instID] || null; };
        tunnel.setLocalResolver(resolver);
        localServer1.setResolver(resolver);
      });
    });

    it('should be able to invoke a remote cap', function() {
      var result;
      var done = false;
      runs(function() {
        var remoteSeedCap = outpostData.seeds[0];
        remoteSeedCap.post('answer',
          function(data) { result = data; done = true; },
          function(err) { done = true; });
      });
      waitsFor(function() { return done; }, 'invoke timeout', 250);
      runs(function() { expect(result).toEqual(42); });
    });

    it('should fail pending invokes on tunnel death', function() {
      var successCalled = false;
      var failureCalled = false;
      runs(function() {
        var remoteAsyncSeedCap = outpostData.seeds[1];
        remoteAsyncSeedCap.post('ignore',
          function(data) { successCalled = true; },
          function(err) { failureCalled = true; });
        setTimeout(function() { tunnel.handleClose(); }, 50);
      });
      waitsFor(function() { return successCalled || failureCalled; },
        'invoke timeout', 250);
      runs(function() {
        expect(successCalled).toEqual(false);
        expect(failureCalled).toEqual(true);
      });
    });

    it('should be able to invoke a local cap from the remote side', function() {
      var invokeWithThreeCap;
      runs(function() {
        var remoteSeedCap = outpostData.seeds[0];
        remoteSeedCap.post('invokeWithThree',
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
        invokeWithThreeCap.post(receiveCap,
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
        var remoteSeedCap = outpostData.seeds[0];
        remoteSeedCap.post('remoteAsync',
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
        remoteAsyncCap.post(receiveCap,
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
