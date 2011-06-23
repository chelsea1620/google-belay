var windowManager = (function() {

  var WindowManager = function() {
    this.windows = [];
    var my = this;
    // TODO(mzero): better be only one of these, should assert that
    window.addEventListener('message', function(e) {
      for (i in my.windows) {
        if (e.source == my.windows[i].domWindow) {
          return my.windows[i].remoteReady(e);
        }
      }
      return false;
    });
  };

  var windowManager = new WindowManager();

  WindowManager.prototype.open = function(url, name) {
    var w = new WindowManager.Window();
    this.windows.push(w);
    w.domWindow = window.open(url, name);
    return w.toRemotePort;
  };

  WindowManager.prototype.closeAll = function() {
    for (i in this.windows) {
      this.windows[i].close();
    }
    this.windows = [];
  };

  WindowManager.Window = function() {
    this.ready = false;
    this.domWindow = undefined;
    this.rawToRemotePort = undefined;

    var me = this;
    this.toRemotePort = {
      postMessage: function(data, ports) {
        if (me.ready) me.rawToRemotePort.postMessage(data, ports);
      },
      onmessage: undefined,
      ready: function() { return me.ready; }
    };
  };

  WindowManager.Window.prototype.initialized = function() {
    return this.ready;
  };

  WindowManager.Window.prototype.remoteReady = function(e) {
    this.rawToRemotePort = e.ports[0];

    var toRemotePort = this.toRemotePort;
    this.rawToRemotePort.onmessage = function(e) {
      if (toRemotePort.onmessage) toRemotePort.onmessage(e);
    };

    this.ready = true;
  };

  WindowManager.Window.prototype.close = function() {
    this.domWindow.close();
  };


  return new WindowManager();
})();

