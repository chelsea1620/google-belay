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
InvokeRunner.prototype.runsInvoke = function(method, data) {
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
    me.cap.invoke(method, data, success, failure);
  });
  waitsFor(function() { return me.failureCalled || me.successCalled; },
      'invoke timeout', 250);
};
InvokeRunner.prototype.runsGet = function() {
    this.runsInvoke('get', undefined);
};
InvokeRunner.prototype.runsPut = function(data) {
    this.runsInvoke('put', data);
};
InvokeRunner.prototype.runsPost = function(data) {
    this.runsInvoke('post', data);
};
InvokeRunner.prototype.runsDelete = function() {
    this.runsInvoke('delete', undefined);
};

InvokeRunner.prototype.runsExpectSuccess = function(resultChecker) {
  var me = this;
  runs(function() {
    expect(me.failureCalled).toBe(false);
    expect(me.successCalled).toBe(true);
    resultChecker(me.result);
  });
};
InvokeRunner.prototype.runsExpectFailure = function() {
  var me = this;
  runs(function() {
    expect(me.failureCalled).toBe(true);
    expect(me.successCalled).toBe(false);
    expect(typeof me.failureStatus).toEqual('number');
  });
};

InvokeRunner.prototype.runsGetAndExpect = function(expectedResult) {
  this.runsGet();
  this.runsExpectSuccess(function(result) {
      expect(result).toEqual(expectedResult);
  });
};
InvokeRunner.prototype.runsGetAndExpectFailure = function() {
  this.runsGet();
  this.runsExpectFailure();
};
InvokeRunner.prototype.runsPostAndExpect = function(data, expectedResult) {
  this.runsPost(data);
  this.runsExpectSuccess(function(result) {
      expect(result).toEqual(expectedResult);
  });
};

