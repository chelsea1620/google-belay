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
    if (this.ready) {
      throw 'Ready was true in remoteReady!!!  Event was: ' + String(e);
    }

    this.toRemotePort.setPort(e.ports[0]);
    this.ready = true;
  };

  WindowManager.Window.prototype.close = function() {
    this.domWindow.close();
  };

  return new WindowManager();
})();

