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

// { tabID : { callbackName : [ rcList, info ] }}
var offerMap = Object.create(null);
var acceptMap = Object.create(null);

//
// Station setup
//
var MAKESTATION = 'http://localhost:9001/belay/generate';
var stationIndex = 'stationIndex';

var stations = (function() {
  var stations = localStorage.stations ?
    JSON.parse(localStorage.stations) : {};
  // Not persisted
  var byTab = Object.create(null);


  function set(name, stationURL) {
    stations[name] = stationURL;
    localStorage.stations = JSON.stringify(stations);
  }

  function setTab(tabID, stationURL, stationTunnel) {
    byTab[tabID] = { url: stationURL, tunnel: stationTunnel };
  }

  function get(name) {
    return stations[name];
  }

  function getTab(tabID) {
    return byTab[tabID];
  }

  function names() {
    return Object.keys(stations);
  }

  return Object.freeze({
    set: set,
    get: get,
    names: names,
    setTab: setTab,
    getTab: getTab
  });
})();

// { info: instanceInfo, page: url } -> undef
// opens a page, and sends info over
var launchStation = function(url, data) {
  var page = data.page;
  var info = data.info;
  chrome.tabs.create({ url: page },
    function(tab) {
      var tunnel = new CapTunnel(getTabPort(tab.id));
      stations.setTab(tab.id, url, tunnel);
    });
};

// NOTE(jpolitz): This event is called twice on page load, and twice
// on page refresh.  We only handle 'complete' events, so we can be
// sure that the receiving tab is correctly set up.
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
  if (info.status !== 'complete') return;
  var stationTabInfo = stations.getTab(tabID);
  if (stationTabInfo === undefined) return;
  $.ajax({
    url: stationTabInfo.url,
    dataType: 'json',
    success: function(data, status, xhr) {
      if (data.page === info.url || info.url === undefined) {
        stationTabInfo.tunnel.
          sendOutpost('ext', [], { info: data.info });
      }
    }});
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
      if (message.type === 'init' && !port.hasPort()) 
        port.setPort(makeRelayPort(tabID));
      else port.onmessage(message);
    });

  return Object.freeze(getTabPort);
})();

