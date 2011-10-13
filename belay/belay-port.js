// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Sets window.belayPort to a MessagePort.
// Invokes belay.portReady(), if the function is defined.

if (!window.belay) {
  window.belay = {
    DEBUG: false
  };
}

(function() {
  // get the start id and hide it as soon as possible
  var startId = window.name;
  window.name = '';

  function onWindowLoaded() {

    var IFRAME_BASE = window.belay.BASE || 'https://belay-belay.appspot.com';
    var IFRAME_URL = IFRAME_BASE + '/belay-frame.html';
    var IFRAME_HEIGHT = window.belay.DEBUG ? '300px' : '40px';
    var IFRAME_NEG_HEIGHT = '-' + IFRAME_HEIGHT;
    var HIGHLIGHT_CLASS = 'belay-possible';

    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', IFRAME_URL);
    iframe.style.zIndex = 2000; // high enough???
    iframe.style.position = 'absolute';
    iframe.style.top = IFRAME_NEG_HEIGHT;
    iframe.style.left = '0px';
    iframe.style.width = '100%';
    iframe.style.height = IFRAME_HEIGHT;
    iframe.style.backgroundColor = '#ffffcc';
    iframe.style.border = '0px';
    if (window.belay.DEBUG) {
      iframe.style.position = 'relative';
    }
    document.body.appendChild(iframe);

    function toArray(v) {
      return Array.prototype.slice.call(v);
    }

    function unhighlight() {
      var elts = window.document.getElementsByClassName(HIGHLIGHT_CLASS);
      toArray(elts).forEach(function(elt) {
        elt.className = elt.className.replace(' ' + HIGHLIGHT_CLASS,
                                              ' ');
      });
    }

    function highlight(rc, className) {
      unhighlight();
      toArray(window.document.getElementsByClassName(className))
      .filter(function(elt) {
        var ixrc = elt.getAttribute('data-rc');
        return rc === '*' || ixrc === '*' || ixrc === rc;
        // TODO(mzero): in theory only one of ixrc or rc should be checked for
        // wildcard, depending on if we are hilighting targets are sources.
       })
      .forEach(function(elt) {
        elt.className = elt.className + ' ' + HIGHLIGHT_CLASS;
      });
    };

    var connect = function() {
      var belayChan = new MessageChannel();
      // Certain window-manipulating actions cannot be performed by the cross-
      // domain IFrame and are handled on this page by actionChan. Do not
      // introduce a dependency on caps.js; it's stupid and would be broken
      // by an adversarial container.
      var actionChan = new MessageChannel();

      window.belay.port = belayChan.port1;
      window.belay.portReady();

      iframe.removeEventListener('load', connect);


      actionChan.port1.onmessage = function(msg) {
        if (msg.data === 'close') {
          // This trick is all over the Web.
          window.open('', '_self').close();
        } else if (msg.data === 'showButterBar') {
          iframe.style.webkitTransition = 'all 0.5s ease-in';
          iframe.style.top = '0px';
        } else if (msg.data === 'hideButterBar') {
          if (window.belay.DEBUG) {
            // .top doesn't work because it is relative
            iframe.style.display = 'none';
          }
          else {
            iframe.style.top = IFRAME_NEG_HEIGHT;
          }
        } else if (msg.data === 'unhighlight') {
          unhighlight();
        } else if (msg.data.op === 'highlight') {
          highlight.apply(null, msg.data.args);
        } else if (msg.data.op === 'redirect') {
          window.location = msg.data.url;
          window.name = msg.data.startId;
        } else {
          console.log('unknown action', msg);
        }
      };

      iframe.contentWindow.postMessage(
        // cross-domain <iframe> can set window.location but cannot read it
        { DEBUG: window.belay.DEBUG,
          // required on Chrome 14
          clientLocation: window.location.href,
          clientStartId: startId },
        // two following args. backward for Chrome and Safari
        [belayChan.port2, actionChan.port2],
        '*');
    };

    iframe.addEventListener('load', connect);

  };

  if (window.document.body === null) {
    window.addEventListener('load', onWindowLoaded);
  }
  else {
    onWindowLoaded();
  }

})();
