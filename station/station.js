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


var topDiv;
var instanceInfo;
var capServer = new CapServer();

var defaultTools = [
    { name: 'Hello',
      icon: 'http://localhost:9002/tool-hello.png',
      generate: capServer.restore('http://localhost:9002/belay/generate')
    },
    { name: 'Sticky',
      icon: 'http://localhost:9003/tool-stickies.png',
      generate: capServer.restore('http://localhost:9003/belay/generate')
    },
    { name: 'Buzzer',
      icon: 'http://localhost:9004/tool-buzzer.png',
      generate: capServer.restore('http://localhost:9004/belay/generate')
    },
    { name: 'Emote',
      icon: 'http://localhost:9005/tool-emote.png',
      generate: capServer.restore('http://localhost:9005/belay/generate')
    },
    { name: 'bfriendr',
      icon: 'http://localhost:9001/tool.png',
      generate: capServer.restore('http://localhost:9009/belay/generate')
    }
  ];

//
// Desk top area
//
var resizeDesk = function(s) {
  //topDiv.find('#belay-station-outer').width(s.w);
  topDiv.find('#belay-desk').height(s.h);
  return false;
};
var setupDeskSizes = function(top) {
  var controls = top.find('#belay-controls');
  var deskSizes = {
    small: {w: 600, h: 350},
    medium: {w: 1200, h: 650},
    large: {w: 2200, h: 1200} };
  for (var p in deskSizes) {
    var s = deskSizes[p];
    controls.append('<a href="#">' + p + '</a> ');
    controls.find(':last-child').click(function() { return resizeDesk(s); });
  }
};

var nextLeft = 100;
var nextTop = 50;


//
// Testing
//
var setupTestButton = function(top, f) {
  var controls = top.find('#belay-controls');
  controls.append('<a href="#">test</a>');
  controls.find(':last-child').click(f);
};

//
// Instance Data
//
var instances = {};
/*
  a map from instanceIDs to
   { id: uuid,       -- the id of this instance
     storageCap: cap,-- where station stores instance state (see next member)
     state: {
       belayInstance: cap(belay/instance),
       launch: {
          page: { html: url, window: { width: int, height: int } },
          gadget: { html: url, scripts: [url] },
          info: any
       },

       capSnapshot: string,
       window: {     -- info on gadget location
         top: int, left: int, width: int, height: int,
       },
       data: string  -- stored data for the instance
     },
     capServer: caps -- the cap server for this instance (if !state.remote)
     capTunnel: capt -- the cap tunnel for this instance (if state.remote)
   }
*/

var dirtyInstances = [];
var dirtyProcess = function() {
  if (dirtyInstances.length <= 0) { return; }
  var instID = dirtyInstances.shift();
  var inst = instances[instID];
  // TODO(arjun): who should do the saving? should windowed instances also
  // have a capserver stored by station?
  if (inst.capServer) {
    inst.state.capSnapshot = inst.capServer.snapshot();
  }
  inst.storageCap.post(inst.state, dirtyProcess);
};
var dirty = function(inst) {
  var instID = inst.id;
  if (dirtyInstances.indexOf(instID) >= 0) return;
  dirtyInstances.push(instID);
  if (dirtyInstances.length === 1)
    setTimeout(dirtyProcess, 1000);
};
var ensureSync = function(inst, k) {
  var ix = dirtyInstances.indexOf(inst.id);
  if (ix == -1) { k(); }
  else {
    dirtyInstances.splice(ix, 1);
    inst.state.capSnapshot = inst.capServer.snapshot();
    inst.storageCap.post(inst.state, k);
  }
};

//
// CapServers
//
var instanceResolver = function(id) {
  if (instances[id] && !instances[id].capServer) {
    return instances[id].capServer.publicInterface;
  }
  if (instances[id] && instances[id].capTunnel) {
    return instances[id].capTunnel.sendInterface;
  }
  if (id === capServer.instanceID) {
    return capServer.publicInterface;
  }
  return null;
};

capServer.setResolver(instanceResolver);

var setupCapServer = function(inst) {
  var capServer;
  if ('capSnapshot' in inst.state) {
    capServer = new CapServer(inst.state.capSnapshot);
  }
  else {
    capServer = new CapServer();
    inst.id = capServer.instanceID;
  }
  inst.capServer = capServer;
  capServer.setResolver(instanceResolver);
};

var setupCapTunnel = function(instID, port) {
  var tunnel = new CapTunnel(port);
  var instance;
  if (instances[instID]) {
    instance = instances[instID];
  }
  else { throw 'Creating a tunnel for non-existent instanceID!'; }

  instance.capServer = undefined;
  instance.capTunnel = tunnel;

  tunnel.setLocalResolver(instanceResolver);
};


