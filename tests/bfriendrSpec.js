describe('bfriendr back end', function() {
  var capServer;
  var generateAccountRunner;
  
  var asCap = function(c) {
    if (c.length == 0) fail('asCap passed an empty string');
    if (! (/^https?:\/\//).test(c)) fail('asCap not a URL: ' + c);
    return capServer.restore(c);
  };
  
  beforeEach(function() {
    capServer = new CapServer();
    generateAccountRunner =
      mkRunner(capServer.restore("http://localhost:9009/generate-account"));
  });
  
  describe('basic account operations', function() {
    it('should generate a new account', function() {
      generateAccountRunner.runsGet();
      generateAccountRunner.runsExpectSuccess();
    });

    it('should save and restore my card info', function() {
      var accountRunner = new InvokeRunner();
      var myCardRunner = new InvokeRunner();
      var initialCard, updatedCard;
      
      generateAccountRunner.runsGet();
      generateAccountRunner.runsExpectSuccess();
      runs(function() {
        accountRunner.cap = asCap(generateAccountRunner.result);
        expect(accountRunner.cap).toBeDefined();
      });

      accountRunner.runsGet();
      accountRunner.runsExpectSuccess();
      runs(function() {
        myCardRunner.cap = asCap(accountRunner.result.myCard);
        expect(myCardRunner.cap).toBeDefined();
      })
      
      myCardRunner.runsGet();
      myCardRunner.runsExpectSuccess();
      runs(function() {
        initialCard = myCardRunner.result;
        expect(typeof initialCard.name).toEqual('string');
        expect(initialCard.name).not.toEqual('');
        expect(typeof initialCard.email).toEqual('string');
        expect(initialCard.email).not.toEqual('');
        expect(typeof initialCard.notes).toEqual('string');
        expect(initialCard.notes).not.toEqual('');
      });
      
      myCardRunner.runsPut(
        { name: 'fido', email: 'fido@example.com', notes: 'not a dog'});
      myCardRunner.runsExpectSuccess();
      myCardRunner.runsGet();
      myCardRunner.runsExpectSuccess();
      runs(function() {
        updatedCard = myCardRunner.result;
        expect(updatedCard.name).toEqual('fido');
        expect(updatedCard.email).toEqual('fido@example.com');
        expect(updatedCard.notes).toEqual('not a dog');
      });
    });
  });
});

