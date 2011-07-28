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
  topDiv.find('.emote-message-posting').hide();
  var m = topDiv.find(
    succeeded ? '.emote-message-posted' : '.emote-message-failed');
  m.show();
  setTimeout(function() { m.fadeOut('slow'); }, 3000);
};

var rcPost = 'urn:x-belay://resouce-class/social-feed/post';
var showPanel = function(feedCap) {
  topDiv.find('.emote-panel').show();
  topDiv.find('.emote-post').click(function(ev) {
    topDiv.find('.emote-message-posting').show();
    feedCap.post(
      { body: ev.target.innerText, via: 'emote' },
      function() { postComplete(true); },
      function() { postComplete(false); }
    );
    ev.preventDefault();
    return false;
  });
};

onBelayReady(function() {
  ui.resize(160, 90, false);


  storage.get(function(feedCap) {

    if (feedCap) {
      showPanel(capServer.restore(feedCap));
    }
    else {
      var invite = topDiv.find('.emote-invite');
      invite.show();
      ui.capDroppable(invite, rcPost, function(cap) {
        invite.hide();
        showPanel(cap);
        storage.put(cap.serialize());
      });
    }
  });
});