var mkRunner = function(c) { return new InvokeRunner(c); };


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
    var f, c1, i1;
    beforeEach(function() {
      f = function() { return 42; };
      c1 = capServer1.grant(f);
      i1 = new InvokeRunner(c1);
    });

    it('should grant', function() {
      expect(c1).not.toBeNull();
    });

    it('should invoke', function() {
      i1.runsGetAndExpect(42);
    });

    it('should revoke, then not invoke', function() {
      capServer1.revoke(c1.serialize());
      i1.runsGetAndExpectFailure();
    });

    it('should create a dead cap', function() {
      var d = capServer1.grant(null);
      var i2 = new InvokeRunner(d);
      i2.runsGetAndExpectFailure();
    });

    it('should create distinct caps to same function', function() {
      var c2 = capServer1.grant(f);
      var i2 = new InvokeRunner(c2);
      expect(c2).not.toBe(c1);
      expect(c2.serialize()).not.toEqual(c1.serialize());
      capServer1.revoke(c1.serialize());
      i2.runsGetAndExpect(42);
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
      c1.remove(sk, fk);
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

        it('should do invoke (grant)', function() {
          var invoker = new InvokeRunner(c1);

          invoker.runsGetAndExpect('#0');
          invoker.runsPostAndExpect(7, '#7');
          invoker.runsGetAndExpect('#7');
          invoker.runsPostAndExpect(11, '#11');
          invoker.runsGetAndExpect('#11');
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

          invoker.runsGetAndExpect('#0');
          invoker.runsPostAndExpect(7, '#7');
          invoker.runsPostAndExpect(11, '#11');
          invoker.runsGetAndExpect('#11');

          invoker.runsPost('error');
          invoker.runsExpectFailure();

          invoker.runsPost('exception');
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

      it('should invoke and fail', function() {
        var invoker = new InvokeRunner(deadCap);

        invoker.runsGet();
        invoker.runsExpectFailure();

        invoker.runsPost(7);
        invoker.runsExpectFailure();

        invoker.runsPost(11);
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

        invoker.runsGet();
        invoker.runsExpectFailure();

        invoker.runsPost(7);
        invoker.runsExpectFailure();

        invoker.runsPost(11);
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

    it('should invoke via the wrapper', function() {
      mkRunner(w1).runsGetAndExpect(99);
    });

    it('should be revokable at the wrapper', function() {
      capServer2.revoke(w1.serialize());
      mkRunner(c1).runsGetAndExpect(99);
      mkRunner(w1).runsGetAndExpectFailure();
    });

    it('should be revokable at the source', function() {
      capServer1.revoke(c1.serialize());
      mkRunner(c1).runsGetAndExpectFailure();
      mkRunner(w1).runsGetAndExpectFailure();
    });
  });

  describe('Server Life Cycle', function() {
    it('should be able to revokeAll in a given server', function() {
      var c11 = capServer1.grant(function() { return 11; });
      var c12 = capServer1.grant(function() { return 12; });
      var c21 = capServer2.grant(function() { return 21; });

      mkRunner(c11).runsGetAndExpect(11);
      mkRunner(c12).runsGetAndExpect(12);
      mkRunner(c21).runsGetAndExpect(21);
      runs(function() { capServer1.revokeAll(); });
      mkRunner(c11).runsGetAndExpectFailure();
      mkRunner(c12).runsGetAndExpectFailure();
      mkRunner(c21).runsGetAndExpect(21);
    });

    it('should be able to revokeAll a wrapped cap', function() {
      var c1 = capServer1.grant(function() { return 42; });
      var c2 = capServer2.wrap(c1);
      mkRunner(c1).runsGetAndExpect(42);
      mkRunner(c2).runsGetAndExpect(42);
      runs(function() { capServer2.revokeAll(); });
      mkRunner(c1).runsGetAndExpect(42);
      mkRunner(c2).runsGetAndExpectFailure();
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
          mkRunner(c2).runsGetAndExpect(100);
        });

        it('should restore a URL cap', function() {
          var c2 = capServer1.grant(f400URL);
          var s2 = c2.serialize();

          var c3 = capServer2.restore(s2);
          mkRunner(c3).runsGetAndExpect(400);
        });
        
        it('should restore a URL string', function() {
          var c1 = capServer1.restore(f400URL);
          mkRunner(c1).runsGetAndExpect(400);
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
          mkRunner(c2).runsGetAndExpectFailure();
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
          mkRunner(c1).runsGetAndExpectFailure();
          mkRunner(c4).runsGetAndExpectFailure();
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
          var c4restored = capServer2.restore(s4);

          mkRunner(c1restored).runsGetAndExpect(300);
          mkRunner(c4restored).runsGetAndExpect(400);
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
          mkRunner(c1restored).runsGetAndExpectFailure();
          mkRunner(c4restored).runsGetAndExpectFailure();
          runs(function() { setNewReviver(); });
          mkRunner(c1restored).runsGetAndExpect(300);
          mkRunner(c4restored).runsGetAndExpect(400);
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

        it('should restore a cap, even before the instance is restarted',
            function() {
          var c1restored = capServer2.restore(s1);
          mkRunner(c1restored).runsGetAndExpectFailure();
          runs(function() {
            makeNewServer();
            setNewReviver();
          });
          mkRunner(c1restored).runsGetAndExpect(300);
        });

        it('should restore a revoked cap as dead after instance restart',
            function() {
          makeNewServer();
          setNewReviver();
          var c2restored = capServer2.restore(s2);
          mkRunner(c2restored).runsGetAndExpectFailure();
        });
      });

      describe('restoring invalid serializations', function() {
        it('should restore an unresolvable cap as dead', function() {
          var c1 = capServer1.grant(f100);
          var s1 = c1.serialize();
          var capServer3 = new CapServer();
          var c1restored = capServer3.restore(s1);
          mkRunner(c1restored).runsGetAndExpectFailure();
        });

        it('should restore invalid serializations as dead caps', function() {
          var c1 = capServer1.restore('');
          var c2 = capServer1.restore('asdf');

          mkRunner(c1).runsGetAndExpectFailure();
          mkRunner(c2).runsGetAndExpectFailure();
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
        mkRunner(b.cap).runsGetAndExpect(42);
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
        mkRunner(e.cap).runsGetAndExpect(42);
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
