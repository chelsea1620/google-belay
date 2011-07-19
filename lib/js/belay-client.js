var storage;
var topDiv;
var capServer;
var tunnel = new CapTunnel(openerPort);
var launchInfo;
var ui;

var onBelayReady = (function() {
  var callbacks = [];
  var windowLoaded = false;
  var outpostReceived = false;


  var ready = function()  { return windowLoaded && outpostReceived; };
  var loadIfReady = function() {
    if(ready()) {
      callbacks.forEach(function(f) { f(); });
      callbacks = null;
    }
  };

  window.addEventListener('load', function(evt) {
    topDiv = $(document.body).find('div:first');
    windowLoaded = true;
    loadIfReady(); 
  });

  tunnel.setOutpostHandler(function(data) {
    var setupData = (function() {
      var processedData = (new CapServer('radish')).dataPostProcess(data);
      return {
        instanceID: processedData.instanceID,
        // TODO(jpolitz): problem because of wrong capserver processing?
        snapshot: processedData.initialSnapshot
      };
    })();
    var instanceID = setupData.instanceID;
    var snapshot = setupData.snapshot; 

    if (snapshot) capServer = new CapServer(instanceID, snapshot); 
    else capServer = new CapServer(instanceID);

    var resolver = function(instID) {
      return tunnel.sendInterface;
    };
    capServer.setResolver(resolver);

    tunnel.setLocalResolver(function(instID) {
      if(instID === instanceID) return capServer.publicInterface;
      else return null;
    });

    var outpostData = capServer.dataPostProcess(data);
    
    var dirty = function() {
      outpostData.snapshot.put(capServer.snapshot());
    };
    capServer.setSyncNotifier(dirty);

    storage = outpostData.storage;
    launchInfo = outpostData.info;
    ui = {
      resize: function() { /* do nothing in page mode */ },
      capDraggable: common.makeCapDraggable(capServer, dirty),
      capDroppable: common.makeCapDroppable(capServer, dirty)
    };

    outpostReceived = true;
    loadIfReady();
  });

  return function(callback) {
    if (ready()) { callback(); }
    else { callbacks.push(callback); }
  };
})();


