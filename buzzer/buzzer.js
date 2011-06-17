var me = os.topDiv;

os.ui.resize(150,200,true);

var formAjax = function(form, callback) {
  var data = {}
  for (var i = 0; i < form.elements.length; ++i) {
    var input = form.elements[i];
    if (input.type == 'text' || input.type == 'textarea') {
      data[input.name] = input.value;
    }
    else if (input.type == 'submit') {
      // do nothing
    }
    else {
      os.alert('Unhandled type of form input: ' + input.type + " named " + input.name);
    }
  }
  os.jQuery.ajax({
    url: form.action,
    type: form.method || 'GET',
    data: data,
    dataType: 'json',
    error: function(xhr,status,err) { os.alert('form update failed: ' + status); },
    success: function(data, status, xhr) { callback(data); },
  });
};

var rcPost = "urn:x-belay://resouce-class/social-feed/post";

var capReviver = function(resClass) {
  if (resClass == rcPost) {
    return function(data) {
      os.jQuery.ajax({
        url: app.caps.post,
        type: 'POST',
        data: {
          body: '' + data.body,
          via: '' + data.via, 
        },
        success: function() { reload(); },
      });
    };
  }
  return null;
};

os.capServer.setReviver(capReviver);

var reload = function() {
  me.load(app.caps.editor, function() {
    var forms = me.find('.buzzer-thing form');
    me.find('.buzzer-thing form').submit(function(ev) {
      formAjax(ev.target, reload);
      ev.preventDefault();
      return false;
    });
    os.ui.capDraggable(me.find('.buzzer-chit'), rcPost, function(selectedRC) {
      return os.capServer.grant(capReviver(selectedRC), selectedRC);
    });
  });
};

reload();
