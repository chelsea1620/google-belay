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
