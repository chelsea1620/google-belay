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

var foop = function(sourceURL, extras) {
  var scriptsToLoad = sourceURL instanceof Array ? sourceURL : [ sourceURL ];
  var script = "";
  
  function loadNext() {
    if (scriptsToLoad.length == 0) { finish(); return; }
    
    var nextURL = scriptsToLoad.shift();
    $.ajax(nextURL, {
      dataType: 'text',
      success: function(data, status, xhr) {
        script += data + '\n';
        loadNext();
      },
      error: function(xhr, status, error) {
        alert('Failed to load script: ' + status);
      }
    });
  };
  
  function finish() {
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
        openDirectly: function(url, name, options) {
          return windowManager.open(url, name, options);
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

    var exports = Object.create(null);
    exports["os"] = os;
    Object.keys(os).forEach(function(name) { 
      exports[name] = os[name]; 
    });

    cajaVM.compileModule(script)(exports);
  }
  
  loadNext();
};


(function() {
  var DEBUG = true;

  whitelist['foop'] = true;
  if (DEBUG) {
    whitelist['console'] = 'skip';
  }

  startSES(window, whitelist, atLeastFreeVarNames, DEBUG);
})();

