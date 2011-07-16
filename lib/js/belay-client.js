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
    var instanceID = (new CapServer('radish')).dataPostProcess(data).instanceID;
    var resolver = function(instID) {
      return tunnel.sendInterface;
    };
    capServer = new CapServer(instanceID);
    capServer.setResolver(resolver);

    var outpostData = capServer.dataPostProcess(data);

    storage = outpostData.storage;
    launchInfo = outpostData.info;
    ui = {
      resize: function() { /* do nothing in page mode */ },
      capDraggable: function() { /* TODO(jpolitz): not yet implemented */ }
    };

    outpostReceived = true;
    loadIfReady();
  });

  return function(callback) {
    if (ready()) { callback(); }
    else { callbacks.push(callback); }
  };
})();


