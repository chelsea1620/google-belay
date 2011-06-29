var windowManager = (function() {

  var WindowManager = function() {
    this.windows = [];
    var my = this;
    // TODO(mzero): better be only one of these, should assert that
    window.addEventListener('message', function(e) {
      for (i in my.windows) {
        if (e.source === my.windows[i].domWindow) {
          return my.windows[i].remoteReady(e);
        }
      }
      return false;
    });
  };

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
    this.toRemotePort = new PortQueue();
  };

  WindowManager.Window.prototype.remoteReady = function(e) {
    if(this.ready) {
      throw "Ready was true in remoteReady!!!  Event was: " + String(e);
    }

    this.toRemotePort.setPort(e.ports[0]);
    this.ready = true;
  };

  WindowManager.Window.prototype.close = function() {
    this.domWindow.close();
  };

  return new WindowManager();
})();

