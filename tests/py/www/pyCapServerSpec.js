function get(url) {
  var resp = false;
  $.ajax({
    url: url,
    async: false,
    success: function(data) { 
      resp = JSON.parse(data);
      if (typeof resp === 'object' && resp.hasOwnProperty('value')) {
        resp = resp.value;
      }
      else {
        fail('expected BCAP response, got ' + data);
      }
    },
    failure: function() { fail('error on GET ' + url); }
  });
  return resp;
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
});

