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

var InvokeRunner = function(cap) {
  this.cap = cap;
  this.failureStatus = undefined;
  this.failureCalled = this.successCalled = this.errorRaised = false;
  this.error = undefined;
  this.result = 'something funky';
};
InvokeRunner.prototype.runsInvoke = function(method, data) {
  var me = this;
  runs(function() {
    me.failureStatus = undefined;
    me.failureCalled = me.successCalled = me.errorRaised = false;
    me.result = 'something funky';
    var failure = function(err) {
      me.failureCalled = true;
      me.failureStatus = 999;
      if (err.status && typeof err.status == 'number') {
        me.failureStatus = err.status;
      }
    };
    var success = function(data) {
      me.result = data; me.successCalled = true;
    };
    try {
      me.cap.invoke(method, data, success, failure);
    }
    catch (e) {
      me.errorRaised = true;
      me.error = e;
    }
  });
  waitsFor(function() {
        return me.failureCalled || me.successCalled || me.errorRaised;
      }, 'invoke timeout', 5000);
};
InvokeRunner.prototype.runsGet = function() {
    this.runsInvoke('GET', undefined);
};
InvokeRunner.prototype.runsPut = function(data) {
    this.runsInvoke('PUT', data);
};
InvokeRunner.prototype.runsPost = function(data) {
    this.runsInvoke('POST', data);
};
InvokeRunner.prototype.runsDelete = function() {
    this.runsInvoke('DELETE', undefined);
};

InvokeRunner.prototype.runsExpectSuccess = function(resultChecker) {
  var me = this;
  runs(function() {
    expect(me.failureCalled).toBe(false);
    expect(me.successCalled).toBe(true);
    expect(me.errorRaised).toBe(false);
    if (me.errorRaised) {
      jasmine.log('unexpected error: ', me.error);
    }
    if (resultChecker)
      resultChecker(me.result);
  });
};
InvokeRunner.prototype.runsExpectFailure = function() {
  var me = this;
  runs(function() {
    expect(me.failureCalled).toBe(true);
    expect(me.successCalled).toBe(false);
    expect(me.errorRaised).toBe(false);
    if (me.errorRaised) {
      jasmine.log('unexpected error: ', me.error);
    }
    expect(typeof me.failureStatus).toEqual('number');
  });
};
InvokeRunner.prototype.runsExpectException = function(expectedError) {
  var me = this;
  runs(function() {
    expect(me.failureCalled).toBe(false);
    expect(me.successCalled).toBe(false);
    expect(me.errorRaised).toBe(true);
    if (expectedError)
      expect(me.error).toEqual(expectedError);
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
InvokeRunner.prototype.runsPostAndExpectFailure = function(data) {
  this.runsPost(data);
  this.runsExpectFailure();
};

var mkRunner = function(c) { return new InvokeRunner(c); };
