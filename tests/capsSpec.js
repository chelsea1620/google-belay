var MockAjax = function() {
  this.urlMap = {};
  this.speed = 50;
  this.server = null;
};
MockAjax.prototype.clear = function() { this.urlMap = {}; };
MockAjax.prototype.setServer = function(server) { this.server = server; };
MockAjax.prototype.handle = function(url, func) { this.urlMap[url] = func; };
MockAjax.prototype.makeAjax = function() {
  var me = this;

  var reportResult = function(opts, response) {
    var f = function() {
      if (opts.success) opts.success(response, 'success', {});
      if (opts.complete) opts.complete({}, 'success');
    };

    if (opts.async) setTimeout(f, me.speed);
    else f();
  };
  var reportError = function(opts) {
    var f = function() {
      if (opts.error) opts.error({},'error', undefined);
      if (opts.complete) opts.complete({}, 'error');
    };

    if (opts.async) setTimeout(f, me.speed);
    else f();
  };

  return function(opts) {
    var url = opts.url;
    if (!(url in me.urlMap)) {
      return reportError(opts);
    }
    var f = me.urlMap[url];
    var t = opts.type || 'GET';
    var request = me.server.dataPostProcess(opts.data);
    var response;

    if (t == 'GET') response = f();
    else if (t == 'POST') response = f(request);
    else if (t == 'PUT') f(request);
    else return reportError(opts);

    return reportResult(opts, me.server.dataPreProcess(response));
  };
};
var mockAjax = new MockAjax();


var InvokeRunner = function(cap) {
  this.cap = cap;
  this.failureStatus = undefined;
  this.failureCalled = this.successCalled = false;
  this.result = 'something funky';
};
InvokeRunner.prototype.runs = function(data) {
  var me = this;
  runs(function() {
    me.failureStatus = undefined;
    me.failureCalled = me.successCalled = false;
    me.result = 'something funky';
    var failure = function(err) {
      me.failureStatus = err.status; me.failureCalled = true;
    };
    var success = function(data) {
      me.result = data; me.successCalled = true;
    };
    me.cap.post(data, success, failure);
  });
};
InvokeRunner.prototype.waits = function() {
  var me = this;
  waitsFor(function() { return me.failureCalled || me.successCalled; },
      'invoke timeout', 250);
};
InvokeRunner.prototype.expectSuccess = function(resultChecker) {
  expect(this.failureCalled).toBe(false);
  expect(this.successCalled).toBe(true);
  resultChecker(this.result);
};
InvokeRunner.prototype.expectFailure = function() {
  expect(this.failureCalled).toBe(true);
  expect(this.successCalled).toBe(false);
  expect(typeof this.failureStatus).toEqual('number');
};
InvokeRunner.prototype.runsAndWaits = function(data) {
  this.runs(data);
  this.waits();
};
InvokeRunner.prototype.runsExpectSuccess = function(resultChecker) {
  var me = this;
  runs(function() { me.expectSuccess(resultChecker); });
};
InvokeRunner.prototype.runsExpectFailure = function() {
  var me = this;
  runs(function() { me.expectFailure(); });
};



jQuery = {};
jQuery.ajax = mockAjax.makeAjax();



