var log = function(text) {
  os.$('<li></li>').text(text).appendTo('#transcript');
};

os.$(function() {
  var openerPort = os.window.opener; log('Constructed port');
  var tunnel = new os.CapTunnel(openerPort); log('Constructed tunnel');
  var server = new os.CapServer(); log('Constructed server');
  tunnel.setLocalResolver(function(instID) {
    return server.publicInterface;
  });
  server.setResolver(tunnel.remoteResolverProxy);

  var intervalID;
  var timerID;
  var cap;

  tunnel.setOutpostHandler(function(msg) {
    cap = server.restore(msg.seedSers[0]);
    go();
  });

  function go() {
    cap.post({body: ':-)', via: 'emote'}, function(r) {
      log('Got response (before foop 2): ' + os.JSON.stringify(r));
    }, function() { log('Other end failed'); });
    os.foop('subemote.js', os.$('#invoker'), {$: os.$, log: log, cap: cap});
  }
});
