var openerPort = (function() {
  if(!window.opener) { return undefined; }
  var channel = new MessageChannel();
  var wrappedPort = new PortQueue();
  wrappedPort.setPort(channel.port2);
  window.opener.postMessage('remoteReady', [channel.port1], '*');
  // WARNING: postMessage argument order here is Chrome's not HTML5 spec's
  return wrappedPort;
})();

