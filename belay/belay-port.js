// Sets window.belayPort to a MessagePort.
// Invokes window.belayPortReady(window.belayPort), if the function is defined.
window.belay = { };

window.addEventListener('load', function() {
  var IFRAME_URL = "http://localhost:9000/belay-frame.html";

  var iframe = document.createElement("iframe");
  iframe.setAttribute("src", IFRAME_URL);
  document.body.appendChild(iframe);
 
  var connect = function() {
    var chan = new MessageChannel();
    // backward for Chrome and Safari
    iframe.contentWindow.postMessage('', [chan.port2], '*');
    window.belay.port = chan.port1;
    if (typeof window.belay.portReady === 'function') {
      window.belay.portReady();
    }

    iframe.contentWindow.removeEventListener('load', connect);
  };

  iframe.contentWindow.addEventListener('load', connect);

});
