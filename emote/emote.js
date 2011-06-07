var me = os.topDiv;


var rcPost = "urn:x-belay://resouce-class/social-feed/post";
var showPanel = function (feedCap) {
  me.find('.emote-panel').show();
  me.find('.emote-post').click(function(ev) {
    me.find('.emote-message-posting').show();
    feedCap.invoke({
      data: { body: ev.target.innerText, via: 'emote' },
      type: 'POST',
      complete: function(xhr,status) {
        me.find('.emote-message-posting').hide();
        var m = me.find(
          status == 'success'
            ? '.emote-message-posted'
            : '.emote-message-failed');
        m.show();
        os.setTimeout(function() { m.fadeOut('slow'); }, 3000);
      },
    });
    ev.preventDefault();
    return false;
  });
};

me.load("http://localhost:9005/emote.html", function() {
  os.ui.resize(160,90,false);

  var feedCap = os.storage.get();
  
  if (feedCap) {
    showPanel(os.capServer.restore(feedCap));
  }
  else {
    var invite = me.find('.emote-invite');
    invite.show();
    os.ui.capDroppable(invite, rcPost, function(cap) {
      invite.hide();
      showPanel(cap);
      os.storage.put(cap.serialize());
    });
  }  
});
