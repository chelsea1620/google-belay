onBelayReady(function() {
  if(window.belay.outpost.temporaryInstance) {
    window.location.pathname = '/';
    return;
  }

  var info = window.belay.outpost.info;

  function rebuild(instanceInfo) {
    $('#buzzer-title').text(instanceInfo.name);
    
    if(instanceInfo.authorInfo) {
      $('#buzzer-author').text(instanceInfo.authorInfo);
      $('#buzzer-author').show();
    } else {
      $('#buzzer-author').hide();
    }

    var postContainer = $('.previous-posts');
    postContainer.empty();
    instanceInfo.posts.forEach(function(post) {
      // timezoneOffset is in minutes
      var tzOffsetMs = new Date().getTimezoneOffset() * 60 * 1000;
      var localPostTime = new Date(post.timestamp + tzOffsetMs);
      var timeStr = localPostTime.toLocaleString();
      var postElem = $('<div>', { class: "post"});
      postElem.append($('<div>', { class: "content", text: post.content }));
      postElem.append($('<div>', { class: "time", text: timeStr }));
      postElem.append($('<div>', { class: "via", text: post.via }));
      postContainer.append(postElem);
    });
  }

  function refresh() {
    info.refreshAllCap.get(rebuild);
  }

  function post() {
    var content = $('#post-content').val();
    if(content.length < 1) {
      // TODO(iainmcgin): flash the text area
      return;
    }

    info.postCap.post({ 'content': content }, refresh);
  }

  $('#post-button').click(post);
  rebuild(info.buzzer);
});