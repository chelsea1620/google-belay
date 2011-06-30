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

