var storage;
var topDiv;
var capServer;
var tunnel;
var launchInfo;
var ui;
var belayBrowser;

// used for selenium testing - each app under test should set
// window.belaytest.ready to true when the client is fully
// initialized and ready for use
// TODO(jasvir): How should belaytest be exported?
if (!window.belaytest) {
  window.belaytest = {
    ready: false
  }
}

var onBelayReady = (function() {
  var callbacks = [];
  var outpostReceived = false;

  window.addEventListener('load', function(evt) {
    topDiv = $(document.body).find('div:first');
  });

  window.belay.portReady = function() {
    tunnel = new CapTunnel(window.belay.port);
    tunnel.setOutpostHandler(function(outpostData) {
      var localInstanceId = outpostData.instanceId;
      var snapshot = outpostData.info ? outpostData.info.snapshot : undefined;
      capServer = new CapServer(localInstanceId, snapshot);

      var resolver = function(instanceId) {
        return tunnel.sendInterface;
      };
      capServer.setResolver(resolver);

      tunnel.setLocalResolver(function(instanceId) {
        if (instanceId === localInstanceId) return capServer.publicInterface;
        else return null;
      });

      belay.outpost = outpostData;
      belayBrowser = outpostData.services;

      belay.dirty = function() {
        // Do nothing: should be replaced by instance if needed
      };

      capServer.setSyncNotifier(function() {
        belay.dirty();
      });

      storage = outpostData.storage;
      launchInfo = outpostData.info;
      ui = {
        resize: function() { /* do nothing in page mode */ },
        capDraggable: common.makeCapDraggable(capServer),
        capDroppable: common.makeCapDroppable(capServer)
      };

      outpostReceived = true;
      callbacks.forEach(function(f) { f(); });
      callbacks = null;

      window.addEventListener("beforeunload", function() {
        outpostData.notifyClose.post();
      })
    });
  };

  return function(callback) {
    if (outpostReceived) { callback(); }
    else { callbacks.push(callback); }
  };
})();

// TODO(jasvir): Once everything is modulized, replace this file with a wrapper
if (typeof define === "function" && define.amd) {
  define(function () { return onBelayReady; });
}
