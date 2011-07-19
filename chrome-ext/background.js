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
/* Maps tabIDs to
  { instID: Str, 
    outpostData: Any,    station-determined; background is transparent 
    tunnel: CapTunnel,
    url: Str,
    station: ``Station'' 
   }
*/
var launchedInstances = Object.create(null);
var launchedStations = Object.create(null);

var makeSetNewInstHandler = function(station) {
  return capServer.grant(function(handler) {
    station.newInstHandler = handler;
  });
};

var makeCloseInstHandler = function(station) {
  return capServer.grant(function(handler) {
    station.closeInstHandler = handler; 
  });
};

var makeCloseInstanceCap = function(instID) {
  return capServer.grant(function() {
    var tabID = instToTabID[instID];
    delete instToTabID[instID];
    delete launchedInstances[tabID];
    // TODO(arjun): assume success; closing caps should be revoked when the
    // instance is closed.
    chrome.tabs.remove(tabID);
  });
};

// Capability returned to station to launch instances in new windows.
var makeLaunchHandler = function(station) {
  return capServer.grant({
    post: function(args, sk, fk) {
      var width = typeof args.width === 'number' ? args.width : undefined;
      var height = typeof args.height === 'number' ? args.height: undefined;
      chrome.windows.create({ url: args.url,
                              width: width,
                              height: height }, 
                            function(wnd) {
        var tab = wnd.tabs[0];
        var tunnel = makeTunnel(tabPorts.getTabPort(tab.id)); 
        launchedInstances[tab.id] = { instID: args.instID,
                                      tunnel: tunnel,
                                      url: args.url,
                                      outpostData: args.outpostData,
                                      station: station };
        instToTabID[args.instID] = tab.id;
        sk(makeCloseInstanceCap(args.instID));
        // chrome.tabs.onUpdated fires on the next turn, sending the
        // outpost message.
      });
    }
  });
};

var instanceRequest = function(data, tabID) {
  var launchData = capServer.dataPostProcess(data);
  var station = currentStation;
  
  station.newInstHandler.post({ 
    launchData: launchData,
    relaunch: capServer.grant(function(args) {
      chrome.tabs.update(tabID, { url: args.url }, function(tab) {
        var tunnel = makeTunnel(tabPorts.refreshTabPort(tab.id)); 
        launchedInstances[tab.id] = { instID: args.instID,
                                      tunnel: tunnel,
                                      url: args.url,
                                      outpostData: args.outpostData,
                                      station: station };
        instToTabID[args.instID] = tab.id;
      });
      return makeCloseInstanceCap(args.instID);
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

var handleClosedStation = function(tabID) {
  var station = launchedStations[tabID];
  
  if (currentStation === station) {
    currentStation = false;
  }

  closeInstancesOfStation(station);
  delete launchedStations[tabID];
}

var closeInstancesOfStation = function(station) {
  Object.keys(launchedInstances).forEach(function(instTabID) {
    var instance = launchedInstances[instTabID];
    if (instance.station === station) {
      delete instToTabID[instance.instID];
      delete launchedInstances[instTabID];
      chrome.tabs.remove(Number(instTabID));
    }
  });
}

chrome.tabs.onRemoved.addListener(function (tabID, removeInfo) {
  if (tabID in launchedInstances) {
    var station = launchedInstances[tabID].station;
    var instID = launchedInstances[tabID].instID;
    delete instToTabID[instID];
    delete launchedInstances[tabID];
    station.closeInstHandler.put(instID);
  }
  else if (tabID in launchedStations) {
    handleClosedStation(tabID);
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

  closeInstancesOfStation(tabInfo);
  
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
      setNewInstHandler: makeSetNewInstHandler(tabInfo),
      setCloseInstHandler: makeCloseInstHandler(tabInfo)
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
