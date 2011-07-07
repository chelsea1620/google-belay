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

var me = os.topDiv;

var postComplete = function(succeeded) {
  me.find('.emote-message-posting').hide();
  var m = me.find(
    succeeded ? '.emote-message-posted' : '.emote-message-failed');
  m.show();
  os.setTimeout(function() { m.fadeOut('slow'); }, 3000);
};

var rcPost = 'urn:x-belay://resouce-class/social-feed/post';
var showPanel = function(feedCap) {
  me.find('.emote-panel').show();
  me.find('.emote-post').click(function(ev) {
    me.find('.emote-message-posting').show();
    feedCap.post(
      { body: ev.target.innerText, via: 'emote' },
      function() { postComplete(true); },
      function() { postComplete(false); }
    );
    ev.preventDefault();
    return false;
  });
};

me.load('http://localhost:9005/emote.html', function() {
  os.ui.resize(160, 90, false);

  var feedCap = os.storage.get();

  if (feedCap) {
    showPanel(os.capServer.restore(feedCap));
  }
  else {
    var invite = me.find('.emote-invite');
    invite.show();
    os.ui.capDroppable(invite, rcPost, function(ser) {
      invite.hide();
      showPanel(os.capServer.restore(ser));
      os.storage.put(ser);
    });
  }
});
