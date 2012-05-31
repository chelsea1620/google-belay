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
  };
}

var onBelayReady = (function() {
  var callbacks = [];
  var outpostReceived = false;
  var outpostForStart = null;
  var resolveMap = {};

  window.addEventListener('load', function(evt) {
    topDiv = $(document.body).find('div:first');
  });

  window.belay.onPortReady(function() {
    tunnel = new CapTunnel(window.belay.port);
    tunnel.setOutpostHandler(function(outpostData) {
      var localInstanceId = outpostData.instanceId;
      outpostForStart = outpostData;
      var snapshot = outpostData.info ? outpostData.info.snapshot : undefined;
      capServer = new CapServer(localInstanceId, snapshot);

      var resolver = function(instanceId) {
        return tunnel.sendInterface;
      };
      capServer.setResolver(resolver);
      
      resolveMap[localInstanceId] = capServer.publicInterface;

      tunnel.setLocalResolver(function(instanceId) {
        if (instanceId in resolveMap) return resolveMap[instanceId];
        else return null;
      });

      belay.outpost = outpostData;
      belayBrowser = outpostData.services;
      

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
    });
  });

  function handleCallback(f) {
    if(outpostReceived) { setTimeout(f, 0); }
    else { callbacks.push(f); }
  };

  belay.start = function(handler) {
    handleCallback(function() {
      var util = {
        ui: ui,
        expectPage: outpostForStart.expectPage,
        activateLocalPage: outpostForStart.activateLocalPage,
        becomeInstance: outpostForStart.becomeInstance
      };
      handler(capServer, util, outpostForStart.info);
    });
  };

  belay.route = function(preImg, success, failure) {
    handleCallback(function() {
      var snapshot = outpostForStart.info ? outpostForStart.info.snapshot : undefined;
      outpostForStart.routeWithHash.post(preImg, function(hashedInstanceId) {
        var cs;
        if(snapshot && hashedInstanceId === JSON.parse(snapshot).id) {
          cs = new CapServer(hashedInstanceId, snapshot);
        }
        else {
          cs = new CapServer(hashedInstanceId);
        }
        resolveMap[hashedInstanceId] = cs.publicInterface;
        success(cs);
      }, failure);
    });
  };

  return function(callback) {
    if (outpostReceived) { callback(); }
    else { callbacks.push(callback); }
  };
})();

// TODO(jasvir): Once everything is modulized, replace this file with a wrapper
if (typeof define === 'function' && define.amd) {
  define(function() { return onBelayReady; });
}
