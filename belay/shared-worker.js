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
    buildLauncher(openerCap)({
      url: data.page.html,
      instID: newUUIDv4,
      outpostData: { info: data.info },
      isStation: true
    });
  });
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
    if (location.hash in pendingLaunches) {
      // client is an instance we are expecting
      var pending = pendingLaunches[location.hash];
      delete pendingLaunches[location.hash];
      if (pending.isStation) {
        pending.outpost.launch = buildLauncher(outpost.windowOpen);
        // note that this is the station
        // add a cap for launching from the station, closing over outpost.windowOpen
      }
      instToTunnel[pending.instID] = iframeTunnel;
      outpost.setUpClient.post({ outpost: pending });
    }
    else {
      // client might want to become an instance or the station
      outpost.setUpClient.post({
        workerInstID: workerInstID,
        // The outpost field is forwarded unmolested to the client. Other
        // fields are not forwarded and thus may contain caps that are
        // exclusively for the embedded <iframe>.
        outpost: {
          becomeInstance: workerServer.grant(function(launchCap) {
            stationCaps.newInstHandler.post({
              launchData: launchCap, // TODO(mzero): name?
              relaunch: workerServer
                          .grant(buildLauncher(outpost.windowLocation))
            }) 
          }),
          becomeStation: workerServer.grant(function() {
            var openerCap = outpost.windowLocation;
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
      })
    }
  }); // end setOutpustHandler

  // Message received by belay-frame.html:setUpWorker. Once received, it
  // creates its own end of the tunnel and sends an outpost message.
  port.postMessage('for setUpWorker'); 
});
