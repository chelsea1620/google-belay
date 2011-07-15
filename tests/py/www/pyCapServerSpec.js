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

function get(url) {
  var resp = false;
  var err = false;
  $.ajax({
    url: url,
    async: false,
    success: function(data) { 
      resp = JSON.parse(data);
      if (typeof resp === 'object' && resp.hasOwnProperty('value')) {
        resp = resp.value;
      }
      else {
        throw 'expected BCAP response, got ' + data;
      }
    },
    error: function(xhr, status) { err = xhr.status; } 
  });
  if(err) throw err;
  else return resp;
}

describe('try to reach the capserver', function() {

  it('request /ping for pong', function() {
    expect(get('/ping')).toEqual('pong');
  });

});

describe('basic cap invocation', function() {

  it('request server to grant a cap', function() {
    expect(get('/test_entry/grant')).toMatch('.*/caps/.*');
  });

  it('should be able to invoke a granted cap', function() {
    var cap_response = get('/test_entry/grant');
    expect(get(cap_response)).toEqual({'success': true});
  }); 

  it('should invoke caps granted as strings', function() {
    var cap_response = get('/test_entry/grantWithString');
    expect(get(cap_response)).toEqual({'success': true});
  });

  it('should get "404 Cap not found" on bad cap invokes', function() {
    var bogus_cap = '/caps/not-a-cap-at-all';
    expect(function() { get(bogus_cap); }).toThrow(404);
  });
});

