var $ = os.jQuery;

var rcIntroduceYourself = "friend/introduce-yourself";

var initMessagesUI = function(container, showHideMessages) {
  if (container.attr('class') !== 'bfriendr-messages') { debugger; }

  // handles to UI elements; wackiness with classNames
  var msgs = container.find('ul:first');
  var friendNameElt = container.find('.bfriendr-message-friendname');
  var textMsgTemplate = msgs.find('.bfriendr-message:first');
  var capMsgTemplate = msgs.find('.bfriendr-message:eq(1)');
  var sendButton = msgs.find('button:eq(0)');
  var composeTextArea = msgs.find('textarea:eq(0)');
  var showFriendPane = container.find('.bfriendr-nav');

  var pollIntervalID = false;

  showFriendPane.click(function() { 
    if (pollIntervalID !== false) {
      os.clearInterval(pollIntervalID);
      pollIntervalID = false;
    }

    showHideMessages(false); 
    return false; 
  });

  var showMsg = function(msg) {

    // TODO(arjun): account for a capability
    var msgElt = textMsgTemplate.clone();
    msgElt.find('p:eq(1)').text(msg.message || 'Received blank message.');
    msgElt.find('.bfriendr-date:first').text(msg.when);
    msgs.append(msgElt);

  };

  var mkRefreshConvHandler = function(conversationCap) {
    return function() {
      conversationCap.get(function(conv) {
      msgs.find('.bfriendr-message').detach();
      conv.items.forEach(showMsg);
      });
    };
  };

  var refresh = function(friendName, conversationCap, postCap) {  
    var handler = mkRefreshConvHandler(conversationCap);
    handler();

    pollIntervalID = os.setInterval(handler, 2000);
    sendButton.unbind('click');

    showHideMessages(true);
    friendNameElt.text(friendName);

    sendButton.click(function() {
      postCap.post({ 'message' : composeTextArea.val() }, 
                   function() { handler(); });
    });
    
  };

  return {
    refresh: refresh,
    shm: showHideMessages
  }; 
    
};


var initCardUI = function(container, messageUI) {
  var template = container.find('.bfriendr-card:first');
  container.find('.bfriendr-card').detach(); // removes extra templates too

  var updateCard = function(ui) {
    var nameElt = ui.find('h3');
    var infoElt = ui.find('p:eq(0)');
    var messagesElt = ui.find('.bfriendr-nav');
    var imgContainerElt = ui.find('.bfriendr-cardimg');

    return function(friendInfo) {
      nameElt.text(friendInfo.card.name || 'No Name');
      infoElt.text(friendInfo.card.notes || 'No Notes');
      messagesElt.click(function() {
        try {
          messageUI.refresh(friendInfo.card.name || 'No Name',
                          // HACK(arjun): should already be a cap
			  os.capServer.restore(friendInfo.readConversation),
                          // HACK(arjun): should already be a cap
			  os.capServer.restore(friendInfo.postToMyStream));
        } 
        catch(e) {
	   console.log('exception', e);
	}
        return false;
      });
      
      if (friendInfo.card.image) {
        var imgElt = imgContainerElt.find('img');
        if (imgElt.length == 0) {
          imgElt = imgContainerElt.append('<img>').find('img');
        }
        imgElt.attr('src', friendInfo.card.image);
      } else {
        imgContainerElt.find('img').remove();
      }
    };
  };

  var newCard = function(friendCap) {
    var cardElt = template.clone();
    friendCap.get(updateCard(cardElt));
    container.prepend(cardElt);
  };

  return {
    newCard: newCard
  };  
};

var showCards = function(friendsCap, cardUI) {
  friendsCap.get(function(friendCapURLs) {
    // HACK(arjun): server should grant { '@': url }; argument should be
    // friendCaps.
    var friendCaps = 
      friendCapURLs.map(function(url) { return os.capServer.restore(url); });

    friendCaps.forEach(cardUI.newCard);  
  });
};

