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

var MockWebServer = function() {
  this.urlMap = {};
  this.speed = 50;
  this.server = null;
};
MockWebServer.prototype.clear = function() { this.urlMap = {}; };
MockWebServer.prototype.setServer = function(server) { this.server = server; };
MockWebServer.prototype.handle =
  function(url, func) { this.urlMap[url] = func; };
MockWebServer.prototype.process =
  function(method, url, data, success, failure) {
    if (!(url in this.urlMap)) {
      return failure();
    }
    var f = this.urlMap[url];
    var t = method || 'GET';
    var server = this.server;
    var pre = function(d) { return server.dataPreProcess(d); };
    var post = function(d) { return server.dataPostProcess(d); };
    var response;

    if (t == 'GET') response = pre(f());
    else if (t == 'POST') response = pre(f(post(data)));
    else if (t == 'PUT') f(post(data));
    else return failure();

    return success(response);
};
MockWebServer.prototype.makeAjax = function() {
  var server = this;

  return function(opts) {
    server.process(opts.type, opts.url, opts.data,
      function(result) {
        var f = function() {
          if (opts.success) opts.success(result, 'success', {});
          if (opts.complete) opts.complete({}, 'success');
        };

        if (opts.async) setTimeout(f, server.speed);
        else f();
      },
      function() {
        var f = function() {
          if (opts.error) opts.error({},'error', undefined);
          if (opts.complete) opts.complete({}, 'error');
        };

        if (opts.async) setTimeout(f, server.speed);
        else f();
      }
    );
  };
};
MockWebServer.prototype.makeXhr = function() {
  var server = this;

  var mockXhr = function() {
    this.onreadystatechange = function() { };
  };
  mockXhr.prototype.open = function(method, url) {
    this.method = method;
    this.url = url;
  };
  mockXhr.prototype.send = function(data) {
    var xhr = this;
    server.process(this.method, this.url, data,
      function(result) {
        xhr.readyState = 4;
        xhr.status = 200;
        xhr.responseText = result;
        xhr.onreadystatechange();
      },
      function() {
        xhr.readyState = 4;
        xhr.status = 400;
        xhr.statusText = 'MockWebServer failure';
        xhr.onreadystatechange();
      }
    );
  };
  return mockXhr;
};

var mockWebServer = new MockWebServer();

jQuery = {};
jQuery.ajax = mockWebServer.makeAjax();

XMLHttpRequest = mockWebServer.makeXhr();

describe('Belay hashing', function() {
  it('should perform the algorithm', function() {
    /* NOTE(jpolitz): these were done out out "by hand" in the Python REPL, using
     > import uuid
     > import hashlib
     > p = uuid.uuid4()
     > str(p) # arg to newInstanceId
     > hashlib.sha256(p.bytes).hexdigest() # expected result
    */
    expect(newInstanceId('20079a21-1ee8-4523-ad65-d8c4736276af')).toBe('debc56d8a87287861914bdbf4d0850a7');
    expect(newInstanceId('f50b4dab-0701-4008-8281-68c4c3ff9d6e')).toBe('8fe5d63019007e79b7516a62385a7b28');
    expect(newInstanceId('3c89bdda-ff70-4389-8870-2630e768c25d')).toBe('a40a9308790b58b76674d1ba1cb9e7fb');
  });
  
  it('should throw on non-strings', function() {
    expect(function() { newInstanceId(); }).toThrow(); 
    expect(function() { newInstanceId({}); }).toThrow();
    expect(function() { newInstanceId(55); }).toThrow();
    expect(function() { newInstanceId(0xf50b4dab07014008828168c4c3ff9d6e); }).toThrow(); 
    expect(function() { newInstanceId(null); }).toThrow(); 
  });
  
  it('should throw on non-uuids', function() {
    expect(function() { newInstanceId(''); }).toThrow();
    
    expect(function() { newInstanceId('5uperman'); }).toThrow();
    
    expect(function() { newInstanceId('f50b4dab-0701-4008-0281-68c4c3ff9d6e'); }).toThrow();
    // The careted hex value has to be in [ab89]          ^
    
    expect(function() { newInstanceId('f50b4dab-0701-3008-8281-68c4c3ff9d6e'); }).toThrow();
    // The careted hex value has to be 4             ^
    
    expect(function() { newInstanceId('f50b4dab07014008828168c4c3ff9d6e'); }).toThrow(); 
  });
  
});

