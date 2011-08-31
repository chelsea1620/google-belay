importScripts('lib/js/caps.js');

var station = undefined;

var workerInstID = newUUIDv4();
var workerServer = new CapServer(workerInstID);

var instToTunnel = Object.create(null);

var logCap;

function log() {
  logCap.put(Array.prototype.slice.call(arguments));
}

function resolver(instID) {
  if (instID === workerInstID) { return workerServer.publicInterface; }
  if (instID in instToTunnel) { return instToTunnel[instID].sendInterface; }
  return null;
}

workerServer.setResolver(resolver);

var stationGenerator =
  workerServer.restore("http://localhost:9001/belay/generate");

var pendingLaunches = Object.create(null);

function buildLauncher(openerCap) {
  return function(args, sk, fk) {
    var pending = {
      instID: args.instID,
      outpost: args.outpostData,
      isStation: args.isStation || false,
      launchClosures: { sk: sk, fk: fk }
    };
    var hash = '#' + newUUIDv4();
    pendingLaunches[hash] = pending;
    openerCap.post(args.url + hash);
  }
}

function launchStation(launchCap, openerCap) {
  launchCap.get(function(data) {
    var stationInstID = newUUIDv4();
    buildLauncher(openerCap)({
      url: data.page.html,
      instID: stationInstID,
      outpostData: { instanceID: stationInstID, info: data.info },
      isStation: true
    }, function(_) { }, function(_) { });
  });
}

var stationCaps;

function makeSetStationCallbacks() {
  return workerServer.grant(function(callbacks) {
    stationCaps = callbacks;
  });
};

var suggestions = Object.create(null);

function makeSuggestInst() {
  return workerServer.grant(function(args) {
    if (!(args.domain in suggestions)) {
      suggestions[args.domain] = Object.create(null);
    }
    suggestions[args.domain][args.instID] = {
      station: station,
      name: args.name,
      launchClicked: args.launchClicked
    };
  });
}

function makeRemoveSuggestInst() {
  return workerServer.grant(function(args) {
    if (args.domain in suggestions) {
      delete (suggestions[args.domain])[args.instID];
    }
  });
}

// Suggestions for the domain of href.
function suggestFor(href) {
  var m = href.match('^https?://[^/]*');
  if (!(m !== null &&  // failed match returns null
        m[0] in suggestions &&
        Object.keys(suggestions[m[0]]).length > 0)) {
    return [];
  }

  var domain = m[0];
  return suggestions[domain];
};

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

self.addEventListener('connect', function(e) { 
  var port = e.ports[0];
  var iframeTunnel = new CapTunnel(port);
  iframeTunnel.setLocalResolver(resolver);
  iframeTunnel.setOutpostHandler(function(outpost) {
    outpost = workerServer.dataPostProcess(outpost);
    if (!logCap) { logCap = outpost.log; }
    instToTunnel[outpost.iframeInstID] = iframeTunnel;
  
    iframeTunnel.onclosed = function() {
      delete instToTunnel[outpost.frameInstID];
    };

    var location = outpost.clientLocation;
    if (location.hash in pendingLaunches) {
      // client is an instance we are expecting
      var pending = pendingLaunches[location.hash];
      delete pendingLaunches[location.hash];
      if (pending.isStation) {
        pending.outpost.launch =
          workerServer.grant(buildLauncher(outpost.windowOpen));
        pending.outpost.setStationCallbacks = makeSetStationCallbacks();
        pending.outpost.suggestInst = makeSuggestInst();
        pending.outpost.removeSuggestInst = makeRemoveSuggestInst();
        pending.outpost.services = makeHighlighting();
        // note that this is the station
        // add a cap for launching from the station, closing over outpost.windowOpen
      }
      if (pending.launchClosures) {
        pending.launchClosures.sk(workerServer.grant(outpost.windowClose));
        delete pending.launchClosures;
      }
      instToTunnel[pending.instID] = iframeTunnel;
      highlighters[pending.iframeID] = {
        highlight: outpost.highlight,
        unhighlight: outpost.unhighlight
      };

      iframeTunnel.onclosed = function() {
        delete instToTunnel[outpost.iframeID];
        delete instToTunnel[pending.instID];
        delete highlighters[outpost.iframeID];
        if (!pending.isStation) {
          stationCaps.closeInstHandler.put(pending.instID);
        }
      };

      outpost.setUpClient.post(pending);
    }
    else {
      // client might want to become an instance or the station
      outpost.setUpClient.post({
        suggestions: suggestFor(outpost.clientLocation.href),
        clickSuggest: workerServer.grant(function(launchClicked) {
          launchClicked.post(workerServer.grant(function(args, sk, fk) {
            buildLauncher(outpost.windowLocation)
              ({ instID: args.instID,
                 outpostData: args.outpostData,
                 isStation: false,
                 url: args.url }, sk, fk);
          }));
        }),
        outpost: {
          becomeInstance: workerServer.grant(function(launchCap) {
            stationCaps.newInstHandler.post({
              launchData: launchCap, // TODO(mzero): name?
              relaunch: workerServer
                          .grant(buildLauncher(outpost.windowLocation))
            });
          }),
          becomeStation: workerServer.grant(function() {
            var openerCap = outpost.windowOpen;
            outpost.localStorage.get(function(sto) {
              if (sto.stationLaunchCap) {
                launchStation(sto.stationLaunchCap, openerCap);
              }
              else {
                stationGenerator.get(function(launchCap) {
                  sto.stationLaunchCap = launchCap;
                  outpost.localStorage.put(sto, function() {
                    launchStation(sto.stationLaunchCap, openerCap);
                  });
                });
              }
            });
          })
        }
      });
    }
  }); // end setOutpustHandler

  // Message received by belay-frame.html:setUpWorker. Once received, it
  // creates its own end of the tunnel and sends an outpost message.
  port.postMessage('for setUpWorker'); 
});
