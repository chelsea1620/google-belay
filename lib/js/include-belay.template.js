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
  if (window.belay) return;
      // There is belay system already in this browser, we're done

  // set-up and load the belay system from the well known service
  var BELAY_BASE = '##BASE##';
  var BELAY_PORT_SCRIPT = BELAY_BASE + "/belay-port.js";

  window.belay = {
    DEBUG: false,
    BASE: BELAY_BASE,
    PORT_SCRIPT: BELAY_PORT_SCRIPT,
    
    wasReady: false,
    portReady: function() { window.belay.wasReady = true; }
  };

  var script = document.createElement('script');
  script.setAttribute('src', BELAY_PORT_SCRIPT);
  document.head.appendChild(script);
})();

