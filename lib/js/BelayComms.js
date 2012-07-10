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

define(function() {
  'use strict';

  function MessageChannelComms(remoteWindow, origin, handleInit) {
    if (handleInit) {
      var connect = function(e) {
        if (e.source != remoteWindow) { return; }
        if (e.origin != origin && origin != '*') { return; }
        window.removeEventListener('message', connect);
        handleInit({
          belayPort: e.ports[0],
          actionPort: e.ports[1],
          initData: e.data
        });
      };
      window.addEventListener('message', connect);
    } else {
      var belayChan = new MessageChannel();
      var actionChan = new MessageChannel();

      return {
        belayPort: belayChan.port1,
        actionPort: actionChan.port1,
        postInit: function(msg) {
          remoteWindow.postMessage(
            msg,
            // two following args. backward for Chrome and Safari
            [belayChan.port2, actionChan.port2],
            origin);
        }
      };
    }
  }

  function MultiplexedComms(remoteWindow, origin, handleInit) {
    var ConcentratedPort = function(id) {
      this.id = id;
      this.onmessage = null;
    };
    ConcentratedPort.prototype.postMessage = function(data) {
      remoteWindow.postMessage({ id: this.id, data: data }, origin);
    };

    var ports = {
      belay: new ConcentratedPort('belay'),
      action: new ConcentratedPort('action')
    };

    function handleEvent(e) {
      if (e.source !== remoteWindow) { return; }
      if (e.origin !== origin && origin !== '*') { return; }
      if (e.data.id in ports) {
        var onmessage = ports[e.data.id].onmessage;
        if (onmessage) { onmessage({ data: e.data.data }); }
      }
      else if (handleInit && e.data.id == 'init') {
        handleInit({
          belayPort: ports.belay,
          actionPort: ports.action,
          initData: e.data.data
        });
      }
      e.stopPropagation();
    }

    window.addEventListener('message', handleEvent);
    if (handleInit) {
      // Nothing to do: Just wait for the init event,
      // and handleEvent will call handleInit.
    } else {
      return {
        belayPort: ports.belay,
        actionPort: ports.action,
        postInit: function(msg) {
          remoteWindow.postMessage({ id: 'init', data: msg }, origin);
        }
      };
    }
  }

  var BelayComms =
    'MessageChannel' in window ? MessageChannelComms : MultiplexedComms;
  return BelayComms;

});
