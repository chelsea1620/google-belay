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

(function(){
  "use strict";
  
  if (window.belay) return;
      // There is belay system already in this browser, we're done

  // set-up and load the belay system from the well known service
  var BELAY_BASE = '##BASE##';
  var BELAY_PORT_SCRIPT = BELAY_BASE + "/belay-port.js";

  function callIfReady() {
    var readyHandler = window.belay.readyHandler;
    var doneHandler = window.belay.doneHandler;
    if (readyHandler && doneHandler) {
      delete window.belay.readyHandler;
      delete window.belay.doneHandler;
      window.belay.initialized = true;
      setTimeout(function() {
        readyHandler();
        doneHandler();
      }, 0);
    }
  }
  
  window.belay = {
    DEBUG: false,
    BASE: BELAY_BASE,
    PORT_SCRIPT: BELAY_PORT_SCRIPT,
    
    initialized: false,
    portReadyHandlers: [],
    onPortReady: function(readyHandler) {
      if (window.belay.initialized) {
        throw new Error("onPortReady called after Belay initialization");
      }
      if (window.belay.readyHandler) {
        throw new Error("onPortReady called twice, no longer supported");
      }
      window.belay.readyHandler = readyHandler;
      callIfReady();
    },
    portReady: function(doneHandler) {
      if (window.belay.initialized) {
        throw new Error("portReady called after Belay initialization");
      }
      if (window.belay.doneHandler) {
        throw new Error("portReady called twice");
      }
      window.belay.doneHandler = doneHandler;
      callIfReady();
    }
    // TODO(mzero): This API is insincere: onPortReady can only be called once,
    // and portReady is a private function between this file and belay-port.js.
    // These truths should be reflected in the API so mistakes can't be made!
  };

  var script = document.createElement('script');
  script.setAttribute('src', BELAY_PORT_SCRIPT);
  document.head.appendChild(script);
})();

