var $ = os.jQuery;
var me = os.topDiv;

var postTimer = undefined;
var postData = function(newData) {
  os.clearTimeout(postTimer);
  postTimer = os.setTimeout(function() {
    $.ajax({
      url: app.caps.data,
      data: newData,
      processData: false,
      type: 'POST'
    }, 500);
  });
};

var initialize = function(noteData) {
  var form = me.find('textarea');
  form.val(noteData);
  form.change(function(event) {
    postData(form.val());
  });

  os.topDiv.find('.message').slideUp('fast');
  form.fadeIn('slow');
};

me.load('http://localhost:9003/sticky.html', function() {
  os.ui.resize(100, 75, true);

  $.ajax({
    url: app.caps.data,
    dataType: 'text',
	  success: function(data, status, xhr) {
	    initialize(data);
	  },
  	error: function(xhr, status, error) {
  		os.alert('Failed to load data: ' + status);
  	}
  });
});
