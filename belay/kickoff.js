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

var foop = function(sourceURL, node, extras) {
  // insert a div into the node, and foop the source into existance there

  $.ajax({
    url: sourceURL,
    dataType: 'text',
    success: function(data, status, xhr) {
      var jq = {
        // A sanitized jQuery object
        ajax: jQuery.ajax,
        parseQuery: jQuery.parseQuery
      };
      var js = {
        // A sanitized JSON object
        stringify: JSON.stringify,
        parse: JSON.parse
      };

      var os = {
        topDiv: $('<div></div>').prependTo(node),
        jQuery: jq,
        JSON: js,

        // can't just pass these, you have to wrap them for some reason
        alert: function(s) { alert(s); },
        setTimeout: function(f, s) { return setTimeout(f, s); },
        setInterval: function(f, s) { return setInterval(f, s); },
        clearTimeout: function(t) { clearTimeout(t); },
        clearInterval: function(t) { clearInterval(t); },
        FormData: FormData,

        foop: foop,
        poof: function() { window.close(); },

        CapServer: CapServer,
        CapTunnel: CapTunnel,
        window: {
          open: function(url, name, options, success, failure) {
            var port = windowManager.
              open('http://localhost:9000/subbelay?url=' +
                encodeURI(url), name, options);
            success(port);
          },
          opener: window.opener ? window.openerPort : undefined,
          // TODO(jpolitz): This function is ridiculous, but good for demos
          gmail: function(to, subject, body) {
            var gmailLink =
              'https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=' +
              to +
              '&su=' + subject + '&body=' + encodeURIComponent(body) +
              '&zx=_&shva=1&disablechatbrowsercheck=1&ui=1';
            windowManager.open(gmailLink);
          },
          serverBase: window.location.host
        }

      };

      if (extras) {
        for (p in extras) {
          os[p] = extras[p];
        }
      }

      cajaVM.compileModule(data)({os: os});
    },
    error: function(xhr, status, error) {
      alert('Failed to kickoff: ' + status);
    }
  });
};


(function() {
  var DEBUG = true;

  whitelist['foop'] = true;
  if (DEBUG) {
    whitelist['console'] = 'skip';
  }

  startSES(window, whitelist, atLeastFreeVarNames, DEBUG);
})();

