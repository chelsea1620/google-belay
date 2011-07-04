var $ = os.jQuery;

var initialize = function() {
  os.ui.resize('18em', '24em', true);

  var myCardDiv = os.topDiv.find('div.bfriendr-card');
  var myCardImageDiv = myCardDiv.find('div.bfriendr-cardimg');
  
  for (var k in app.caps) {
    app.caps[k] = os.capServer.restore(app.caps[k]);
  }
  
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
  });
  
  myCardDiv.find('button').click(function() {
    var cardInfo = {
      name: myCardDiv.find('input[name=name]').val(),
      email: myCardDiv.find('input[name=email]').val(),
      notes: myCardDiv.find('textarea').val(),
    };
    app.caps.myCard.put(cardInfo);
  })
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
