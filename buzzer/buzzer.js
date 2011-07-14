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

var me = os.topDiv;

os.ui.resize(150, 200, true);

var formAjax = function(form, callback) {
  var data = {};
  for (var i = 0; i < form.elements.length; ++i) {
    var input = form.elements[i];
    if (input.type == 'text' || input.type == 'textarea') {
      data[input.name] = input.value;
    }
    else if (input.type == 'submit') {
      // do nothing
    }
    else {
      os.alert('Unhandled type of form input: ' +
               input.type + ' named ' + input.name);
    }
  }
  os.jQuery.ajax({
    url: form.action,
    type: form.method || 'GET',
    data: data,
    dataType: 'json',
    error: function(xhr, status, err) {
      os.alert('form update failed: ' + status);
    },
    success: function(data, status, xhr) { callback(data); }
  });
};

var rcPost = 'urn:x-belay://resouce-class/social-feed/post';

var capReviver = function(resClass) {
  if (resClass == rcPost) {
    var poster = function(data) {
      os.jQuery.ajax({
        url: app.caps.post,
        type: 'POST',
        data: {
          body: '' + data.body,
          via: '' + data.via
        },
        success: function() { reload(); }
      });
    };
    return os.capServer.buildSyncFunction(poster);
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
      return os.capServer.grantKey(selectedRC);
    });
  });
};

reload();