describe('CapServer', function() {
  var capServer1;
  var capServer2;
  var capServer3;

  beforeEach(function() {
    mockAjax.clear();
    capServer1 = new CapServer();
    capServer2 = new CapServer();
    capServer3 = new CapServer();
    mockAjax.setServer(capServer3);
  });

  it('should have built cap servers', function() {
    expect(capServer1).not.toBeNull();
    expect(capServer2).not.toBeNull();
    expect(capServer1).not.toBe(capServer2);
  });

  describe('Basic Life Cycle', function() {
    var f, c1;
    beforeEach(function() {
      f = function() { return 42; };
      c1 = capServer1.grant(f);
    });

    it('should grant', function() {
      expect(c1).not.toBeNull();
    });

    it('should invokeSync', function() {
      var r1 = c1.invokeSync();
      expect(r1).toBe(42);
    });

    it('should revoke, then not invokeSync', function() {
      capServer1.revoke(c1.serialize());
      var r1 = c1.invokeSync();
      expect(r1).not.toBeDefined();
    });

    it('should create a dead cap', function() {
      var d = capServer1.grant(null);
      expect(d.invokeSync()).not.toBeDefined();
    });

    it('should create distinct caps to same function', function() {
      var c2 = capServer1.grant(f);
      expect(c2).not.toBe(c1);
      expect(c2.serialize()).not.toEqual(c1.serialize());
      capServer1.revoke(c1.serialize());
      expect(c2.invokeSync()).toBe(42);
    });
  });

  describe('PublicInterface', function() {
    it('should support invoke', function() {
            var publicIface = capServer1.publicInterface;
            var invocableFunc;
            var cap;
            var result;
            var failed = false;
            var succeeded = false;

            invocableFunc = function(v) {
                return 'value:' + v;
            };
            cap = capServer1.grant(invocableFunc);

            runs(function() {
              publicIface.invoke(cap.serialize(),
                  'post', '{"value": "some-value"}',
                  function(data) {
                     succeeded = true;
                     result = data;
                  },
                  function(err) {
                     failed = true;
                  });});
            waitsFor(function() { return succeeded || failed; },
                     'PublicInterface invoke timeout', 250);
            runs(function() {
                    expect(result).toBe('{\"value\":\"value:some-value\"}');
                    expect(failed).toBe(false);
                    expect(succeeded).toBe(true);
                });
        });
  });

  describe('Capability Interface', function() {
    var fn;
    var fnCalledWith;
    var sk, fk;
    var result;
    var finished, succeeded, failed;
    var c1;

    var waitAndExpectResults = function(expectedResult, expectedArgument) {
      waitsFor(function() { return finished; }, 'cap timeout', 250);
      runs(function() {
        expect(succeeded).toBe(true);
        expect(result).toEqual(expectedResult);
        expect(fnCalledWith).toBe(expectedArgument);
      });
    };

    beforeEach(function() {
      fn = function(d) {
        fnCalledWith = d;
        return '*' + String(d) + '*';
      };
      c1 = capServer1.grant(fn);

      fnCalledWith = 'not-yet-called';
      result = 'no-result-yet';
      finished = succeeded = failed = false;

      sk = function(r) { result = r; finished = succeeded = true; }
      fk = function(e) { finsihed = failed = true; }
    });

    it('should pass no argument to get', function() {
      c1.get(sk, fk);
      waitAndExpectResults('*undefined*', undefined);
    });

    it('should ignore result from put', function() {
      c1.put(42, sk, fk);
      waitAndExpectResults(undefined, 42);
    });

    it('should pass results from post', function() {
      c1.post(42, sk, fk);
      waitAndExpectResults('*42*', 42);
    });

    it('should ignore argument and result for delete', function() {
      c1.delete(sk, fk);
      waitAndExpectResults(undefined, undefined);
    });

    xit('should ignore the argument to get', function() {
      var failed = false;
      c1.invoke('get', 42, null,
          function(err) { failed = true; });
      waitsFor(function() { return failed; }, 'get timeout', 250);
      runs(function() { expect(failed).toBe(true); });
    });



  });

  describe('Invocation', function() {
    var invocableFunc;
    var invocableURL;
    var invocableWrappedFunc;
    var invocableWrappedURL;
    var invocableAsyncFunc;
    var invocableWrappedAsyncFunc;
    beforeEach(function() {
      var d = 0;
      invocableFunc = function(v) {
        if (v) d = v;
        return '#' + d;
      };
      invocableURL = 'http://example.com/noodle';
      mockAjax.handle(invocableURL, invocableFunc);
      invocableWrappedFunc = capServer2.grant(invocableFunc);
      invocableWrappedURL = capServer2.grant(invocableURL);
      invocableAsyncFunc = function(v, sk, fk) {
  if (v === 'error') {
    fk(v);
    return;
  }

  if (v === 'exception') {
    throw v;
  }

  if (v) {
     d = v;
  }
  sk('#' + d);
  return;
      };
      invocableWrappedAsyncFunc = capServer2.grantAsync(invocableAsyncFunc);
    });


    var describeInvocation = function(name, makeItem) {
      describe(name, function() {
        var c1;
        beforeEach(function() {
          c1 = capServer1.grant(makeItem());
        });

        it('should do synchronous calls', function() {
          var rGet0 = c1.invokeSync();
          var rSet1 = c1.invokeSync(7);
          var rGet1 = c1.invokeSync();
          var rSet2 = c1.invokeSync(11);
          var rGet2 = c1.invokeSync();

          expect(rGet0).toBe('#0');
          expect(rSet1).toBe('#7');
          expect(rGet1).toBe('#7');
          expect(rSet2).toBe('#11');
          expect(rGet2).toBe('#11');
        });

        it('should do asynchronous calls (grant)', function() {
          var invoker = new InvokeRunner(c1);

          invoker.runsAndWaits();
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#0'); });

          invoker.runsAndWaits(7);
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#7'); });

          invoker.runsAndWaits(11);
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#11'); });

          invoker.runsAndWaits();
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#11'); });
        });
      });
    };

    var describeAsyncInvocation = function(name, makeAsyncItem) {
      describe(name, function() {
        var c1;
        beforeEach(function() {
          c1 = capServer1.grantAsync(makeAsyncItem());
        });

        it('should do asynchronous calls (grantAsync)', function() {
          var invoker = new InvokeRunner(c1);

          invoker.runsAndWaits();
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#0'); });

          invoker.runsAndWaits(7);
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#7'); });

          invoker.runsAndWaits(11);
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#11'); });

          invoker.runsAndWaits();
          invoker.runsExpectSuccess(
            function(result) { expect(result).toBe('#11'); });

          invoker.runsAndWaits('error');
          invoker.runsExpectFailure();

          invoker.runsAndWaits('exception');
          invoker.runsExpectFailure();

        });
      });
    };

    describeInvocation('of Functions',
      function() { return invocableFunc; });

    describeInvocation('of URLs',
      function() { return invocableURL; });

    describeInvocation('of Wrapped Function Caps',
      function() { return invocableWrappedFunc; });

    describeInvocation('of Wrapped URL Caps',
      function() { return invocableWrappedURL; });

    describeAsyncInvocation('of Async Functions',
      function() { return invocableAsyncFunc; });

    describeAsyncInvocation('of Wrapped Async Function Caps',
      function() { return invocableWrappedAsyncFunc; });

    // NOTE: async testing of URLs is not reasonable: requires passing
    // continuations to the remote cap, the URL, as caps themselves.
    // These continuations must be encoded in messages.

    describe('of Dead caps', function() {
      var deadCap;
      beforeEach(function() {
        deadCap = capServer1.grant(null);
      });

      it('should do synchronous calls', function() {
        var rGet0 = deadCap.invokeSync();
        var rSet1 = deadCap.invokeSync(7);
        var rSet2 = deadCap.invokeSync(11);

        expect(rGet0).not.toBeDefined();
        expect(rSet1).not.toBeDefined();
        expect(rSet2).not.toBeDefined();
      });

      it('should do asynchronous calls', function() {
        var invoker = new InvokeRunner(deadCap);

        invoker.runsAndWaits();
        invoker.runsExpectFailure();

        invoker.runsAndWaits(7);
        invoker.runsExpectFailure();

        invoker.runsAndWaits(11);
        invoker.runsExpectFailure();
      });
    });

    describe('of async dead caps', function() {
      var deadCap;
      beforeEach(function() {
        deadCap = capServer1.grantAsync(null);
      });

      it('should do asynchronous calls', function() {
        var invoker = new InvokeRunner(deadCap);

        invoker.runsAndWaits();
        invoker.runsExpectFailure();

        invoker.runsAndWaits(7);
        invoker.runsExpectFailure();

        invoker.runsAndWaits(11);
        invoker.runsExpectFailure();
      });
    });
  });

  describe('Wrapped Caps', function() {
    var c1, w1;
    beforeEach(function() {
      c1 = capServer1.grant(function() { return 99; });
      w1 = capServer2.wrap(c1);
    });

    it('should wrap', function() {
      expect(w1).not.toBeNull();
    });

    it('should invokeSync via the wrapper', function() {
      var r1 = w1.invokeSync();
      expect(r1).toBe(99);
    });

    it('should be revokable at the wrapper', function() {
      capServer2.revoke(w1.serialize());
      var r1 = c1.invokeSync();
      var r2 = w1.invokeSync();
      expect(r1).toBe(99);
      expect(r2).not.toBeDefined();
    });

    it('should be revokable at the source', function() {
      capServer1.revoke(c1.serialize());
      var r1 = c1.invokeSync();
      var r2 = w1.invokeSync();
      expect(r1).not.toBeDefined();
      expect(r2).not.toBeDefined();
    });
  });

  describe('Server Life Cycle', function() {
    it('should be able to revokeAll in a given server', function() {
      var c11 = capServer1.grant(function() { return 11; });
      var c12 = capServer1.grant(function() { return 12; });
      var c21 = capServer2.grant(function() { return 21; });
      expect(c11.invokeSync()).toBe(11);
      expect(c12.invokeSync()).toBe(12);
      expect(c21.invokeSync()).toBe(21);
      capServer1.revokeAll();
      expect(c11.invokeSync()).not.toBeDefined();
      expect(c12.invokeSync()).not.toBeDefined();
      expect(c21.invokeSync()).toBe(21);
    });

    it('should be able to revokeAll a wrapped cap', function() {
      var c1 = capServer1.grant(function() { return 42; });
      var c2 = capServer2.wrap(c1);
      expect(c1.invokeSync()).toBe(42);
      expect(c2.invokeSync()).toBe(42);
      capServer2.revokeAll();
      expect(c1.invokeSync()).toBe(42);
      expect(c2.invokeSync()).not.toBeDefined();
    });
  });

  describe('Serialization', function() {
    describe('Restoring', function() {
      var servers, ids;
      var f100 = function() { return 100; };
      var f200 = function() { return 200; };
      var f300 = function() { return 300; };
      var f400 = function() { return 400; };
      var f500 = function(data, s, f) { s(500); };
      var f400URL = 'http://example.com/f400';

      var instanceResolver = function(id) {
        var i = ids.indexOf(id);
        return servers[i] ? servers[i].publicInterface : null;
      }

      beforeEach(function() {
        servers = [capServer1, capServer2];
        ids = [];
        for (var i in servers) {
          ids.push(servers[i].instanceID);
          servers[i].setResolver(instanceResolver);
        }

        mockAjax.handle(f400URL, f400);

      });

      describe('while instance is still running', function() {
        it('should restore the same cap functionality', function() {
          var c1 = capServer1.grant(f100);
          var s1 = c1.serialize();
          expect(s1).toBeTruthy();

          var c2 = capServer2.restore(s1);
          expect(c2.invokeSync()).toEqual(100);
        });

        it('should restore a URL cap', function() {
          var c2 = capServer1.grant(f400URL);
          var s2 = c2.serialize();

          var c3 = capServer2.restore(s2);
          expect(c3.invokeSync()).toEqual(400);
        });

        it('should restore an async cap', function() {
          var c1 = capServer1.grantAsync(f500);
          var s1 = c1.serialize();

          var c2 = capServer2.restore(s1);
          var checkResult = false;
          c2.get(function(result) { checkResult = result; });

          waitsFor(function() { return checkResult; },
              'async restore invoke', 250);
          runs(function() { expect(checkResult).toEqual(500) });
        });

        it('should restore a dead cap as dead', function() {
          var c1 = capServer1.grant(f100);
          var s1 = c1.serialize();
          capServer1.revoke(c1.serialize());

          var c2 = capServer1.restore(s1);
          expect(c2.invokeSync()).not.toBeDefined();
        });

      });

      describe('after instance shutdown', function() {
        var c1, c2, c3, c4, s1, s2, s3, s4, snapshot;
        beforeEach(function() {
          c1 = capServer1.grant(f300, 'f300');
          s1 = c1.serialize();
          c2 = capServer1.grant(f100, 'f100');
          s2 = c2.serialize();
          c3 = capServer1.grantAsync(f500, 'f500');
          s3 = c3.serialize();
          c4 = capServer1.grant(f400URL, 'f400URL');
          s4 = c4.serialize();
          capServer1.revoke(s2);
          snapshot = capServer1.snapshot();
          capServer1.revokeAll();
          expect(c1.invokeSync()).not.toBeDefined();
          expect(c4.invokeSync()).not.toBeDefined();
        });

        var makeNewServer = function() {
          servers[0] = capServer1 = new CapServer(snapshot);
          capServer1.setResolver(instanceResolver);
        };
        var setNewReviver = function() {
          capServer1.setReviver(function(role) {
            if (role === 'f300') { return capServer1.buildFunc(f300); }
            if (role === 'f500') { return capServer1.buildAsyncFunc(f500); }
            if (role === 'f400URL') { return capServer1.buildURL(f400URL); }
            return null;
          });
        };

        it('should revive the cap after instance restart', function() {
          makeNewServer();
          setNewReviver();
          var c1restored = capServer2.restore(s1);
          expect(c1restored.invokeSync()).toEqual(300);

          var c4restored = capServer2.restore(s4);
          expect(c4restored.invokeSync()).toEqual(400);
        });

        it('should revive async caps after instance restart', function() {
          makeNewServer();
          setNewReviver();

          var c3restored = capServer2.restore(s3);
          var checkResult2 = false;
          c3restored.get(function(result) { checkResult2 = result; });
          waitsFor(function() { return checkResult2; },
              'async revive invoke', 250);
          runs(function() { expect(checkResult2).toEqual(500) });
        });

        it('should restore a cap, even before the reviver is set', function() {
          makeNewServer();
          var c1restored = capServer2.restore(s1);
          var c4restored = capServer2.restore(s4);
          expect(c1restored.invokeSync()).not.toBeDefined();
          expect(c4restored.invokeSync()).not.toBeDefined();
          setNewReviver();
          expect(c1restored.invokeSync()).toEqual(300);
          expect(c4restored.invokeSync()).toEqual(400);
        });

        it('should restore an async cap, even before the reviver is set',
          function() {
            makeNewServer();
            var c3restored = capServer2.restore(s3);
            var checkResult2 = false;
            setNewReviver();
            c3restored.get(function(result) { checkResult2 = result; });
            waitsFor(function() { return checkResult2; },
                'async revive invoke', 250);
            runs(function() { expect(checkResult2).toEqual(500) });
        });

        xit('should restore a cap, even before the instance is restarted',
            function() {
          var c1restored = capServer2.restore(s1);
          expect(c1restored.invokeSync()).not.toBeDefined();
          makeNewServer();
          setNewReviver();
          expect(c1restored.invokeSync()).toEqual(300);
        });

        it('should restore a revoked cap as dead after instance restart',
            function() {
          makeNewServer();
          setNewReviver();
          var c2restored = capServer2.restore(s2);
          expect(c2restored.invokeSync()).not.toBeDefined();
        });
      });

      describe('restoring invalid serializations', function() {
        it('should restore an unresolvable cap as dead', function() {
          var c1 = capServer1.grant(f100);
          var s1 = c1.serialize();
          var capServer3 = new CapServer();
          var c1restored = capServer3.restore(s1);
          expect(c1restored.invokeSync()).not.toBeDefined();
        });

        it('should restore invalid serializations as dead caps', function() {
          var c1 = capServer1.restore('');
          expect(c1.invokeSync()).not.toBeDefined();

          var c2 = capServer1.restore('asdf');
          expect(c2.invokeSync()).not.toBeDefined();
        });
      });
    });

    describe('Data Pre/Post Processing', function() {
      var roundTrip = function(v) {
        var a = capServer1.dataPreProcess(v);
        var b = JSON.stringify(a);
        var c = JSON.parse(b);
        var d = capServer1.dataPostProcess(c);
        return d;
      };
      var expectRT = function(v) {
        expect(roundTrip(v)).toEqual(v);
      };
      it('should round trip simple values', function() {
        expectRT(undefined);
        expectRT(null);
        expectRT(false);
        expectRT(true);
        expectRT(0);
        expectRT(123);
        expectRT('');
        expectRT('yo');
      });

      it('should round trip simple structures', function() {
        expectRT([1, 2, 3]);
        expectRT({a: 42, b: 'bob'});
        expectRT({a: ['one', 'two'], b: {q: true, p: false}});
      });

      it('should throw when processing non-POD data', function() {
        var expectInvalid = function(v) {
          expect(function() {capServer1.dataPreProcess(v);}).toThrow();
        };

        var CircularThing = function() {
          this.a = {};
          this.b = { toA: this.a };
          this.a.toB = this.b;
        }

        expectInvalid(/abc/);
        expectInvalid(new CircularThing());
        expectInvalid({a: /abc/});
        expectInvalid({a: new CircularThing()});
        expectInvalid([/abc/]);
        expectInvalid([new CircularThing()]);
      });

      it('should round trip a capability', function() {
        var c1 = capServer1.grant(function() { return 42; }, 'answer');
        var a = { name: 'oracle', cap: c1 };
        var b = roundTrip(a);
        expect(b.name).toEqual(a.name);
        expect(b.cap.serialize()).toEqual(a.cap.serialize());
        var r = b.cap.invokeSync();
        expect(r).toEqual(42);
      });

      it('should pass a capability', function() {
        // TODO(mzero): this instance resolver logic should be factored out
        var servers = [capServer1, capServer2];
        var ids = [];
        for (var i in servers) {
          ids.push(servers[i].instanceID);
          servers[i].setResolver(function(id) {
            var j = ids.indexOf(id);
            return servers[j] ? servers[j].publicInterface : null;
          });
        }

        c1 = capServer1.grant(function() { return 42; }, 'answer');
        a = { name: 'oracle', cap: c1 };
        var b = capServer1.dataPreProcess(a);
        var c = JSON.stringify(b);
        var d = JSON.parse(c);
        var e = capServer2.dataPostProcess(d);
        expect(e.name).toEqual(a.name);
        expect(e.cap.serialize()).toEqual(a.cap.serialize());
        r = e.cap.invokeSync();
        expect(r).toEqual(42);
      });
    });
  });
});

/*
Missing Tests

CapServer
  two caps on the same URL result in different, independent caps
    -?

  restoring dead cap with nullCapID

  semantics of URL caps

  persisting wrapped caps

  revokeAll revokes
    awoken caps

  proper reviving 2nd time of caps
    - serialization is the same
    - capID is the same
    - revocation still works, etc...

*/
