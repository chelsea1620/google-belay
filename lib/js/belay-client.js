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

var capServer;
var launchInfo;
var ui;
var belayBrowser;
var onBelayReady;

(function() {
  'use strict';

  if (window.belay) {
    if (!('$$shim' in window.belay)) {
      return; // there is a configured belay system here already
    }
  } else {
    // There is no belay object, so build one that delays all calls.
    // This way, clients including this script can immediately call belay's
    // top level functions even though this script may require delayed loading
    // of other scripts.
    (function() {
      var callbacks = [];
      function handleCallback(f) {
        if(callbacks === null) { setTimeout(f, 0); }
        else { callbacks.push(f); }
      };
      function callCallbacks() {
        var tocall = callbacks;
        callbacks = null;
        tocall.forEach(function(f) { f(); });
      }

      window.belay = {
        start: function(handler) {
          var me = this;
          handleCallback(function() { me._start(handler); });
        },

        route: function(preImg, success, failure) {
          var me = this;
          handleCallback(function() { me._route(preImg, success, failure); });
        },

        startForLaunch: function(key, success, failure) {
          var me = this;
          handleCallback(function() {
            me._startForLaunch(key, success, failure);
          });
        },

        onBelayReady: handleCallback,

        _callCallbacks: callCallbacks,
        '$$shim': true
      };
    })();
  }

  function extractOrigin(s) {
    var m = s.match(/^(([^:\/?#]+):)?(\/\/([^\/?#]*))?/);
    return (m && m[0]) ? m[0] : false;
  }

  // Figure out where related scripts are.
  var thisScript = document.scripts[document.scripts.length-1];
  var thisSrc = thisScript.src;
  var thisBase = thisSrc.replace(/\/[^/]*$/, '');
  var reqSrc = thisBase + '/require.js';

  // Figure out which belay-frame to load:
  var frameSrc = (
      thisScript.dataset.belayframe  // spec'd in the script tag
      || window.belay._frameSrc  // saved from orginal invocation of this script
      || thisSrc.replace(/[^/]*$/, 'belay-frame.html') // a local one
      );
  var frameOrigin = extractOrigin(frameSrc) || 
    (window.location.protocol + '//' + window.location.host);

    // TODO: incomplete, should check for base tag if frameSrc is relative

  if (!window.require) {
    // if require.js isn't loaded, then load it and use it to reload this script
    window.belay._frameSrc = frameSrc;
    var script = document.createElement('script');
    script.setAttribute('src', reqSrc);
    script.dataset.main = thisSrc;
    document.head.appendChild(script);
    return;
  }


  // get the start id and hide it as soon as possible
  var startId = window.name;
  window.name = '';

  function buildActionPortOnMessage(iframe) {
    function toArray(v) {
      return Array.prototype.slice.call(v);
    }

    var HIGHLIGHT_CLASS = 'belay-possible';

    function unhighlight() {
      var elts = window.document.getElementsByClassName(HIGHLIGHT_CLASS);
      toArray(elts).forEach(function(elt) {
        elt.className = elt.className.replace(' ' + HIGHLIGHT_CLASS,
                                              ' ');
      });
    }

    function highlight(args) {
      unhighlight();
      toArray(window.document.getElementsByClassName(args.className))
      .filter(function(elt) {
        var ixrc = elt.getAttribute('data-rc');
        return args.rc === '*' || ixrc === '*' || ixrc === args.rc;
        // TODO(mzero): in theory only one of ixrc or rc should be checked for
        // wildcard, depending on if we are hilighting targets are sources.
       })
      .forEach(function(elt) {
        elt.className = elt.className + ' ' + HIGHLIGHT_CLASS;
      });
    };

    function actionPortOnMessage(msg) {
      if (msg.data === 'close') {
        window.open('', '_self').close();
        // close() doesn't work for some doc types, but this hack works always
      } else if (msg.data === 'showButterBar') {
        iframe.style.webkitTransition = 'all 0.5s ease-in';
        iframe.style.top = '0px';
      } else if (msg.data === 'hideButterBar') {
        if (window.belay.DEBUG) {
          // .top doesn't work because it is relative
          iframe.style.display = 'none';
        }
        else {
          iframe.style.top = '-' + iframe.style.height;
        }
      } else if (msg.data === 'unhighlight') {
        unhighlight();
      } else if (msg.data.op === 'highlight') {
        highlight(msg.data.args);
      } else if (msg.data.op === 'navigate') {
        window.location = msg.data.args.url;
        window.name = msg.data.args.startId;
          // TODO(iainmcgin): exposing startId to a potentially untrusted
          // outer window may give it a way to hijack the launch of an
          // instance. The implications of this need investigation.
      } else {
        console.log('unknown action', msg);
      }
    }

    return actionPortOnMessage;
  }

  var requireForBelay = require.config(
      {baseUrl: thisBase, context: 'belay-belay'});
  requireForBelay(
      ['require',
       './BelayComms', './utils', './CapServer', './CapTunnel', './common'],
      function(require, BelayComms, utils, CapServer, CapTunnel, common) {

    belay.newUUIDv4 = utils.newUUIDv4;

    function setUpBelayFrame() {
      var IFRAME_HEIGHT = window.belay.DEBUG ? '300px' : '40px';
      var IFRAME_NEG_HEIGHT = '-' + IFRAME_HEIGHT;

      var iframe = document.createElement('iframe');
      iframe.setAttribute('src', frameSrc);
      iframe.style.zIndex = 2000; // high enough???
      iframe.style.position = 'absolute';
      iframe.style.top = IFRAME_NEG_HEIGHT;
      iframe.style.left = '0px';
      iframe.style.width = '100%';
      iframe.style.height = IFRAME_HEIGHT;
      iframe.style.backgroundColor = '#ffffcc';
      iframe.style.border = '0px';
      iframe.name = 'belay-frame';
      if (window.belay.DEBUG) {
        iframe.style.position = 'relative';
      }
      document.body.appendChild(iframe);

      function init(comms) {
        comms.actionPort.onmessage = buildActionPortOnMessage(iframe);

        window.belay.port = comms.belayPort; // TODO(mzero): drop?

        setUpBelayTunnel(comms.belayPort);
        comms.actionPort.postMessage(
          // cross-domain <iframe> can set window.location but cannot read it
          { DEBUG: window.belay.DEBUG,
            // required on Chrome 14
            location: window.location.href,
            startId: startId });
      }

      BelayComms(iframe.contentWindow, frameOrigin, init);
    }

    var outpostForStart = null;
    var resolveMap = {};

    function setUpBelayTunnel(belayPort) {
      var tunnel = new CapTunnel(belayPort);
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
        
        launchInfo = outpostData.info;
        ui = {
          capDraggable: common.makeCapDraggable(capServer),
          capDroppable: common.makeCapDroppable(capServer)
        };

        belay._callCallbacks();
      });
    }

    function start(handler, capServer) {
      var util = {};
      for (var p in outpostForStart) {
        // TODO: It isn't clear how much of outputForStart should be copied over
        if (outpostForStart.hasOwnProperty(p)) {
          util[p] = outpostForStart[p];
        }
      }
      util.ui = ui;
      handler(capServer, util, outpostForStart.info);
    }

    function route(preImg, success, failure) {
      var snapshot =
          outpostForStart.info ? outpostForStart.info.snapshot : undefined;
      outpostForStart.routeWithHash.post(preImg, function(hashedInstanceId) {
        var capServer;
        if(snapshot && hashedInstanceId === JSON.parse(snapshot).id) {
          capServer = new CapServer(hashedInstanceId, snapshot);
        }
        else {
          capServer = new CapServer(hashedInstanceId);
        }
        resolveMap[hashedInstanceId] = capServer.publicInterface;
        success(capServer);
      }, failure);
    }

    belay._start = function(handler) {
      start(handler, capServer);
    };

    belay._route = function(preImg, success, failure) {
      route(preImg, success, failure);
    };

    belay._startForLaunch = function(key, success, failure) {
      if (!(key in outpostForStart.info)) {
        return failure({
          status: 404,
          message: "startForLaunch: Key " + key + " not found."
        });
      }
      var preImg = outpostForStart.info[key];
      route(preImg, function(capServer) {
        start(success, capServer);
      }, failure);
    };

    onBelayReady = belay.handleCallback;

    if (window.document.body === null) {
      window.addEventListener('load', setUpBelayFrame);
    }
    else {
      setUpBelayFrame();
    }
  });

})();

// used for selenium testing - each app under test should set
// window.belaytest.ready to true when the client is fully
// initialized and ready for use
// TODO(jasvir): How should belaytest be exported?
if (!window.belaytest) {
  window.belaytest = {
    ready: false
  };
}
