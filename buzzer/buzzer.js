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

onBelayReady(function() {
  ui.resize(150, 200, true);

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
        alert('Unhandled type of form input: ' +
                 input.type + ' named ' + input.name);
      }
    }
    capServer.restore(form.action).invoke(
      form.method || 'GET',
      data,
      callback,
      function() { alert('form update failed: ' + status); }
      );
  };

  var rcPost = 'urn:x-belay://resouce-class/social-feed/post';
  var rcBelayGen = 'belay/generate';

  var capReviver = function(resClass) {
    if (resClass == rcPost && launchInfo.post_cap) {
      var poster = function(data) {
        launchInfo.post_cap.post(
          {
            body: data.body,
            via: data.via
          },
          reload
        );
      };
      return capServer.buildSyncFunction(poster);
    }
    return null;
  };

  capServer.setReviver(capReviver);

  var reload = function() {
    topDiv.load(launchInfo.editor_url, function() {
      var forms = topDiv.find('.buzzer-thing form');
      topDiv.find('.buzzer-thing form').submit(function(ev) {
        formAjax(ev.target, reload);
        ev.preventDefault();
        return false;
      });
      ui.capDraggable(topDiv.find('.buzzer-reader-chit'), rcBelayGen,
          launchInfo.reader_gen_cap,
          launchInfo.readChitURL);
      ui.capDraggable(topDiv.find('.buzzer-post-chit'), rcPost,
          capServer.grant(function(selectedRC) {
              return capServer.grantKey(selectedRC);
          }),
          launchInfo.postChitURL);
    });
  };

  reload();
  
  belay.outpost.setRefresh.put(capServer.grant(reload));
});
