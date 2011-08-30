importScripts('lib/js/caps.js');

var station = undefined;

var workerInstID = newUUIDv4();
var workerServer = new CapServer(workerInstID);

var instToTunnel = Object.create(null);

function log(msg) {
  // Tunnel intercepts "log" messages
  loggingPort.postMessage({ op: "log", msg: msg });
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
  return function(args) {
    var pending = {
      instID: args.instID,
      outpost: args.outpostData,
      isStation: args.isStation || false
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
    });
  });
}

var stationCaps;

function makeSetStationCallbacks() {
  return workerServer.grant(function(callbacks) {
    stationCaps = callbacks;
  });
};

function makeSuggestInst() {
  return workerServer.grant(function(v) {
    log("suggestInst NYI");
  });
}

function makeRemoveSuggestInst() {
  return workerServer.grant(function(v) {
    log("removeSuggestInst NYI");
  });
}

function makeHighlighting() {
  return {
    highlightByRC: workerServer.grant(function(v) {
      log("highlightByRC NYI");
    }),
    unhighlight: workerServer.grant(function(v) {
      log("unhighlight NYI");
    })
  };
}



self.addEventListener('connect', function(e) { 
  var port = e.ports[0];
  var iframeTunnel = new CapTunnel(port);

  // Logging hack, prints to console of most recent window.
  loggingPort = port;

  iframeTunnel.setLocalResolver(resolver);
  iframeTunnel.setOutpostHandler(function(outpost) {
    outpost = workerServer.dataPostProcess(outpost);
    instToTunnel[outpost.iframeInstID] = iframeTunnel;
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
      instToTunnel[pending.instID] = iframeTunnel;
      outpost.setUpClient.post(pending);
    }
    else {
      // client might want to become an instance or the station
      outpost.setUpClient.post({
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
