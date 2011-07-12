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

// { tabID : { callbackName : [ rcList, info ] }}
var offerMap = Object.create(null);
var acceptMap = Object.create(null);

chrome.extension.onRequest.addListener(
  function(request, sender, sendResponse) {
    var tabID = sender.tab.id;

    // Just for testing
    if(request.args[0] === 'ping') { 
      chrome.tabs.sendRequest(sender.tab.id, { args: ['pong'], callbackName: request.callbackName },
                              function() { });
      return;
    }

    if (request.method === 'refresh') {
      offerMap[tabID] = Object.create(null);
      acceptMap[tabID] = Object.create(null);
    }
    else if (request.method === 'offer') {
      if (typeof request.callbackName === 'string') {
        offerMap[tabID][request.callbackName] = request.args;
      }
    }
    else if (request.method === 'accept') {
      if (typeof request.callbackName === 'string') {
        acceptMap[tabID][request.callbackName] = request.args;
      }
    }
    else {
      console.log('unexpected message ', request);
    }

  });


function __autoTest() {
setInterval(function() {
  for(var i in offerMap) {
    for(var callback in offerMap[i]) {

      var args = offerMap[i][callback];

      if(! args[0][0].match(/test/)) continue;

      for(var j in acceptMap) {
        for(var callback2 in acceptMap[j]) {
          var args2 = acceptMap[j][callback2]; 

          if(! args[0][0].match(/test/)) continue;
          
          chrome.tabs.sendRequest(Number(i), { args: args2, callbackName: callback },
            function(v) { 
              var argsWithCap = args.concat([v]);
              chrome.tabs.sendRequest(Number(j), { args: argsWithCap,
                                                   callbackName: callback2 });
            });
        }
      }
    }
  }
}, 200);
}

__autoTest();
