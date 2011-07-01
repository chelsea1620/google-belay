var $ = os.jQuery;

var initialize = function() {
  os.ui.resize('18em', '24em', true);

  var myCardDiv = os.topDiv.find('.bfriendr-card');
  
  for (var k in app.caps) {
    app.caps[k] = os.capServer.restore(app.caps[k]);
  }
  
  app.caps.myCard.get(function(cardInfo) {
    myCardDiv.find('input[name=name]').val(cardInfo.name);
    myCardDiv.find('input[name=email]').val(cardInfo.email);
    myCardDiv.find('textarea').val(cardInfo.notes);
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