//
// Dragging Support
//
var capDraggingInfo;
  // HACK: only works so long as only one drag in process at a time

var startDrag = function(info) {
  capDraggingInfo = info;
  info.node.addClass('belay-selected');
};
var stopDrag = function(info) {
  capDraggingInfo = undefined;
  info.node.removeClass('belay-selected');
};
var startDropHover = function(node, rc) {
  node.addClass('belay-selected');
  var sources = topDiv.find('.belay-cap-source');
  if (rc == '*') {
    sources.addClass('belay-possible');
  } else {
    for (var i = 0; i < sources.length; ++i) {
      var s = sources.eq(i);
      if (s.data('rc') == rc) s.addClass('belay-possible');
    }
  }
};
var stopDropHover = function(node, rc) {
  node.removeClass('belay-selected');
  topDiv.find('.belay-cap-source').removeClass('belay-possible');
};

var desk = undefined;
var protoContainer = undefined;

var launchGadgetInstance = function(inst) {
  var instState = inst.state;

  if (!('window' in instState)) {
    instState.window = { top: nextTop += 10, left: nextLeft += 20}
  }
  
  var container = protoContainer.clone();
  var header = container.find('.belay-container-header');
  var holder = container.find('.belay-container-holder');
  holder.empty();
  var topDiv = $('<div></div>').prependTo(holder);
  container.appendTo(desk);
  container.css('left', instState.window.left)
           .css('top', instState.window.top)
           .width(instState.window.width || '10em')
           .height(instState.window.height || '6em');
  
  var extras = {
    topDiv: topDiv,
    launchInfo: inst.launch.info,
    storage: {
      get: function(k) { k(instState.data); },
      put: function(d, k) { 
        instState.data = d; 
        dirty(inst); 
        if (k) { k(); }
      }
    },
    // windowed instances require onBelayReady; gadgets also have it for
    // uniformity
    onBelayReady: function(callback) { callback(); },
    capServer: inst.capServer,
    ui: {
      resize: function(minWidth, minHeight, resizable) {
        if (resizable) {
          container.resizable({
            containment: desk,
            handles: 'se',
            minWidth: minWidth,
            minHeight: minHeight,
            stop: function(ev, ui) {
              instState.window.width = container.width();
              instState.window.height = container.height();
              dirty(inst);
            }
          });
          if (container.width() < minWidth) container.width(minWidth);
          if (container.height() < minHeight) container.height(minHeight);
        }
        else {
          container.resizable('destroy');
          if (container.width() != minWidth ||
              container.height() != minHeight) {
            container.width(minWidth);
            container.height(minHeight);
            instState.window.width = container.width();
            instState.window.height = container.height();
            dirty(inst);
          }
        }
      },
      capDraggable: function(node, rc, generator) {
        var helper = node.clone();
        var info = {
          node: node,
          resourceClass: rc,
          generator: function(rc) {
            var cap = generator(rc);
            dirty(inst);
            return cap.serialize();
          }
        };
        node.data('rc', rc);
        node.draggable({
          appendTo: desk,
          helper: function() { return helper; },
          start: function() { startDrag(info); },
          stop: function() { stopDrag(info); },
          scope: 'default',
          zIndex: 9999
        });
        node.addClass('belay-cap-source');
      },
      capDroppable: function(node, rc, acceptor) {
        node.droppable({
          scope: 'default',
          activeClass: 'belay-possible',
          hoverClass: 'belay-selected',
          drop: function(evt, ui) {
            var info = capDraggingInfo;
            acceptor(info.generator(info.resourceClass), info.resourceClass);
          },
          accept: function(elt) {
            return (rc === '*') || (elt.data('rc') === rc);
          }
        });

        // Note:  Without preventDf on dragenter and dragover, the
        // browser will not send the drop event
        var preventDf = function(e) {
          e.originalEvent.preventDefault();
          return false;
        };
        node.bind('dragenter', preventDf);
        node.bind('dragover', preventDf);
        node.bind('drop', function(e) {
          if (!e.originalEvent.dataTransfer) return;
          var data = e.originalEvent.dataTransfer.getData('text/plain');
          if (!data)
            data = e.originalEvent.dataTransfer.getData('text/uri-list');
          if (!data) return;
          var qLoc = data.indexOf('?');
          data = qLoc == -1 ? data : data.slice(qLoc);
          var params = jQuery.parseQuery(data);
          var scope = params.scope;
          var cap = params.cap;

          if (scope == rc) {
            acceptor(capServer.restore(cap));
          }
        });

        node.addClass('belay-cap-target');
        node.hover(
          function() { startDropHover(node, rc); },
          function() { stopDropHover(node, rc); });
      }
    }
  };

  container.draggable({
    containment: desk,
    cursor: 'crosshair',
    // handle: container.find('.belay-container-header'),
    stack: '.belay-container',
    stop: function(ev, ui) {
      instState.window.left = container.css('left');
      instState.window.top = container.css('top');
      dirty(inst);
    }
  });

  header.append('<div class="belay-control">×</div>');
  var closeBox = header.find(':last-child');
  closeBox.click(function() {
    inst.capServer.revokeAll();
    delete instances[inst.id];
    container.hide(function() { container.remove(); });
    inst.storageCap.remove(function() {}, function() {});
  });
  closeBox.hover(function() { closeBox.addClass('hover'); },
                 function() { closeBox.removeClass('hover'); });

  header.append('<div class="belay-control">↑</div>');
  var maxBox = header.find(':last-child');
  maxBox.click(function() {
    // container.hide(function() { container.remove(); });
    // launchExternal(inst);
    alert("pop-out not yet implemented");
  });
  maxBox.hover(function() { maxBox.addClass('hover'); },
               function() { maxBox.removeClass('hover'); });

  dirty(inst);

  topDiv.load(inst.launch.gadget.html, function() {
    foop(inst.launch.gadget.scripts, extras);
  });
};