describe('CapServer', function() {
  var capServer1;
  var capServer2;
  var capServer3;

  beforeEach(function() {
    mockWebServer.clear();
    capServer1 = new CapServer(newUUIDv4());
    capServer2 = new CapServer(newUUIDv4());
    capServer3 = new CapServer(newUUIDv4());
    mockWebServer.setServer(capServer3);
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

  describe('Radish servers (no instanceId)', function() {
    var radishServer;
    beforeEach(function() {
      radishServer = new CapServer();
      radishServer.setResolver(
          function(i) { return capServer1.publicInterface; });
    });

    it('should throw on bad instanceIds', function() {
      expect(function() { new CapServer(null); }).toThrow();
      expect(function() { new CapServer(42); }).toThrow();
      expect(function() { new CapServer(''); }).toThrow();
      expect(function() { new CapServer('bob'); }).toThrow();
    });

    it('should create a server with no instanceId', function() {
      expect(function() { new CapServer(); }).not.toThrow();
    });

    it('should not grant caps', function() {
      var f = function() { return 42; };
      expect(function() { radishServer.grant(f); }).toThrow();
    });

    it('should restore a working cap', function() {
      var f = function() { return 42; };
      var c1 = capServer1.grant(f);

      var c2 = radishServer.restore(c1.serialize());
      var ir = new InvokeRunner(c2);
      ir.runsGetAndExpect(42);
    });

    it('should dataPostProcess a working cap', function() {
      var f = function() { return 42; };
      var c1 = capServer1.grant(f);
      var d1 = { name: 'bob', age: 12, cap: c1 };
      var s1 = capServer1.dataPreProcess(d1);

      var d2 = radishServer.dataPostProcess(s1);
      expect(d2['name']).toEqual(d1['name']);
      expect(d2['age']).toEqual(d1['age']);
      expect(typeof d2['cap']).toEqual(typeof d1['cap']);

      var c2 = d2.cap;
      var ir = new InvokeRunner(c2);
      ir.runsGetAndExpect(42);
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
                  'POST', '{"value": "some-value"}',
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
    var fnCalledWith;
    var c1, c2;

    beforeEach(function() {
      c1 = capServer1.grant(function(d) {
        fnCalledWith = d;
        return '*' + String(d) + '*';
      });

      c2 = capServer1.grant(function(d) {
        fnCalledWith = d;
         // no return, called with put
      });

      fnCalledWith = 'not-yet-called';
    });

    it('should pass no argument to get', function() {
      mkRunner(c1).runsGetAndExpect('*undefined*');
      runs(function() { expect(fnCalledWith).toBe(undefined); });
    });

    it('should pass argument to put', function() {
      mkRunner(c2).runsPut(42);
      runs(function() { expect(fnCalledWith).toEqual(42); });
    });

    it('should fail on return from put', function() {
      var r = mkRunner(c1);
      r.runsPut(42);
      r.runsExpectFailure();
      runs(function() { expect(fnCalledWith).toEqual(42); });
    });

    it('should pass results from post', function() {
      var r = mkRunner(c1);
      r.runsPost(42);
      r.runsExpectSuccess(function(d) { expect(d).toEqual('*42*'); });
      runs(function() { expect(fnCalledWith).toEqual(42); });
    });

    it('should fail on delete', function() {
      var r = mkRunner(c1);
      r.runsDelete();
      r.runsExpectFailure();
    });

    it('should throw execption on argument to get', function() {
      var r = mkRunner(c1);
      r.runsInvoke('GET', 42);
      r.runsExpectException();
      runs(function() { expect(fnCalledWith).toEqual('not-yet-called'); });
    });
  });

  describe('Build', function() {
    var buildAndExpect = function(item, method, value, expected) {
      var impl = capServer1._build(item);
      var called = false;
      impl.invoke(method, capServer1.dataPreProcess(value),
        function(r) {
          called = true;
          if (typeof expected === 'undefined')
            expect(r).not.toBeDefined();
          else
            expect(capServer1.dataPostProcess(r)).toBe(expected);
        });
      expect(called).toBe(true);
    };

    var buildAndExpectError = function(item) {
      if (arguments.length === 0)
        expect(function() { capServer1._build(); }).toThrow();
      else
        expect(function() { capServer1._build(item); }).toThrow();
    };

    var checkDead = function(impl) {
      var succeeded = false;
      var failed = false;
      impl.invoke('GET', null, function() { succeeded = true; },
          function() { failed = true; });
      expect(succeeded).toBe(false);
      expect(failed).toBe(true);
    };

    it('should build sync for zero or one argument', function() {
      var syncFunc1 = function(v) { return 'syncFunc:' + v; };
      var syncFunc2 = function() { return 'syncFunc:noargs'; };
      buildAndExpect(syncFunc1, 'POST', 5, 'syncFunc:5');
      buildAndExpect(syncFunc2, 'GET', undefined, 'syncFunc:noargs');
    });

    it('should build async for two or more arguments', function() {
      var asyncFunc1 = function(v, s) { s('asyncFunc1:' + v); };
      var asyncFunc2 = function(v, s, f) { s('asyncFunc2:' + v); };
      buildAndExpect(asyncFunc1, 'POST', 5, 'asyncFunc1:5');
      buildAndExpect(asyncFunc2, 'POST', 10, 'asyncFunc2:10');

    });

    it('should build sync handlers', function() {
      var checkResult1 = 'not-yet-set1';
      var syncHandler1 = {get: function() { return 22; },
                          put: function(v) { checkResult1 = v; }};
      var checkResult2 = 'not-yet-set2';
      var checkResult3 = 'not-yet-set3';
      var syncHandler2 = {put: function(v) { checkResult2 = v; },
                          remove: function() { checkResult3 = 84; }};

      buildAndExpect(syncHandler1, 'GET', undefined, 22);
      buildAndExpect(syncHandler1, 'PUT', 55, undefined);
      expect(checkResult1).toBe(55);

      buildAndExpect(syncHandler2, 'PUT', 32, undefined);
      buildAndExpect(syncHandler2, 'DELETE', undefined, undefined);
      expect(checkResult2).toBe(32);
      expect(checkResult3).toBe(84);
    });

    it('should build async handlers', function() {
      var checkResult1 = 'not-yet-set1';
      var syncHandler1 = {get: function(s) { s(22); },
                          put: function(v, s) { checkResult1 = v; s(); }};
      var checkResult2 = 'not-yet-set2';
      var checkResult3 = 'not-yet-set3';
      var syncHandler2 = {put: function(v, s) { checkResult2 = v; s(); },
                          remove: function(s) { checkResult3 = 84; s(); }};

      buildAndExpect(syncHandler1, 'GET', undefined, 22);
      buildAndExpect(syncHandler1, 'PUT', 55, undefined);
      expect(checkResult1).toBe(55);

      buildAndExpect(syncHandler2, 'PUT', 32, undefined);
      buildAndExpect(syncHandler2, 'DELETE', undefined, undefined);
      expect(checkResult2).toBe(32);
      expect(checkResult3).toBe(84);
    });

    it('should wrap caps', function() {
      var c1 = capServer1.grant(function() { return 22; });
      buildAndExpect(c1, 'GET', undefined, 22);
    });

    it('should be the identity on other handlers', function() {
      var c1 = capServer1.grant(function() { return 22; });
      var handler1 = capServer1._build(c1);
      var handler2 = capServer2._build(handler1);
      expect(handler1).toBe(handler2);
    });

    it('should error on inconsistent handlers', function() {
      var badHandler1 = {get: function(success, failure) {},
                         put: function(v) {}};
      var badHandler2 = {get: function() {},
                         post: function(v, s, f) {}};
      var badHandler3 = {put: function(v) {},
                         remove: function(s, f) {}};

      buildAndExpectError(badHandler1);
      buildAndExpectError(badHandler2);
      buildAndExpectError(badHandler3);
    });

    it('should error on empty handlers', function() {
      buildAndExpectError({});
    });

    it('should give a deadImpl on null', function() {
      checkDead(capServer1._build(null));
    });

    it('should throw on undefined, numbers, and bools', function() {
      buildAndExpectError();
      buildAndExpectError(22);
      buildAndExpectError(true);
      buildAndExpectError(undefined);
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
      mockWebServer.handle(invocableURL, invocableFunc);
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
      invocableWrappedAsyncFunc = capServer2.grant(invocableAsyncFunc);
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
          c1 = capServer1.grant(makeAsyncItem());
        });

        it('should do asynchronous calls (grant)', function() {
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
        deadCap = capServer1.grant(null);
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

  describe('Named Grants', function() {
    it('should grant by name', function() {
      capServer1.setNamedHandler('doubler', function() {
        return function(v) { return 2*v; };
      });
      var c1 = capServer1.grantNamed('doubler');
      mkRunner(c1).runsPostAndExpect(21, 42);
    });

    it('should grant by name with one argument', function() {
      capServer1.setNamedHandler('multiplier', function(m) {
        return function(v) { return m*v; };
      });
      var cx7 = capServer1.grantNamed('multiplier', 7);
      var cx10 = capServer1.grantNamed('multiplier', 10);
      mkRunner(cx7).runsPostAndExpect(4, 28);
      mkRunner(cx10).runsPostAndExpect(7, 70);
    });

    it('should grant by name with multiple arguments', function() {
      capServer1.setNamedHandler('matcher', function(m, x) {
        return function(v) { return v===m ? x : 0; };
      });
      var cDuck = capServer1.grantNamed('matcher', 'duck', 21);
      var cBlimp = capServer1.grantNamed('matcher', 'blimp', 100);
      mkRunner(cDuck).runsPostAndExpect('platypus', 0);
      mkRunner(cDuck).runsPostAndExpect('duck', 21);
      mkRunner(cBlimp).runsPostAndExpect('dirigible', 0);
      mkRunner(cBlimp).runsPostAndExpect('blimp', 100);
    });

    it('should grant by name, and fail if no handler', function() {
      var cNone = capServer1.grantNamed('none', 1, 2, 3);
      mkRunner(cNone).runsGetAndExpectFailure();
    });

    it('should grant by name, work if handler set after', function() {
      var cLater = capServer1.grantNamed('later', 'gator');
      mkRunner(cLater).runsGetAndExpectFailure();
      runs(function() {
        capServer1.setNamedHandler('later', function(n) {
          return function() { return n; };
        });
      });
      mkRunner(cLater).runsGetAndExpect('gator');
    });

    it('should support multiple named handlers', function() {
      capServer1.setNamedHandler('adder', function(n) {
        return function(v) { return v+n; };
      });
      capServer1.setNamedHandler('multiplier', function(n) {
        return function(v) { return v*n; };
      });
      var cAdd10 = capServer1.grantNamed('adder', 10);
      var cMult10 = capServer1.grantNamed('multiplier', 10);
      mkRunner(cAdd10).runsPostAndExpect(5, 15);
      mkRunner(cMult10).runsPostAndExpect(5, 50);
    });

    it('should support named grants with more or less arguments', function() {
      capServer1.setNamedHandler('countBound', function(a, b) {
        if (typeof(a) === 'undefined') return function() { return 0; }
        if (typeof(b) === 'undefined') return function() { return 1; }
        return function() { return 2; }
      });
      var c0 = capServer1.grantNamed('countBound');
      var c1 = capServer1.grantNamed('countBound', true);
      var c2 = capServer1.grantNamed('countBound', true, 'yo');
      var c3 = capServer1.grantNamed('countBound', true, 'yo', 42);
      mkRunner(c0).runsGetAndExpect(0);
      mkRunner(c1).runsGetAndExpect(1);
      mkRunner(c2).runsGetAndExpect(2);
      mkRunner(c3).runsGetAndExpect(2);
    });

    it('should support named grants with arbitrary arguments', function() {
      capServer1.setNamedHandler('index', function() {
        var stuff = Array.prototype.slice.call(arguments);
        return function(v) { return stuff[0+v]; };
      });
      var cDays = capServer1.grantNamed('index',
                    'Mon', 'Tue', 'Wed', 'Thr', 'Fri', 'Sat', 'Sun');
      mkRunner(cDays).runsPostAndExpect(1, 'Tue');
      mkRunner(cDays).runsPostAndExpect(5, 'Sat');
      mkRunner(cDays).runsPostAndExpect(9, undefined);
    });

    it('should support named grants to async handlers', function() {
      capServer1.setNamedHandler('later', function(x) {
        return function(v, sk, fk) {
          setTimeout(function() { sk(x); }, 0);
        };
      });
      var cLater = capServer1.grantNamed('later', 'gator');
      mkRunner(cLater).runsGetAndExpect('gator');
    });

    it('should support named grants to object handlers', function() {
      capServer1.setNamedHandler('box', function(initialValue) {
        var boxedValue = initialValue;
        return {
          get: function() { return boxedValue; },
          put: function(newValue) { boxedValue = newValue; },
          post: function(addValue) { return boxedValue += addValue; },
          remove: function() { boxedValue = initialValue; }
        };
      });
      var cThing = capServer1.grantNamed('box', 7);
      var r = mkRunner(cThing);
      r.runsGetAndExpect(7);
      r.runsPut(9);   r.runsExpectSuccess();
      r.runsGetAndExpect(9);
      r.runsPostAndExpect(11, 20);
      r.runsDelete(); r.runsExpectSuccess();
      r.runsGetAndExpect(7);
    });

    it('should throw when setting bad named handlers', function() {
      expect(function() {
        capServer1.setNamedHandler('bad', 42);
      }).toThrow();

      capServer1.setNamedHandler('worse', function() { return 42; });
      var cSad = capServer1.grantNamed('worse');
      var r = mkRunner(cSad);
      r.runsGet();
      r.runsExpectFailure();
    });

    it('should revoke named caps when grant preceeds setNamedHandler', function() {
      var c1 = capServer1.grantNamed('stuff', 21);
      var c2 = capServer1.grantNamed('stuff', 42);
      var c3 = capServer1.grantNamed('stuff', 84);
      
      // revoke before setNamedHandler is called
      runs(function() { capServer1.revoke(c1.serialize()); });
      mkRunner(c1).runsPostAndExpectFailure(50);

      runs(function() {
        capServer1.setNamedHandler('stuff', function(n) {
          return function(v) { return v > n; };
        });
      });

      // the revoked one should still be dead
      mkRunner(c1).runsPostAndExpectFailure(50);

      // revoke after setNamedHandler, but before use
      runs(function() { capServer1.revoke(c2.serialize()); });
      mkRunner(c2).runsPostAndExpectFailure(50);

      // revoke after setNamedHandler, and use
      mkRunner(c3).runsPostAndExpect(50, false);
      runs(function() { capServer1.revoke(c3.serialize()); });
      mkRunner(c3).runsPostAndExpectFailure(50);
    });

    it('should revoke named caps when grant and invoke preceeds setNamedHandler', function() {
      var c1 = capServer1.grantNamed('stuff', 21);
      var c2 = capServer1.grantNamed('stuff', 42);
      var c3 = capServer1.grantNamed('stuff', 84);

      // invoke them all once, then test as above
      mkRunner(c1).runsPostAndExpectFailure(50);
      mkRunner(c2).runsPostAndExpectFailure(50);
      mkRunner(c3).runsPostAndExpectFailure(50);

      // revoke before setNamedHandler is called
      runs(function() { capServer1.revoke(c1.serialize()); });
      mkRunner(c1).runsPostAndExpectFailure(50);

      runs(function() {
        capServer1.setNamedHandler('stuff', function(n) {
          return function(v) { return v > n; };
        });
      });

      // the revoked one should still be dead
      mkRunner(c1).runsPostAndExpectFailure(50);

      // revoke after setNamedHandler, but before use
      runs(function() { capServer1.revoke(c2.serialize()); });
      mkRunner(c2).runsPostAndExpectFailure(50);

      // revoke after setNamedHandler, and use
      mkRunner(c3).runsPostAndExpect(50, false);
      runs(function() { capServer1.revoke(c3.serialize()); });
      mkRunner(c3).runsPostAndExpectFailure(50);
    });

    it('should revoke named caps when setNamedHandler preceeds grant', function() {
      capServer1.setNamedHandler('stuff', function(n) {
        return function(v) { return v > n; };
      });

      var c1 = capServer1.grantNamed('stuff', 21);
      var c2 = capServer1.grantNamed('stuff', 42);

      // revoke before use
      runs(function() { capServer1.revoke(c1.serialize()); });
      mkRunner(c1).runsPostAndExpectFailure(50);

      // revoke after use
      mkRunner(c2).runsPostAndExpect(50, true);
      runs(function() { capServer1.revoke(c2.serialize()); });
      mkRunner(c2).runsPostAndExpectFailure(50);
    });

    it('should revoke named caps based on a vaildator function', function() {
      capServer1.setNamedHandler('info', function(who, key, value) {
        return function() { return value; };
      });
      capServer1.setNamedHandler('data', function(who, key, value) {
        return function() { return value; };
      });

      var c0 = capServer1.grantNamed('data', 'zen', 'age', 0);
      var c1 = capServer1.grantNamed('info', 'amy', 'age', 42);
      var c2 = capServer1.grantNamed('info', 'amy', 'car', 'tesla');
      var c3 = capServer1.grantNamed('info', 'bob', 'age', 34);
      var c4 = capServer1.grantNamed('info', 'bob', 'car', 'prius');
      var c5 = capServer1.grantNamed('info', 'cam', 'age', 21);
      var c6 = capServer1.grantNamed('info', 'cam', 'car', 'camaro');

      var revoked = {};

      function expectWorking(e1, e2, e3, e4, e5, e6) {
        var cs = [c0, c1, c2, c3, c4, c5, c6];
        var es = [0, e1, e2, e3, e4, e5, e6];
        while (cs.length) {
          (function(c, e) {
            // var n = 6 - cs.length;
            // runs(function() { jasmine.log('looking at c' + n + ', e = ' + e); });
            if (e !== revoked) {
              mkRunner(c).runsGetAndExpect(e);
            } else {
              mkRunner(c).runsGetAndExpectFailure();
            }
          })(cs.shift(), es.shift());
        }
      }
      
      // runs(function() { jasmine.log('all should work'); });
      expectWorking(42, 'tesla', 34, 'prius', 21, 'camaro');

      // runs(function() { jasmine.log('removing amy\'s car'); });
      runs(function() {
        capServer1.revokeNamed('info', function(w, k, v) {
          return w === 'amy' && k ==='car';
        });
      });
      expectWorking(42, revoked, 34, 'prius', 21, 'camaro');

      // runs(function() { jasmine.log('removing age under 40'); });
      runs(function() {
        capServer1.revokeNamed('info', function(w, k, v) {
          return k ==='age' && v < 40;
        });
      });
      expectWorking(42, revoked, revoked, 'prius', revoked, 'camaro');

      // runs(function() { jasmine.log('removing all'); });
      runs(function() {
        capServer1.revokeNamed('info', function(w, k, v) {
          return true;
        });
      });
      expectWorking(revoked, revoked, revoked, revoked, revoked, revoked);
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
          ids.push(servers[i].instanceId);
          servers[i].setResolver(instanceResolver);
        }

        mockWebServer.handle(f400URL, f400);

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
          var c2 = capServer1.restore(f400URL);
          var s2 = c2.serialize();

          var c3 = capServer2.restore(s2);
          mkRunner(c3).runsGetAndExpect(400);
        });

        it('should restore a URL string', function() {
          var c1 = capServer1.restore(f400URL);
          mkRunner(c1).runsGetAndExpect(400);
        });

        it('should restore an async cap', function() {
          var c1 = capServer1.grant(f500);
          var s1 = c1.serialize();

          var c2 = capServer2.restore(s1);
          var checkResult = false;

          mkRunner(c2).runsGetAndExpect(500);
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
          c3 = capServer1.grant(f500, 'f500');
          s3 = c3.serialize();
          c4 = capServer1.grant(f400URL, 'f400URL');
          s4 = c4.serialize();
          capServer1.revoke(s2);
          snapshot = capServer1._snapshot();
          capServer1.revokeAll();
          mkRunner(c1).runsGetAndExpectFailure();
          mkRunner(c4).runsGetAndExpectFailure();
        });

        var makeNewServer = function() {
          servers[0] = capServer1 = new CapServer(newUUIDv4(), snapshot);
          capServer1.setResolver(instanceResolver);
        };
        var setNewReviver = function() {
          capServer1.setReviver(function(role) {
            if (role === 'f300') { return f200; }
            if (role === 'f500') { return f500; }
            if (role === 'f400URL') { return f400URL; }
            return null;
          });
        };

        it('should revive the cap after instance restart', function() {
          makeNewServer();
          setNewReviver();
          var c1restored = capServer2.restore(s1);
          var c4restored = capServer2.restore(s4);

          mkRunner(c1restored).runsGetAndExpect(200);
          mkRunner(c4restored).runsGetAndExpect(400);
        });

        it('should revive async caps after instance restart', function() {
          makeNewServer();
          setNewReviver();

          var c3restored = capServer2.restore(s3);
          var checkResult2 = false;

          mkRunner(c3restored).runsGetAndExpect(500);
        });

        it('should restore a cap, even before the reviver is set', function() {
          makeNewServer();
          var c1restored = capServer2.restore(s1);
          var c4restored = capServer2.restore(s4);
          mkRunner(c1restored).runsGetAndExpectFailure();
          mkRunner(c4restored).runsGetAndExpectFailure();
          runs(function() { setNewReviver(); });
          mkRunner(c1restored).runsGetAndExpect(200);
          mkRunner(c4restored).runsGetAndExpect(400);
        });

        it('should restore an async cap, even before the reviver is set',
          function() {
            makeNewServer();
            var c3restored = capServer2.restore(s3);
            var checkResult2 = false;
            setNewReviver();

            mkRunner(c3restored).runsGetAndExpect(500);
        });

        it('should restore a cap, even before the instance is restarted',
            function() {
          var c1restored = capServer2.restore(s1);
          mkRunner(c1restored).runsGetAndExpectFailure();
          runs(function() {
            makeNewServer();
            setNewReviver();
          });
          mkRunner(c1restored).runsGetAndExpect(200);
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
          var capServer3 = new CapServer(newUUIDv4());
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

      it('should throw when processing circular data', function() {
        var expectInvalid = function(v) {
          expect(function() {capServer1.dataPreProcess(v);}).toThrow();
        };

        var CircularThing = function() {
          this.a = {};
          this.b = { toA: this.a };
          this.a.toB = this.b;
        }

        expectInvalid(new CircularThing());
        expectInvalid({a: new CircularThing()});
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
          ids.push(servers[i].instanceId);
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

    describe('Synchronization', function() {
      it('should synchronize on grants', function() {
        var sync = false;
        capServer1.setSyncNotifier(function(state) { sync = true; });
        capServer1.grant(function() {});
        expect(sync).toBe(true);
      });

      it('should synchronize on revoke', function() {
        var syncCount = 0;
        capServer1.setSyncNotifier(function(state) { syncCount++; });
        capServer1.grant(function() {}, 'somekey');
        capServer1.revoke('somekey');
        expect(syncCount).toBe(2);
      });

      it('should synchronize on revokeAll', function() {
        var syncCount = 0;
        capServer1.setSyncNotifier(function(state) { syncCount++; });
        capServer1.grant(function() {}, 'somekey');
        capServer1.revokeAll();
        expect(syncCount).toBe(2);
      });

      it('should only accept functions for notifiers', function() {
        var expectedError = 'the sync notifier must be a function that takes ' +
            'at least one argument';
        expect(function() { capServer1.setSyncNotifier("not a function") }).
          toThrow(expectedError);
        expect(function() { capServer1.setSyncNotifier(function() {})}).
          toThrow(expectedError);
      });
    });
  });
});
