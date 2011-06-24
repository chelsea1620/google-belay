var establishWindowOpenerPort = function() {
  var channel = new MessageChannel();
  window.opener.postMessage('remoteReady', [channel.port1], '*');
  // WARNING: postMessage argument order here is Chrome's not HTML5 spec's
  channel.port2.start();
  return channel.port2;
};
