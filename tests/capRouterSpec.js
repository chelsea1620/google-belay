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

function createEndPoint(router) {
  var instanceId = newUUIDv4();
  var server = new CapServer(instanceId);
  router.addInterface(instanceId, server.publicInterface);
  server.setResolver(router.resolver);
  return server;
}

describe('CapRouter', function() {
  var router;

  beforeEach(function() {
    localStorage.clear();
    router = new CapRouter();
  });

  afterEach(function() {
    router.close();
    localStorage.clear();
  });

  describe('intra-frame access', function() {
    var s1;
    var s2;

    beforeEach(function() {
      s1 = createEndPoint(router);
      s2 = createEndPoint(router);
    });

    it('should invoke', function() {
      var c1 = s1.grant(function(x) { return 'c1 got ' + x; });
      var c2 = s2.restore(c1.serialize());

      var runner = new InvokeRunner(c2);
      runner.runsPostAndExpect('moo', 'c1 got moo');
    });

    it('should handle failure', function() {
      var c1 = s1.grant(function(d, sk, fk) {
          setTimeout(function() { fk({ status: 404 }); }, 0);
      });
      var c2 = s2.restore(c1.serialize());

      var runner = new InvokeRunner(c2);
      runner.runsGetAndExpectFailure();
    });

    it('should report routability correctly', function() {
      var knownId = s1.instanceId;
      expect(router.isRoutable(knownId)).toBeTruthy();

      var unknownId = newUUIDv4();
      expect(router.isRoutable(unknownId)).toBeFalsy();
    });
  });

  describe('inter-frame access', function() {
    var localServer;
    var startId;
    var iframe;
    var ready;
    var remoteCaps;

    function setRemoteCaps(v) { ready = true; remoteCaps = v; }

    beforeEach(function() {
      localServer = createEndPoint(router);

      startId = newUUIDv4();
      iframe = document.createElement('iframe');
      iframe.src = 'remote.html';
      iframe.name = startId;

      ready = false;
      var s = localServer.grant(setRemoteCaps);
      router.storeStart(startId, { announce: s });

      document.body.appendChild(iframe);
      waitsFor(function() { return ready; }, 'start timeout', 1000);
    });

    afterEach(function() {
      if (iframe) {
        document.body.removeChild(iframe);
        iframe = undefined;
      }
    });

    it('should simply invoke', function() {
      var r = new InvokeRunner(remoteCaps.simple);
      r.runsPostAndExpect('answer', 42);
    });

    it('should invoke deferred', function() {
      var r = new InvokeRunner(remoteCaps.simpleAsync);
      r.runsPostAndExpect('answer', 42);
      r.runsPostAndExpect('defer', 99);
      r.runsPost('fail');
      r.runsExpectFailure();
    });

    // TODO(mzero): missing timeout test

    it('should callback', function() {
      var x = 0;
      var setx = function(v) { x = v; }

      var r = new InvokeRunner(remoteCaps.callBackWithThree);
      r.runsPostAndExpect(localServer.grant(setx), 32);
      runs(function() { expect(x).toEqual(3); });
    });

    it('should propagate results', function() {
      function okay(v, sk, fk) {
        setTimeout(function() { sk(v + 1); }, 0);
      }
      function fail(v, sk, fk) {
        setTimeout(function() { fk({status: 404}); }, 0);
      }

      var r = new InvokeRunner(remoteCaps.callBackLaterWithNine);
      r.runsPostAndExpect(localServer.grant(okay), 10);
      r.runsPost(localServer.grant(fail));
      r.runsExpectFailure();
    });

    it('should timeout a request to a non-existent instanceId', function() {
      var disconnectedServer = new CapServer(newUUIDv4());
      var c0 = disconnectedServer.grant(function() { return 0; });

      var c1 = localServer.restore(c0.serialize());

      var runner = new InvokeRunner(c1);
      runner.runsGetAndExpectFailure();
    });

    it('should report routability correctly', function() {
      var remoteId = remoteCaps.instanceId;

      runs(function() {
        expect(router.isRoutable(remoteId)).toBeTruthy();

        document.body.removeChild(iframe);
        iframe = undefined;

        // immediately we expect it to still appear routable
        expect(router.isRoutable(remoteId)).toBeTruthy();
      });

      // within 1 second we expect it to not be
      waitsFor(function() {
          return !(router.isRoutable(remoteId, 900));
        }, 'waiting to not be routable', 1000);

      runs(function() {
        expect(router.isRoutable(remoteId, 500)).toBeFalsy();
        expect(router.isRoutable(remoteId, 5000)).toBeTruthy();
      });
    });
  });

  describe('misc. functionality', function() {
    it('should clear out old messages', function() {
      router.expireMessages(-1);
      expect(localStorage.length).toEqual(0);

      var t = Date.now();
      var oldKey = ['lsm', 'test', 'old'].join(',');
      var newKey = ['lsm', 'test', 'new'].join(',');
      localStorage.setItem(oldKey, JSON.stringify({ t: t - 2000 }));
      localStorage.setItem(newKey, JSON.stringify({ t: t - 1000 }));
      expect(localStorage.length).toEqual(2);

      router.expireMessages(1500);
      expect(localStorage.length).toEqual(1);

      router.expireMessages(500);
      expect(localStorage.length).toEqual(0);
    });

    it('should handle start messages', function() {
      var id = newUUIDv4();

      var m1 = router.retrieveStart(id);
      expect(m1).toBeNull();

      router.storeStart(id, { a: 42, b: 'Hello' });
      var m2 = router.retrieveStart(id);
      expect(m2).not.toBeNull();
      expect(m2.a).toEqual(42);
      expect(m2.b).toEqual('Hello');

      var m3 = router.retrieveStart(id);
      expect(m3).toBeNull();
    });
  });

});

