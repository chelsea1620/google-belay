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

var belayPort = (function() {
  
  var portQueue = new PortQueue();

  var loader = function(evt) {
    var divChannel = document.createElement('div');
    divChannel.style.display = 'none';
    divChannel.id = '__belayDivChannel';
    document.body.appendChild(divChannel);

    var port = {
      postMessage: function(message, ports) {
        if(ports && ports.length > 0) { throw 'belayPort: Can\'t send ports'; }
        divChannel.innerText = JSON.stringify(message);
        
        var evt = document.createEvent('Event');
        evt.initEvent('postMessage', true, true);
        divChannel.dispatchEvent(evt);
      },
      onmessage: function(_) { throw 'belayPort: No onmessage handler.' }
    };

    portQueue.setPort(port);

    divChannel.addEventListener('onmessage', function(evt) {
      var message = JSON.parse(divChannel.innerText);
      port.onmessage(message);  

      evt.preventDefault();
      return false;
    });

    window.removeEventListener('load', loader);
  };
  window.addEventListener('load', loader);

  return portQueue;
})();
