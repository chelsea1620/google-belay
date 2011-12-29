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

// used for selenium testing - ready is set to true when
// the station is fully initialised
if (!window.belaytest) {
  window.belaytest = {
    ready: false
  };
}

var belayBrowser; // common.js needs this global

// "use strict";

// TODO(jasvir): These should be modules not scripts
require([
    'instances',
    'sections',
    'attributes',
    'identities',
    'order!lib/js/include-belay.js',
    'order!lib/js/caps.js',
    'order!lib/js/common.js'],
  function(instances, sections, attributes, identities) {

var ui;
var stationInfo;
var isRunning;
var capServer;
var belayBrowserTunnel;

var defaultIcon = '/res/images/tool.png';

//
// CapServers
//
var instanceResolver = function(id) {
  if (id === capServer.instanceId) {
    return capServer.publicInterface;
  }
  return belayBrowserTunnel.sendInterface;
};


function domainOfInst(inst) {
  return inst.state.belayInstance.serialize().match('https?://[^/]*')[0];
}

function cmpInstByCreated(inst1, inst2) {
  return inst1.state.created - inst2.state.created;
}


var getSuggestions = function(location, success, failure) {
  var possibleInstances = [];
  instances.forEach(function(inst) {
    if (domainOfInst(inst) == location && inst.state.section != 'Trash') {
      possibleInstances.push(inst);
    }
  });

  var suggestions = [];
  function processNext() {
    if (possibleInstances.length > 0) {
      var inst = possibleInstances.shift();
      isRunning.post(inst.state.id, function(r) {
        if (!r) {
          suggestions.push({
            name: inst.state.name,
            doLaunch: capServer.grant(function(activate) {
              instances.launchInstance(inst, activate);
            })
          });
        }
        processNext();
      }, processNext);
    } else {
      success(suggestions);
    }
  }
  processNext();
};



var initialize = function() {
  $(document.body).find('.ex').remove(); // remove layout examples

  attributes.init(stationInfo.allIdentities);
  instances.init(capServer, stationInfo.instanceBase, isRunning);
  sections.init(capServer, stationInfo.allSections);
  identities.init(capServer,
    stationInfo.allIdentities,
    stationInfo.identities,
    stationInfo.addIdentityLaunchers,
    stationInfo.createProfile);

  // TODO(mzero): refactor the two addInstance functions and the newInstHandler
  var addInstanceFromGenerate = function(genCap) {
    genCap.get(function(data) {
        var newId = newUUIDv4();
        var inst = {
          storageCap: capServer.grant(stationInfo.instanceBase + newId),
            // TODO(arjun) still a hack. Should we be concatenaing URLs here?
          state: {
            id: newId,
            belayInstance: data.launch,
            name: data.name,
            icon: data.icon,
            info: undefined,
            created: (new Date()).valueOf()
          }
        };
        instances.addInstance(inst);
        instances.dirty(inst);
      },
      function(error) {
        alert('Failed to addInstanceFromGenerate, error = ' + error);
      }
    );
  };

  var itemsDiv = $('#belay-items');
  ui.capDroppable(itemsDiv, 'belay/generate', addInstanceFromGenerate);

  var loadedInstances = [];
  stationInfo.allInstances.forEach(function(i) {
    var inst = {
      storageCap: i.cap,
      state: i.data
    };
    loadedInstances.push(inst);
  });
  loadedInstances.sort(cmpInstByCreated).forEach(instances.addInstance);

  window.belaytest.ready = true;
};

window.belay.onPortReady(function() {
  belayBrowserTunnel = new CapTunnel(window.belay.port);
  belayBrowserTunnel.setLocalResolver(instanceResolver);
  belayBrowserTunnel.setOutpostHandler(function(outpost) {
    capServer = new CapServer(outpost.instanceId);
    capServer.setResolver(instanceResolver);

    expectPage = outpost.expectPage;
    belayBrowser = outpost.services;
    isRunning = outpost.isRunning;
    stationInfo = outpost.info;
    outpost.setStationCallbacks.put({
      newInstHandler: capServer.grant(instances.newInstHandler),
      getSuggestions: capServer.grant(getSuggestions)
    });
    ui = {
      capDraggable: common.makeCapDraggable(capServer, function() {}),
      capDroppable: common.makeCapDroppable(capServer, function() {})
    };
    initialize();
    localStorage.setItem('station-launch-time', Date.now());
  });
});

});
