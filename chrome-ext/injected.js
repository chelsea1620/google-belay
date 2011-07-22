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
  var bar = $('<div id="belaySuggest"></div>');
  bar.css({
    position: 'fixed',
    width: '100%',
    left: '0',
    top: '-1000px',
    backgroundColor: '#ffc',
    fontFamily: 'Helvetica, sans-serif',
    fontSize: '10pt',
    paddingTop: '0.5em',
    paddingBottom: '0.5em',
    borderBottom: 'solid 1px #630'
  });
  var hiddenPosition;

  var commonCSS = {
    paddingLeft: '0.5em',
    paddingRight: '0.5em',
  };
  
  var lead = $('<span>Existing items:</span>');
  lead.css(commonCSS);
  bar.append(lead);

  Object.keys(msg.suggests).forEach(function(instID) {
    var btn = $('<button></button>');
    btn.css(commonCSS);
    btn.css('-webkit-appearance', 'square-button');
    btn.text(msg.suggests[instID]);
    btn.click(function() { bar.remove(); sendResp(instID); });
    bar.append(btn);
  });
  
  closeBtn = $('<span>⊗</span>');
  closeBtn.css(commonCSS);
  closeBtn.css('float', 'right');
  bar.append(closeBtn);
  closeBtn.click(function() {
    bar.css('top', hiddenPosition);
    window.setTimeout(function() { bar.remove(); }, 1000);
    });

  $(document.body).append(bar);
  hiddenPosition = '-' + bar.outerHeight() + 'px';
  bar.css('top', hiddenPosition);

  window.setTimeout(function() {
    bar.css({
      top: 0,
      '-webkit-transition': 'all 0.5s ease-in'
    });
  }, 0);
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

