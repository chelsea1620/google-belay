describe('bfriendr back end', function() {
  var capServer;
  var generateAccountCap;
  
  var asCap = function(c) {
    if (c.length == 0) fail('asCap passed an empty string');
    if (! (/^https?:\/\//).test(c)) fail('asCap not a URL: ' + c);
    return capServer.restore(c);
  };
  
  beforeEach(function() {
    capServer = new CapServer();
    generateAccountCap =
      capServer.restore("http://localhost:9009/generate-account");
  });
  
  describe('basic account operations', function() {
    it('should generate a new account', function() {
      var done = false;
      generateAccountCap.get(function(r) { done = true; });
      waitsFor(function() { return done; }, "generating account", 250);
    });

    it('should save and restore my card info', function() {
      var done = false;
      var acctCap, myCardCap;
      var initialCard, updatedCard;
      
      generateAccountCap.get(function(r) { acctCap = asCap(r); done = true; });
      waitsFor(function() { return done; }, "generating account", 250);

      runs(function() {
        done = false;
        acctCap.get(function(r) {
          myCardCap = asCap(r.myCard);
          myCardCap.get(function(r) {
            initialCard = r;
            done = true;
          });
        });
      });
      waitsFor(function() { return done; }, "getting initial card", 250);
      
      runs(function() {
        expect(typeof initialCard.name).toEqual('string');
        expect(initialCard.name).not.toEqual('');
        expect(typeof initialCard.email).toEqual('string');
        expect(initialCard.email).not.toEqual('');
        expect(typeof initialCard.notes).toEqual('string');
        expect(initialCard.notes).not.toEqual('');
        
        done = false;
        myCardCap.put(
            { name: 'fido', email: 'fido@example.com', notes: 'not a dog'},
            function() {
              myCardCap.get(function(r) {
                done = true;
                updatedCard = r;
              });  
            });
      });
      
      waitsFor(function() { return done; }, 'set then get updated card', 250);
      
      runs(function() {
        expect(updatedCard.name).toEqual('fido');
        expect(updatedCard.email).toEqual('fido@example.com');
        expect(updatedCard.notes).toEqual('not a dog');
      });
      
      
      
    });
  });
});

