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


var postComplete = function(succeeded) {
  $('#emote-message-posting').hide();
  var m = $(succeeded ? '#emote-message-posted' : '#emote-message-failed');
  m.show();
  setTimeout(function() { m.fadeOut('slow'); }, 3000);
};

var rcPost = 'urn:x-belay://resouce-class/social-feed/postable';
var showPanel = function(postCap, nameCap) {
  nameCap.get(function(name) {
    $('#emote-target').text('to ' + name);
  });
  $('#emote-panel').show();
  $('.emote-post').click(function(ev) {
    $('#emote-message-posting').show();
    postCap.post(
      { body: ev.target.innerText, via: 'emote' },
      function() { postComplete(true); },
      function() { postComplete(false); }
    );
    ev.preventDefault();
    return false;
  });
};

onBelayReady(function() {
  
  if(!belay.outpost.temporaryInstance) {
    // we are a configured instance of emote, configure the
    // post panel.
    showPanel(capServer.restore(belay.outpost.info.post),
              capServer.restore(belay.outpost.info.name));
  } else {
    // the user has just opened this page directly.
    // ask the user to drag-drop the postable capability from buzzer.
    var invite = $('#emote-invite');
    invite.show();
    ui.capDroppable(invite, rcPost, function(postableCap, rc) {
      postableCap.post(rcPost, function(buzzerCaps) {
        var postCap = buzzerCaps.post;
        var nameCap = buzzerCaps.name;
        nameCap.get(function(name) {
          var emoteInstanceCap = capServer.restore(window.location.origin + '/generate');
          emoteInstanceCap.post({ postCap: postCap, nameCap: nameCap, name: name }, 
            function(response) { belay.outpost.becomeInstance.put(response); }, 
            function() { alert('failed to generate :-('); });
        });
      });
    });
  }
});
