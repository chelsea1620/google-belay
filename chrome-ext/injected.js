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



var initialize = function(divChannel) {
  chrome.extension.onRequest.addListener(
    function(message, sender, sendResponse) {
      // This data field simulates the data field on PostMessage events.
      divChannel.innerText = JSON.stringify({data: message});

      var evt = document.createEvent('Event');
      evt.initEvent('onmessage', true, true);
      divChannel.dispatchEvent(evt);
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

  var sourceSel = '.belay-cap-source';
  var highlightClassName = 'belay-possible';

  var onHighlight = function(args) {
    var rc = args.rc;
    console.assert(typeof rc === 'string');
    
    onUnHighlight({ });
    $(document)
    .find(sourceSel)
    .filter(function(ix) { 
      return rc === '*' || this.getAttribute('data-rc') === rc; 
     })
    .addClass(highlightClassName);
  };

  var onUnHighlight = function(args) {
    $(document)
    .find(sourceSel)
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

