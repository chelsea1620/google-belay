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

var $ = jQuery;

var rcIntroduceYourself = 'friend/introduce-yourself';

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
  
  msgs.find('.bfriendr-message').detach();

  var latestMsgTime = '';
  var pollIntervalID = false;

  // i.e., hide this pane, detaching all timers, handlers, etc.
  var close = function() {
    if (pollIntervalID !== false) {
      clearInterval(pollIntervalID);
      pollIntervalID = false;
    }
    sendButton.unbind('click');
    showHideMessages(false);
    latestMsgTime = '';
    msgs.find('.bfriendr-message').detach();
    return false;
  }
  showFriendPane.click(close);

  var serCapRC = false;
  var capToSend = false;

  ui.capDroppable(msgs.find('.bfriendr-instructions'), '*', function(cap, capRC) {
    capToSend = cap;
    serCapRC = capRC;
    composeTextArea.val(composeTextArea.val() + " (see attached)");
  });

  var showMsg = function(msg) {
    var msgElt;
    if (typeof msg.capability === 'undefined') {
      msgElt = textMsgTemplate.clone();
    }
    else {
      msgElt = capMsgTemplate.clone();
      var chitImg = msgElt.find('img:eq(0)');
      ui.capDraggable(chitImg, msg.resource_class,
        function(selectedRC) {
          return msg.capability;
        },
        launchInfo.chitURL);
    }
    latestMsgTime = msg.when > latestMsgTime ? msg.when : latestMsgTime;
    msgElt.find('p:eq(1)').text(msg.message || 'Received blank message.');
    msgElt.find('.bfriendr-date:first').text(msg.when);
    msgs.find('li:first').after(msgElt);
  };

  var mkRefreshConvHandler = function(conversationCap) {
    return function() {
      conversationCap.post({ when: latestMsgTime }, function(conv) {
        conv.items.forEach(showMsg);
      });
    };
  };

  var refresh = function(friendName, conversationCap, postCap) {
    var handler = mkRefreshConvHandler(conversationCap);
    pollIntervalID = setInterval(handler, 2000);
    friendNameElt.text(friendName);
    composeTextArea.val('').focus();
    sendButton.click(function() {
      var msg;
      if (serCapRC === false) {
        msg = { 'message' : composeTextArea.val() };
      }
      else {
        msg = { 'message' : composeTextArea.val(),
                'resource_class': serCapRC,
                'capability': capToSend };
        capToSend = false;
        serCapRC = false;
      }
      postCap.post(msg, handler);
    });
    handler();
    showHideMessages(true);
  };

  return {
    close: close,
    refresh: refresh
  };

};

var initCardUI = function(friendsCap, container, messageUI) {
  var template = container.find('.bfriendr-card:first');
  var cardList = template.parent();
  cardList.find('.bfriendr-card').detach(); // removes extra templates too

  container.click(function() {
    messageUI.close();
    container.find('.bfriendr-card-active').removeClass('bfriendr-card-active')
  });
  
  var cardMap = Object.create(null);

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
          ui.addClass('bfriendr-card-active')
          messageUI.refresh(friendInfo.card.name || 'No Name',
                            friendInfo.readConversation,
                            friendInfo.postToMyStream);
        }
        catch (e) {
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
    if (friendCap.serialize() in cardMap) {
      return;
    }
    else {
      cardMap[friendCap.serialize()] = true;
      var cardElt = template.clone();
      friendCap.get(updateCard(cardElt));
      cardList.prepend(cardElt);
    }
  };

  var refreshCards = function() {
    friendsCap.get(function(friendCaps) {
      friendCaps.forEach(newCard);
    });
  };

  refreshCards();
  setInterval(refreshCards, 2000);

  return {
    newCard: newCard,
    refreshCards: refreshCards
  };
};

var initialize = function() {
  // ui.resize('300', '480', true);
  ui.resize('80', '80', true);

  var inPage = topDiv.hasClass('bfriendr-page');
  
  var header = topDiv.find('.bfriendr-header');
  var myCardDiv = topDiv.find('div.bfriendr-mycard');
  var myCardToggle = topDiv.find('.bfriendr-header .bfriendr-nav');
  var myCardShown = false;
  var myCardImageDiv = myCardDiv.find('div.bfriendr-cardimg');
  var cardListDiv = topDiv.find('div.bfriendr-cards');
  var messagesDiv = topDiv.find('div.bfriendr-messages');
  var addFriendArea = topDiv.find('.bfriendr-cards .bfriendr-add');
  var inviteButton = addFriendArea.find('button');

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

  var showHideMessagesPage = function(show) {
    if (show) {
      cardListDiv.addClass('narrow')
      cardListDiv.animate({width: '50%'}, 'fast');
      messagesDiv.animate({left: '50%'}, 'fast');
    } else {
      cardListDiv.removeClass('narrow')
      cardListDiv.animate({width: '100%'}, 'fast');
      messagesDiv.animate({left: '100%'}, 'fast');
    }
  };
  var showHideMessagesGadget = function(show) {
    if (show) {
      cardListDiv.animate({left: '-100%'}, 'fast');
      messagesDiv.animate({left: '0%'}, 'fast');
    } else {
      cardListDiv.animate({left: '0%'}, 'fast');
      messagesDiv.animate({left: '100%'}, 'fast');
    }
  };
  var showHideMessages = inPage ? showHideMessagesPage : showHideMessagesGadget;
  
  var uploadMyImageUrl = undefined;

  var fetchMyCard = function() {
    launchInfo.myCard.get(function(cardInfo) {
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
      var fd = new FormData();
      fd.append('imageFile', draggedFile);
      $.ajax({
        url: uploadMyImageUrl,
        cache: false,
        type: 'POST',
        contentType: false,
        processData: false,
        data: fd,
        success: fetchMyCard
      });
    }
  });

  myCardDiv.find('button').click(function() {
    var cardInfo = {
      name: myCardDiv.find('input[name=name]').val(),
      email: myCardDiv.find('input[name=email]').val(),
      notes: myCardDiv.find('textarea').val()
    };
    launchInfo.myCard.put(cardInfo);
  });

  inviteButton.click(function(evt) {
    var serverLink = 'http://' + window.serverBase;
    var to = addFriendArea.find('input[name=email]').val();
    var name = addFriendArea.find('input[name=name]').val();
    var message = 'Hello ' + name + '!\n\n' +
                  'Come join us on bfriendr!\n\n' +
                  'Visit this link: ' + serverLink +
                  '\n\nThen highlight and drop the link ' +
                  'below into your bfriendr window to accept the invite.\n\n';
    var url = 'http://' + window.serverBase + 'nav.png?';
    url += 'scope=' + rcIntroduceYourself + '&';
    url += 'cap=' + launchInfo.introduceYourself.serialize();
    window.gmail(to, name + ', come join bfriendr!', message + url);
  });

  ui.capDraggable(myCardToggle, rcIntroduceYourself,
      function(selectedRC) { return launchInfo.introduceYourself; },
      function() { return myCardImageDiv.find('img').attr('src'); });
  ui.capDroppable(addFriendArea, rcIntroduceYourself,
      function(c) {
        launchInfo.introduceMeTo.post({introductionCap: c });
      });

  var messageUI = initMessagesUI(messagesDiv, showHideMessages);
  initCardUI(launchInfo.friends, cardListDiv, messageUI);
};

onBelayReady(function() { initialize(); });

