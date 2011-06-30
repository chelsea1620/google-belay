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
    
    expect(get('/wellknowncaps/grant')).toMatch('.*/caps/.*');
  });

});