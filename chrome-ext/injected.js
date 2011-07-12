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

var divChannel = document.createElement('div');
divChannel.style.display = 'none';
divChannel.id = '__belayDivChannel';
document.body.appendChild(divChannel);

var script = document.createElement('script');
var innerText = 'window.belay = (function() {' + 
'  var divChannel = document.getElementById("__belayDivChannel");' +
'  var callbackCount = 0;' +
'  function setupCallback(name, f, args) {' +
'       var evt = document.createEvent("Event");' +
'       evt.initEvent("forBGPage", true, true);' +
'       var fName = name + callbackCount++;' +
'       divChannel.addEventListener(fName, function(evt) {' +
'         var ser = f.apply(null, JSON.parse(divChannel.innerText));' +
'         if(ser) divChannel.innerText = JSON.stringify(ser);' +
'         else    divChannel.innerText = "";' +
'       });' +
'       var msg = { method: name,' +
'                   callbackName: fName,' +
'                   args: args};' +
'       divChannel.innerText = JSON.stringify(msg);' +
'       divChannel.dispatchEvent(evt);' +
'  }' +
'  return {' +
'     offer: function(rcList, info, f) { setupCallback("offer", f, [rcList, info]); },' +
'     accept: function(rcList, info, f) { setupCallback("accept", f, [rcList, info]); }' +
'  };' +
'})()';

script.innerText = innerText;
document.head.appendChild(script);

function parseArgs() {
  return JSON.parse(divChannel.innerText);
}


chrome.extension.onRequest.addListener(
  // { args : [ rcList, info, cap? ], callbackName : Str },
  // backgroundPageInfo,
  // (Cap -> Undef) + (Undef -> Undef)
  // -> Undef
  function(request, sender, sendResponse) {
    divChannel.innerText = JSON.stringify(request.args);

    var callbackName = request.callbackName;
    var evt = document.createEvent('Event');
    evt.initEvent(callbackName, true, true);
    divChannel.dispatchEvent(evt);

    var response = divChannel.innerText;
    if(response) sendResponse(JSON.parse(response));
    else         sendResponse();
  });

divChannel.addEventListener('forBGPage', function(evt) {
  chrome.extension.sendRequest(JSON.parse(divChannel.innerText));
});

chrome.extension.sendRequest({ method: 'refresh', args: [] });