var initialize = function() {
  os.ui.resize('300', '480', true);

  var header = os.topDiv.find('.bfriendr-header');
  var myCardDiv = os.topDiv.find('div.bfriendr-mycard');
  var myCardToggle = os.topDiv.find('.bfriendr-header .bfriendr-nav');
  var myCardShown = false;
  var myCardImageDiv = myCardDiv.find('div.bfriendr-cardimg');
  var cardListDiv = os.topDiv.find('div.bfriendr-cards');
  var messagesDiv = os.topDiv.find('div.bfriendr-messages');
  var addFriendArea = os.topDiv.find('.bfriendr-add');

  for (var k in app.caps) {
    app.caps[k] = os.capServer.restore(app.caps[k]);
  }
  
  var showHideMyCard = function(show) {
    if (show) {
      myCardDiv.slideDown('fast', function() {
        myCardToggle.css('background-position', '0 -34px');
      });
    } else {
      myCardDiv.slideUp('fast', function() {
        myCardToggle.css('background-position', '0 -4px');
      });
    }
    myCardShown = show;
  };
  myCardToggle.click(
    function() { showHideMyCard(!myCardShown); return false; });
  
  var showHideMessages = function(show) {
    if (show) {
      cardListDiv.animate({left: '-100%'}, 'fast');
      messagesDiv.animate({left: '0%'}, 'fast');
    } else {
      cardListDiv.animate({left: '0%'}, 'fast');
      messagesDiv.animate({left: '100%'}, 'fast');
    }
  };

  var uploadMyImageUrl = undefined;
  
  var fetchMyCard = function() {
    app.caps.myCard.get(function(cardInfo) {
      myCardDiv.find('input[name=name]').val(cardInfo.name);
      myCardDiv.find('input[name=email]').val(cardInfo.email);
      myCardDiv.find('textarea').val(cardInfo.notes);
      if (cardInfo.image) {
        var imgElt = myCardImageDiv.find('img');
        if (imgElt.length == 0) {
          imgElt = myCardImageDiv.append('<img>').find('img');
        }
        imgElt.attr('src', cardInfo.image);
      } else {
        myCardImageDiv.find('img').remove();
      }
      uploadMyImageUrl = cardInfo.uploadImage;
      if (cardInfo.name.trim().length == 0) {
        showHideMyCard(true);
      }
    });
  };
  
  fetchMyCard();
    
  var imageTypeRE = /image\/.*/;
  var preventDf = function(e) {
      e.originalEvent.preventDefault();
      return false;   
  };
  myCardImageDiv.bind('dragenter', preventDf);
  myCardImageDiv.bind('dragover', preventDf);
  myCardImageDiv.bind('drop', function(e) {
    var draggedFile;
    var dt = e.originalEvent.dataTransfer;
    for (var i = 0; i < dt.files.length; ++i) {
      var file = dt.files[i];
      if (!file.type.match(imageTypeRE)) continue;
      draggedFile = file;
      break;
    }
    if (draggedFile && uploadMyImageUrl) {
      var fd = new os.FormData();
      fd.append('imageFile', draggedFile);
      $.ajax({
        url: uploadMyImageUrl,
        cache: false,
        type: 'POST',
        contentType: false,
        processData: false,
        data: fd,
        success: fetchMyCard,
      });       
    }
  });
  
  myCardDiv.find('button').click(function() {
    var cardInfo = {
      name: myCardDiv.find('input[name=name]').val(),
      email: myCardDiv.find('input[name=email]').val(),
      notes: myCardDiv.find('textarea').val(),
    };
    app.caps.myCard.put(cardInfo);
  })
  
  os.ui.capDraggable(myCardToggle, rcIntroduceYourself,
    function(selectedRC) { return app.caps.introduceYourself; });
  os.ui.capDroppable(addFriendArea, rcIntroduceYourself,
    function(cap) { app.caps.introduceMeTo.post({introductionCap: cap.serialize() }); });

  var messageUI = initMessagesUI(messagesDiv, showHideMessages);
  showCards(app.caps.friends, initCardUI(cardListDiv, messageUI));
};

// TODO(arjun): Retreiving vanilla HTML. Not a Belay cap?
$.ajax({
  url: 'http://localhost:9009/bfriendr.html',
  dataType: 'text',
  success: function(data, status, xhr) {
    os.topDiv.html(data);
    initialize();
  },
  error: function(xhr, status, error) {
    os.alert('Failed to load bfriendr html: ' + status);
  }
});
