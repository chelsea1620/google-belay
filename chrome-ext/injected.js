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


var butterBar = function(msg, sendResp) {
  var bar = $('<div id="belaySuggest"' +
              'style="position: fixed; width: 100%; height: 18pt; ' +
                     'left: 0px; top: -18pt; background-color: #ffffcc;' +
                     'font-family: Helvetica, sans-serif; font-size: 12pt;' +
                     '-webkit-transition: -webkit-transform 0.5s ease-in' +
                     '">' +
               '<span>I recognize you</span>' +
               '</div>');

  Object.keys(msg.suggests).forEach(function(instID) {
    var btn = $('<button></button>');
    btn.text(msg.suggests[instID]);
    btn.click(function() { bar.remove(); sendResp(instID); });
    bar.append(btn);
  });

  closeBtn = $('<button>Close</button>');
  bar.append(closeBtn);
  closeBtn.click(function() { bar.remove(); });

  $(document.body).append(bar);
  window.setTimeout(
    function() { bar.css('webkitTransform', 'translateY(18pt)'); }, 0);
};

var initialize = function(divChannel) {
  chrome.extension.onRequest.addListener(
    function(message, sender, sendResponse) {
      if (message.op === 'butterBar') {
        butterBar(message, sendResponse);
      }
      else {
        // This data field simulates the data field on PostMessage events.
        divChannel.innerText = JSON.stringify({data: message});

        var evt = document.createEvent('Event');
        evt.initEvent('onmessage', true, true);
        divChannel.dispatchEvent(evt);
      }
  });

  chrome.extension.sendRequest({ type: 'init' });

  divChannel.addEventListener('postMessage', function(evt) {
    var message = JSON.parse(divChannel.innerText);
    chrome.extension.sendRequest(message);
    evt.preventDefault();
    return false;
  });
};

var divChannel = document.getElementById('__belayDivChannel');

if (divChannel) initialize(divChannel); 
else {
  document.addEventListener('DOMNodeInsertedIntoDocument', function (evt) {
    if(evt.srcElement.id === '__belayDivChannel') {
      initialize(evt.srcElement);
    }
  }, true);
}


// Illuminate elements for the background page.
(function () {
  var port = chrome.extension.connect({ name: 'highlight' });

  var highlightClassName = 'belay-possible';

  var onHighlight = function(args) {
    var rc = args.rc;
    var className = args.className;
    console.assert(typeof rc === 'string' && 
                   typeof className === 'string');
    
    onUnHighlight({ });
    $(document)
    .find('.' + className)
    .filter(function(ix) {
      var ixrc = this.getAttribute('data-rc');
      return rc === '*' || ixrc === '*' || ixrc === rc ;
      // TODO(mzero): in theory only one of ixrc or rc should be checked for
      // wildcard, depending on if we are hilighting targets are sources. 
     })
    .addClass(highlightClassName);
  };

  var onUnHighlight = function(args) {
    $(document)
    .find('.' + highlightClassName)
    .removeClass(highlightClassName);
  };

  var handlers = {
    'highlight': onHighlight,
    'unhighlight': onUnHighlight
  };

  port.onMessage.addListener(function(msg) { 
    handlers[msg.type](msg); 
  });
})();

