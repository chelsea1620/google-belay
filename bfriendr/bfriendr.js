var $ = os.jQuery;

var initCardUI = function(container) {
  var template = container.find('.bfriendr-card:first');
  container.find('.bfriendr-card').detach(); // removes extra templates too

  var updateCard = function(ui) {
    var nameElt = ui.find('h3');
    var infoElt = ui.find('p:eq(0)');
    return function(friendInfo) {
      nameElt.text(friendInfo.card.name);
      infoElt.text(friendInfo.card.notes);
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
      friendCapURLs.map(function(url) { os.capServer.restore(url); });

    friendCaps.forEach(cardUI.newCard);
    cardUI.newCard(os.capServer.grant(function() {
      return { card: { name: 'khan', notes: 'i am not real' } };
    }));
    cardUI.newCard(os.capServer.grant(function() {
      return { card: { name: 'joe', notes: 'woof' } };
    }));
  
  });


};

var initialize = function() {
  os.ui.resize('18em', '24em', true);

  var myCardDiv = os.topDiv.find('div.bfriendr-mycard');
  var myCardToggle = os.topDiv.find('.bfriendr-header .bfriendr-nav');
  var myCardShown = false;
  var myCardImageDiv = myCardDiv.find('div.bfriendr-cardimg');
  var cardListDiv = os.topDiv.find('div.bfriendr-cards');
  var messagesDiv = os.topDiv.find('div.bfriendr-messages');

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
  cardListDiv.find('.bfriendr-nav').click(
      function() { showHideMessages(true); return false; });
  messagesDiv.find('.bfriendr-nav').click(
      function() { showHideMessages(false); return false; });

  app.caps.myCard.get(function(cardInfo) {
    myCardDiv.find('input[name=name]').val(cardInfo.name);
    myCardDiv.find('input[name=email]').val(cardInfo.email);
    myCardDiv.find('textarea').val(cardInfo.notes);
    if (cardInfo.image) {
      myCardImageDiv.append('<img>');
      myCardImageDiv.find('img').attr('src', cardInfo.image);
    }
    
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
      if (draggedFile) {
        var fd = new os.FormData();
        fd.append('imageFile', draggedFile);
        $.ajax({
          url: cardInfo.uploadImage,
          cache: false,
          type: 'POST',
          contentType: false,
          processData: false,
          data: fd,
        });       
      }
    });
    
    if (cardInfo.name.trim().length == 0) {
      showHideMyCard(true);
    }
  });
  
  myCardDiv.find('button').click(function() {
    var cardInfo = {
      name: myCardDiv.find('input[name=name]').val(),
      email: myCardDiv.find('input[name=email]').val(),
      notes: myCardDiv.find('textarea').val(),
    };
    app.caps.myCard.put(cardInfo);
  });

  showCards(app.caps.friends, initCardUI(cardListDiv));
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
