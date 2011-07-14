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
