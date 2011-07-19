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

var resolver = function(instID) {
  if (instID in instToTabID) {
    return launchedInstances[instToTabID[instID]].tunnel.sendInterface;
  }
  else if (instID === capServer.instanceID) {
    return capServer.publicInterface;
  }
  else {
    // TODO(arjun): this is terrible; Joe told me to do this
    return currentStation.tunnel.sendInterface;
  }
};

capServer.setResolver(resolver);

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

var instToTabID = Object.create(null);
var launchedInstances = Object.create(null);
var launchedStations = Object.create(null);

var makeSetNewInstHandler = function(station) {
  return capServer.grant(function(handler) {
    station.newInstHandler = handler;
  });
};

// Capability returned to station to launch instances in new windows.
var makeLaunchHandler = function(station) {
  return capServer.grant({
    // TODO(arjun): I conjecture that we'll use delete to close windowed
    // instances

    // { instID: String, outpostData : Any, url: String }
    post: function(args, sk, fk) {
      chrome.tabs.create({ url: args.url }, function(tab) {
        var tunnel = makeTunnel(tabPorts.getTabPort(tab.id)); 
        launchedInstances[tab.id] = { instID: args.instID,
                                      tunnel: tunnel,
                                      url: args.url,
                                      outpostData: args.outpostData };
        instToTabID[args.instID] = tab.id;
        // TODO(arjun): This is where the cap to close the instance might
        // be returned.
        sk(true);
        // chrome.tabs.onUpdated fires on the next turn, sending the
        // outpost message.
      });
    }
  });
};

var instanceRequest = function(data, tabID) {
  var launchData = capServer.dataPostProcess(data);
  
  currentStation.newInstHandler.post({ 
    launchData: launchData,
    relaunch: capServer.grant(function(args) {
      chrome.tabs.update(tabID, { url: args.url }, function(tab) {
        var tunnel = makeTunnel(tabPorts.refreshTabPort(tab.id)); 
        launchedInstances[tab.id] = { instID: args.instID,
                                      tunnel: tunnel,
                                      url: args.url,
                                      outpostData: args.outpostData };
        instToTabID[args.instID] = tab.id;
        // chrome.tabs.onUpdated _does not fire_ on the next turn.
        tunnel.sendOutpost(capServer.dataPreProcess(args.outpostData));
      });
      return true;
    })
  });
};


var makeTunnel = function(port) {
  var tunnel = new CapTunnel(port);
  tunnel.setLocalResolver(resolver);
  return tunnel;
};

// opens a page, and sends info over
var launch = function(url) {
  capServer.restore(url).get(
    function(data) {
      var page = data.page;
      var info = data.info;
      chrome.tabs.create({ url: page.html },
        function(tab) {
          var tunnel = makeTunnel(tabPorts.getTabPort(tab.id)); 
          launchedStations[tab.id] = {
            url: url, html: page.html, info: info, tunnel: tunnel };
        });
    },
    function(_) {
      console.log('Launch failed.');
    });
};

// Also runs on first-load
var reloadInstance = function(tabID, info, tab) {
  var instance = launchedInstances[tabID];
  console.assert(instance);
  instance.tunnel.sendOutpost(capServer.dataPreProcess(instance.outpostData));
};

var currentStation = false;

chrome.tabs.onRemoved.addListener(function (tabID, removeInfo) {
  if (tabID in launchedInstances) {
    delete instToTabID[launchedInstances[tabID].instID];
    delete launchedInstances[tabID];
  }
  else if (tabID in launchedStations) {
    if (currentStation === launchedStations[tabID]) {
      currentStation = false;
    }
    delete launchedStations[tabID];
  }
});

// NOTE(jpolitz): This event is called twice on page load, and twice
// on page refresh.  We only handle 'complete' events, so we can be
// sure that the receiving tab is correctly set up.
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
  if (info.status !== 'complete') return;
  var tabInfo = launchedStations[tabID];
  if (tabInfo === undefined) {
    if (tabID in launchedInstances) {
      reloadInstance(tabID, info, tab);
    }
    return;
  }

  // TODO(arjun): hack--currentStation is the last loaded station
  currentStation = tabInfo;
  
  tabInfo.tunnel = makeTunnel(tabPorts.refreshTabPort(tabID)); 

  var sendToTunnel = function(info) {
    tabInfo.tunnel.sendOutpost(capServer.dataPreProcess({ 
      info: info,
      browserID: capServer.instanceID,
      services: {
        highlightByRC: capServer.grant(highlighting.highlightByRC),
        unhighlight: capServer.grant(highlighting.unhighlight)
      },
      launch: makeLaunchHandler(tabInfo),
      setNewInstHandler: makeSetNewInstHandler(tabInfo)
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

var tabPorts = (function() {
  var ports = Object.create(null);

  var getTabPort = function(tabID) {
    if (!(tabID in ports)) ports[tabID] = new PortQueue();
    return ports[tabID];
  };

  var refreshTabPort = function(tabID) {
    if (tabID in ports) delete ports[tabID];
    return getTabPort(tabID);
  };

  var makeRelayPort = function(tabID) {
    var extPort = {
      postMessage: function(message, ports) {
        if (ports && ports.length > 0) { throw 'TabPort: Can\'t send ports'; }
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
      }
      else if (message.type === 'instanceRequest') {
        instanceRequest(message.gen, tabID);
      }
      else port.onmessage({ data: message });
    });

  return Object.freeze({
      getTabPort: getTabPort,
      refreshTabPort: refreshTabPort
  });
})();

// highlighting draggable/droppable elements
var highlighting = (function() {

  var ports = Object.create(null);

  var highlightByRC = function(args) {
    args.type = 'highlight';
    Object.keys(ports).forEach(function(tabId) {
      ports[tabId].postMessage(args);
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
