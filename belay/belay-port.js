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
    iframe.name = 'belay-frame';
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

    function highlight(args) {
      unhighlight();
      toArray(window.document.getElementsByClassName(args.className))
      .filter(function(elt) {
        var ixrc = elt.getAttribute('data-rc');
        return args.rc === '*' || ixrc === '*' || ixrc === args.rc;
        // TODO(mzero): in theory only one of ixrc or rc should be checked for
        // wildcard, depending on if we are hilighting targets are sources.
       })
      .forEach(function(elt) {
        elt.className = elt.className + ' ' + HIGHLIGHT_CLASS;
      });
    };


    // TODO(mzero): These Comms functions are identical to the ones in
    // belay-frame.html and should be factored out once we have a build system.
    function MessageChannelComms(remoteWindow, origin, handleInit, firstEvent) {
      if (handleInit) {
        handleInit({
          belayPort: firstEvent.ports[0],
          actionPort: firstEvent.ports[1],
          initData: firstEvent.data
        })
      } else {
        var belayChan = new MessageChannel();
        var actionChan = new MessageChannel();

        return {
          belayPort: belayChan.port1,
          actionPort: actionChan.port1,
          postInit: function(msg) {
            remoteWindow.postMessage(
              msg,
              // two following args. backward for Chrome and Safari
              [belayChan.port2, actionChan.port2],
              origin);
          }
        };
      }
    }
    
    function MultiplexedComms(remoteWindow, origin, handleInit, firstEvent) {
      var ConcentratedPort = function(id) {
        this.id = id;
        this.onmessage = null;
      };
      ConcentratedPort.prototype.postMessage = function(data) {
        remoteWindow.postMessage({ id: this.id, data: data }, origin);
      };
      
      var ports = {
        belay: new ConcentratedPort('belay'),
        action: new ConcentratedPort('action')
      }
      
      function handleEvent(e) {
        if (e.source != remoteWindow) { return; }
        if (e.origin != origin && origin != '*') { return; }
        if (e.data.id in ports) {
          var onmessage = ports[e.data.id].onmessage;
          if (onmessage) { onmessage({ data: e.data.data }); }
        }
        else if (handleInit && e.data.id == 'init') {
          handleInit({
            belayPort: ports.belay,
            actionPort: ports.action,
            initData: e.data.data
          });
        }
        e.stopPropagation();
      }
      
      window.addEventListener('message', handleEvent, false);
      if (handleInit) {
        handleEvent(firstEvent)
      } else {
        return {
          belayPort: ports.belay,
          actionPort: ports.action,
          postInit: function(msg) {
            remoteWindow.postMessage({ id: 'init', data: msg }, origin)            
          }
        }        
      }
    }
    
    var connect = function(event) {
      window.removeEventListener('message', connect);

      function init(comms) {
        comms.actionPort.onmessage = function(msg) {
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
            highlight(msg.data.args);
          } else if (msg.data.op === 'navigate') {
            window.location = msg.data.args.url;
            window.name = msg.data.args.startId;
              // TODO(iainmcgin): exposing the startId to a potentially untrusted
              // outer window may give it a way to hijack the launch of an
              // instance. The implications of this need investigation.
          } else {
            console.log('unknown action', msg);
          }
        };

        window.belay.port = comms.belayPort;
        window.belay.portReady(function() {
          comms.actionPort.postMessage(
            // cross-domain <iframe> can set window.location but cannot read it
            { DEBUG: window.belay.DEBUG,
              // required on Chrome 14
              location: window.location.href,
              startId: startId });
        });
      }
          
      ('MessageChannel' in window
              ? MessageChannelComms
              : MultiplexedComms)(iframe.contentWindow, '*', init, event);
    };

    window.addEventListener('message', connect)

  };

  if (window.document.body === null) {
    window.addEventListener('load', onWindowLoaded);
  }
  else {
    onWindowLoaded();
  }

})();