var launchPageInstance = function(inst) {
  var features = [];
  if ('width' in launch.page.window)
    features.push('width=' + Number(launch.page.window.width));
  if ('height' in launch.page.window)
    features.push('height=' + Number(launch.page.window.height));

  var port = windowManager.open(launch.page.html, inst.id,
      features.join(','));

  setupCapTunnel(inst.id, port);
  inst.capTunnel.sendOutpost({ 
    info: launch.info,
    storage: capServer.grant({
      get: function() { return instState.data; },
      put: function(d) { instState.data = d; dirty(inst); }
    })
    .serialize()
  });
};

var launchInstance = function(inst) {
  var instState = inst.state;

  // TODO(mzero) create cap for storage to station
  // gets/puts from instState.data, and dirty(inst) on put

  dirty(inst);
  instState.belayInstance.get(function(launch) {
    inst.launch = launch;
    if (launch.page) {
      launchPageInstance(inst);
    }
    else if (launch.gadget) {
      launchGadgetInstance(inst);
    }
    else {
      alert('launchInstance: no known way to launch this instance');
    }
  });
};

var getAndLaunchInstance = function(storageCap) {
  storageCap.get(function(instState) {
    var inst = {
      storageCap: storageCap,
      state: instState
    };
    setupCapServer(inst);
    inst.id = inst.capServer.instanceID; // TODO(mzero): hack!
    instances[inst.id] = inst;
    launchInstance(inst);
  },
  function(status) { alert('Failed to load instance: ' + status); });
};

var initialize = function(instanceCaps) {
  var top = topDiv;
  var toolbar = top.find('#belay-toolbar');
  desk = top.find('#belay-desk');

  var protoTool = toolbar.find('.belay-tool').eq(0).detach();
  toolbar.find('.belay-tool').remove(); // remove the rest

  protoContainer = desk.find('.belay-container').eq(0).detach();
  desk.find('.belay-container').remove(); // remove the rest

  setupDeskSizes(top);
  setupTestButton(top, function() { alert('test!'); });

  function createInstanceFromTool(toolInfo) {

    function initializeAndLaunchNewInstance(inst) {
      setupCapServer(inst);
      // TODO(arjun) still a hack. Should we be concatenaing URLs here?
      inst.storageCap = capServer.grant(instanceInfo.instanceBase + inst.id);
      instances[inst.id] = inst;
      launchInstance(inst);
      dirty(inst);
    }

    toolInfo.generate.get(
      function(data) {
        var inst = {
          state: {
            belayInstance: data,
            info: undefined
          }
        };
        initializeAndLaunchNewInstance(inst);
      },
      function(error) {
        alert('Failed to createNewInstanceFromTool ' +
          toolInfo.name + ', error = ' + error);
      }
    );
  };

  defaultTools.forEach(function(toolInfo) {
    var tool = protoTool.clone();
    tool.find('p').text(toolInfo.name);
    tool.find('img').attr('src', toolInfo.icon);
    tool.appendTo(toolbar);
    tool.click(function() { createInstanceFromTool(toolInfo); return false; });
  });

  instanceCaps.forEach(getAndLaunchInstance);
};

// TODO(arjun): Retreiving vanilla HTML. Not a Belay cap?
$(function() {
  topDiv = $('#aux div').eq(0);

  var tunnel = new CapTunnel(window.belayPort);
  tunnel.setOutpostHandler(function(outpost) {
    instanceInfo = outpost.info;
    var instancesCap = capServer.restore(instanceInfo.instances);
    instancesCap.get(initialize, function(err) { alert(err.message); });
  });
});
