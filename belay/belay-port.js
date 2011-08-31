// Sets window.belayPort to a MessagePort.
// Invokes window.belayPortReady(window.belayPort), if the function is defined.
window.belay = { 
  DEBUG: true,
};

window.addEventListener('load', function() {

  var IFRAME_URL = "http://localhost:9000/belay-frame.html";
  var IFRAME_HEIGHT = window.belay.DEBUG ? '300px' : '40px';

  var iframe = document.createElement("iframe");  
  iframe.setAttribute("src", IFRAME_URL);
  iframe.style.zIndex = 2000; // high enough???
  iframe.style.position = 'absolute';
  iframe.style.top = '-' + IFRAME_HEIGHT;
  iframe.style.left = '0px';
  iframe.style.width = '100%';
  iframe.style.height = IFRAME_HEIGHT;
  iframe.style.backgroundColor = '#ffffcc';
  iframe.style.border = '0px';
  
  if (window.belay.DEBUG) {
    iframe.style.position = 'relative';
  }

  document.body.appendChild(iframe);
 
  var connect = function() {

    var chan = new MessageChannel();
    var actionChan = new MessageChannel();
    
    window.belay.port = chan.port1;
    window.belay.portReady();

    iframe.removeEventListener('load', connect);


    actionChan.port1.onmessage = function(msg) {
      if (msg.data === 'close') {
        // This trick is all over the Web.
        window.open('', '_self').close();
      }
      else if (msg.data === 'showButterBar') {
        iframe.style.webkitTransition = 'all 0.5s ease-in';
        iframe.style.top = '0px';
      }
      else if (msg.data === 'hideButterBar') {
        if (window.belay.DEBUG) {
          // .top doesn't work because it is relative
          iframe.style.display = 'none';
        }
        else {
          iframe.style.top = '-' + IFRAME_HEIGHT;
        }
      }
      else {
        console.log('unknown action', msg);
      }
    };
    
    iframe.contentWindow.postMessage(
      // cross-domain <iframe> can set window.location but cannot read it
      { DEBUG: window.belay.DEBUG, clientLocation: window.location }, 
      // two following args. backward for Chrome and Safari
      [chan.port2, actionChan.port2], 
      '*');
  };

  iframe.addEventListener('load', connect);

});
