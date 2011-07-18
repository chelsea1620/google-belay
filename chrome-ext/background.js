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

var capServer = new CapServer(newUUIDv4());

// { tabID : { callbackName : [ rcList, info ] }}
var offerMap = Object.create(null);
var acceptMap = Object.create(null);

//
// Station setup
//
var stations = (function() {
  var stations = localStorage.stations ?
    JSON.parse(localStorage.stations) : {};

  function set(name, stationURL) {
    stations[name] = stationURL;
    localStorage.stations = JSON.stringify(stations);
  }

  function get(name) {
    return stations[name];
  }

  function names() {
    return Object.keys(stations);
  }

  return Object.freeze({
    set: set,
    get: get,
    names: names,
  });
})();

var MAKESTATION = 'http://localhost:9001/belay/generate';

var makeStation = function(name, k) {
  capServer.restore(MAKESTATION).get(
    function(stationCap) {
      // TODO(mzero): should be defensive about stationCap being a Cap
      stations.set(name, stationCap.serialize());
      if (k) k();
    },
    function(_) {
      console.log('Failed to gen station');
    });
};

var launchStation = function(name) {
  launch(stations.get(name));
}



var launchedTabs = Object.create(null);

// opens a page, and sends info over
var launch = function(url) {
  capServer.restore(url).get(
    function(data) {
      var page = data.page;
      var info = data.info;
      chrome.tabs.create({ url: page.html },
        function(tab) {
          var tunnel = new CapTunnel(getTabPort(tab.id));
          tunnel.setLocalResolver(function(instID) {
            if(instID === capServer.instanceID) {
              return capServer.publicInterface;
            }
            else {
              return null;
            }
          });
          launchedTabs[tab.id] = {
            url: url, html: page.html, info: info, tunnel: tunnel };
        });
    },
    function(_) {
      console.log('Launch failed.');
    });
};

// NOTE(jpolitz): This event is called twice on page load, and twice
// on page refresh.  We only handle 'complete' events, so we can be
// sure that the receiving tab is correctly set up.
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
  if (info.status !== 'complete') return;
  var tabInfo = launchedTabs[tabID];
  if (tabInfo === undefined) return;
  
  var sendToTunnel = function(info) {
    tabInfo.tunnel.sendOutpost(capServer.dataPreProcess({ 
      info: info,
      browserID: capServer.instanceID,
      services: {
        highlightByRC: capServer.grant(highlighting.highlightByRC),
        unhighlight: capServer.grant(highlighting.unhighlight)
      }
    }));
  };
  
  if (tabInfo.info) {
    sendToTunnel(tabInfo.info);
    tabInfo.info = undefined;
  } else {
    capServer.restore(tabInfo.url).get(
      function(data) {
        if (data.page.html === info.html || info.url === undefined) {
          sendToTunnel(data.info); 
        }
      });
  }
});

//
// Ports to pages
//

var getTabPort = (function() {
  var ports = Object.create(null);

  var getTabPort = function(tabID) {
    if (!(tabID in ports)) ports[tabID] = new PortQueue();
    return ports[tabID];
  }

  var makeRelayPort = function(tabID) {
    var extPort = {
      postMessage: function(message, ports) {
        if (ports && ports.length > 0) { throw 'TabPort: Can\'t send ports'; }
        // TODO(jpolitz): make sure tabID still exists
        chrome.tabs.sendRequest(tabID, message);
      },
      onmessage: function() { throw 'ExtPort: onmessage not set.'; }
    };
    return extPort;
  };

  chrome.extension.onRequest.addListener(
    function(message, sender, sendResponse) {
      var tabID = sender.tab.id;
      var port = getTabPort(tabID);
      if (message.type === 'init') {
        if (!port.hasPort()) port.setPort(makeRelayPort(tabID));
        return;
      }
      else port.onmessage({ data: message });
    });

  return Object.freeze(getTabPort);
})();

// highlighting draggable/droppable elements
var highlighting = (function() {

  var ports = Object.create(null);

  var highlightByRC = function(rc) {
    console.assert(typeof rc === 'string');

    Object.keys(ports).forEach(function(tabId) {
      ports[tabId].postMessage({ type: 'highlight', rc: rc });
    });
  };

  var unhighlight = function() {
    Object.keys(ports).forEach(function(tabId) {
      ports[tabId].postMessage({ type: 'unhighlight' });
    });
  };

  var registerHighlighter = function(port) {
    var tabId = port.sender.tab.id;
   
    console.assert(!(tabId in ports)); // sanity check
    ports[tabId] = port;

    port.onDisconnect.addListener(function() {
      delete ports[tabId];
    });
  };
  
  return { 
    registerHighlighter: registerHighlighter,
    highlightByRC: highlightByRC,
    unhighlight: unhighlight
  };

})();

chrome.extension.onConnect.addListener(function(port) {
  if (port.name === 'highlight') { 
    highlighting.registerHighlighter(port); 
  }
});
