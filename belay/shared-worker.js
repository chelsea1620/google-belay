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

importScripts('lib/js/caps.js');

var station = undefined;

var workerInstanceId = newUUIDv4();
var workerServer = new CapServer(workerInstanceId);

var instToTunnel = Object.create(null);

var logCap;

function log() {
  logCap.put(Array.prototype.slice.call(arguments));
}

function resolver(instanceId) {
  if (instanceId === workerInstanceId) {
    return workerServer.publicInterface;
  }
  if (instanceId in instToTunnel) {
    return instToTunnel[instanceId].sendInterface;
  }
  return null;
}

workerServer.setResolver(resolver);


var expectedPages = Object.create(null);
var pendingActivates = Object.create(null);

function buildActivateCap(navigateCap) {
  return workerServer.grant(function(args, sk, fk) {
    var pending = {
      instanceId: args.instanceId,
      temporaryInstance: false,
      outpost: args.outpostData,
      isStation: args.isStation || false,
      activateContinuations: { sk: sk, fk: fk }
    };

    if('relaunch' in args) {
      relaunch = args.relaunch;
      pending.relaunch = workerServer.grant(function(navigateCap) {
        relaunch.post(buildActivateCap(navigateCap));
      });
    }
    
    var startId = newUUIDv4();
    pendingActivates[startId] = pending;

    navigateCap.post({url: args.pageUrl, startId: startId});
  });
}

var stationCaps;

function makeSetStationCallbacks() {
  return workerServer.grant(function(callbacks) {
    stationCaps = callbacks;
  });
}


function checkForSuggestions(location, showSuggestions, navigate) {
  var m = location.match('^https?://[^/]*');
  if (m === null) return;
  location = m[0];
  
  stationCaps.getSuggestions.post(location, function(suggestions) {
    if (suggestions.length == 0) return;
    showSuggestions.post({
      suggestions: suggestions,
      clickSuggest: workerServer.grant(function(doLaunch) {
        doLaunch.post(buildActivateCap(navigate));
      })
    });
  });
}

var highlighters = Object.create(null);

function makeHighlighting() {
  return {
    highlightByRC: workerServer.grant(function(v) {
      Object.keys(highlighters).forEach(function(k) {
        highlighters[k].highlight.put([v.rc, v.className]);
      });
    }),
    unhighlight: workerServer.grant(function(v) {
      Object.keys(highlighters).forEach(function(k) {
        highlighters[k].unhighlight.put();
      });
    })
  };
}

function makeExpectPage() {
  return workerServer.grant(function(expect) {
    // TODO(mzero): should validate the startId
    expectedPages[expect.startId] = expect.ready;  
  })
}

self.addEventListener('connect', function(e) {
  var port = e.ports[0];
  var iframeTunnel = new CapTunnel(port);
  iframeTunnel.setLocalResolver(resolver);
  iframeTunnel.setOutpostHandler(function(outpost) {
    if (!logCap) { logCap = outpost.log; }
    instToTunnel[outpost.iframeInstanceId] = iframeTunnel;

    iframeTunnel.onclosed = function() {
      delete instToTunnel[outpost.iframeInstanceId];
    };

    var location = outpost.clientLocation;
    var startId = outpost.clientStartId;
    
    if (startId in expectedPages) {
      var ready = expectedPages[startId];
      delete expectedPages[startId];
      ready.post(buildActivateCap(outpost.navigate));
    }
    else if (startId in pendingActivates) {
      // client is an instance we are expecting
      var pending = pendingActivates[startId];
      delete pendingActivates[startId];
      if (pending.isStation) {
        pending.outpost.setStationCallbacks = makeSetStationCallbacks();
        pending.outpost.services = makeHighlighting();
      }

      pending.outpost.expectPage = makeExpectPage();

      if (pending.activateContinuations) {
        pending.activateContinuations.sk(workerServer.grant(outpost.windowClose));
        delete pending.activateContinuations;
      }
      instToTunnel[pending.instanceId] = iframeTunnel;
      highlighters[outpost.iframeInstanceId] = {
        highlight: outpost.highlight,
        unhighlight: outpost.unhighlight
      };

      iframeTunnel.onclosed = function() {
        delete instToTunnel[outpost.iframeInstanceId];
        delete instToTunnel[pending.instanceId];
        delete highlighters[outpost.iframeInstanceId];
        if (!pending.isStation) {
          stationCaps.closeInstHandler.put(pending.instanceId);
        }
      };

      outpost.setUpClient.post(pending);
    } else {
      // client might want to become an instance or the station
      var tempInstanceId = newUUIDv4();
      instToTunnel[tempInstanceId] = iframeTunnel; // TODO(mzero): need to clean out
      outpost.setUpClient.post({
        instanceId: tempInstanceId,
        temporaryInstance: true,
        outpost: {
          instanceId: tempInstanceId,
          temporaryInstance: true,
          becomeInstance: workerServer.grant(function(instanceDescription) {
            stationCaps.newInstHandler.post({
              instanceDescription: instanceDescription,
              activate: buildActivateCap(outpost.navigate)
            });
          }),
          expectPage: makeExpectPage(),
          services: makeHighlighting()
        }
      }, function(v) {
        // on setUpClient success:
        checkForSuggestions(location,
            outpost.showSuggestions, outpost.navigate);
      });
    }
  }); // end setOutpustHandler

  // Message received by belay-frame.html:setUpWorker. Once received, it
  // creates its own end of the tunnel and sends an outpost message.
  port.postMessage('for setUpWorker');
});
