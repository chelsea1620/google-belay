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

describe('WindowManager', function() {
  var remotePort;
  var receivedMessages;
  var onmessage = function(e) { receivedMessages.push(e.data); };

  beforeEach(function() {
    remotePort = undefined;
    receivedMessages = [];
  });

  afterEach(function() {
    windowManager.closeAll();
  });

  var runsTestWindow = function(localVariant, q) {
    runs(function() {
      remotePort = windowManager.open('testWindow.html?' + q, 'test_window');
      remotePort.onmessage = onmessage;
    });
  };

  var runsExpectReceive = function(r) {
    waitsFor(function() { return receivedMessages.length >= r.length; },
      'receive ' + r.length + ' messages', 250);
    runs(function() {
      expect(receivedMessages.length).toEqual(r.length);
      expect(receivedMessages).toEqual(r);
    });
  }

  it('should launch a new window', function() {
    runsTestWindow('', '');
  });

  var testExchange = function(localVariant, remoteVariant) {
    describe('Communication pattern ' + localVariant + '/' + remoteVariant,
      function() {
        it('should L->R, R->L (1 roundtrip)', function() {
          runsTestWindow(localVariant, remoteVariant);
          runs(function() { remotePort.postMessage('alpha'); });
          runsExpectReceive(['got alpha']);
        });

        it('should R->L, L->R, R->L', function() {
          runsTestWindow(localVariant, 'sendFirst;' + remoteVariant);
          runsExpectReceive(['hello']);
          runs(function() { remotePort.postMessage('alpha'); });
          runsExpectReceive(['hello', 'got alpha']);
        });

        // The tests below are really just paranoid testing of the browser
        // implementation of ports. There is no point to running these all
        // the time.
        xit('should L->R, R->L, L->R, R->L (2 roundtrips)', function() {
          runsTestWindow(localVariant, remoteVariant);
          runs(function() { remotePort.postMessage('alpha'); });
          runsExpectReceive(['got alpha']);
          runs(function() { remotePort.postMessage('beta'); });
          runsExpectReceive(['got alpha', 'got beta']);
        });

        xit('should R->L, (L->R, R->L)x2', function() {
          runsTestWindow(localVariant, 'sendFirst;' + remoteVariant);
          runsExpectReceive(['hello']);
          runs(function() { remotePort.postMessage('alpha'); });
          runsExpectReceive(['hello', 'got alpha']);
          runs(function() { remotePort.postMessage('beta'); });
          runsExpectReceive(['hello', 'got alpha', 'got beta']);
        });

        xit('should L->R, R->L (1 roundtrip)', function() {
          runsTestWindow(localVariant, remoteVariant);
          runs(function() { remotePort.postMessage({a: 42, b: 3}); });
          runsExpectReceive(['got [object Object]']);
        });

    });
  };

  testExchange('localImmediate', 'remoteImmediate');
  testExchange('localImmediate', 'remoteDelayed');
});


describe('CapTunnels', function() {
  var tunnel;

  beforeEach(function() {
    var remotePort = windowManager.open('testInstance.html', 'test_window');
    tunnel = new CapTunnel(remotePort);
  });

  afterEach(function() {
    windowManager.closeAll();
    tunnel = null;
  });

  describe('with local capservers', function() {
    var localServer1;

    var outpostMessage, outpostData;
    beforeEach(function() {
      outpostMessage = false;
      tunnel.setOutpostHandler(function(msg) { outpostMessage = msg; });
      waitsFor(function() { return outpostMessage; },
          'outpost read timeout', 1000);

      runs(function() {
        localServer1 = new CapServer(newUUIDv4());

        outpostData = localServer1.dataPostProcess(outpostMessage);

        expect(typeof outpostData.instID).toEqual('string');
        expect(outpostData.seedSers.length).toEqual(1);
        expect(typeof outpostData.seedSers[0]).toEqual('object');

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
        var remoteSeedCap = outpostData.seedSers[0];
        remoteSeedCap.post('answer',
          function(data) { result = data; done = true; },
          function(err) { done = true; });
      });
      waitsFor(function() { return done; }, 'invoke timeout', 250);
      runs(function() { expect(result).toEqual(42); });
    });

    it('should be able to invoke a local cap from the remote side', function() {
      var invokeWithThreeCap;
      runs(function() {
        var remoteSeedCap = outpostData.seedSers[0];
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
        var remoteSeedCap = outpostData.seedSers[0];
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
