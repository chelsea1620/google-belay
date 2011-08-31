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
    var actionChan = new MessageChannel();
    
    window.belay.port = chan.port1;
    window.belay.portReady();

    iframe.removeEventListener('load', connect);

    iframe.contentWindow.postMessage(
      // cross-domain <iframe> can set window.location but cannot read it
      window.location, 
      // two following args. backward for Chrome and Safari
      [chan.port2, actionChan.port2], 
      '*');

    actionChan.port1.onmessage = function(msg) {
      if (msg.data === 'close') {
        // This trick is all over the Web.
        window.open('', '_self').close();
      }
      else {
        console.log('unknown action', msg);
      }
    };
  };

  iframe.addEventListener('load', connect);

});
