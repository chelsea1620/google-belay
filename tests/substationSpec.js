describe('SubStation protocol', function() {
  var tunnel;

  beforeEach(function() {
    var ready;
    var remotePort = windowManager.open('testSubstation.html',
                                        'test_substation');
    tunnel = new CapTunnel(remotePort);
  });

  afterEach(function() {
    runs(function() { windowManager.closeAll(); });
  });

  it('should outpost from the opening side, then respond to invoke', function()
  {
    runs(function() {
      var server = new CapServer();
      tunnel.setLocalResolver(function(instID) {
        return server.publicInterface;
      });
      var otherSideGotResponse = false;
      var cap = server.grant(function(v) {
        if (v === 'Got response') {
          otherSideGotResponse = true;
        }
        return 'invoked';
      });
      tunnel.initializeAsOutpost(server, [cap]);
      waitsFor(function() { return otherSideGotResponse; },
               'response timeout', 250);
    });
  });
});
