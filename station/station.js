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
var capServer = new CapServer(newUUIDv4());

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
// Instance Data
//
var instances = {};
/*
  a map from instanceIDs to
   { 
     storageCap: cap,-- where station stores instance state (see next member)
     state: {
       id: uuid,
       belayInstance: cap(belay/instance),
       launch: {
          page: { html: url, window: { width: int, height: int } },
          gadget: { html: url, scripts: [url] },
          info: any
       },
       capSnapshot: string,

       name: string,
       opened: string, -- 'page', 'gadget', or 'closed'
       window: {     -- info on gadget location
         top: int, left: int, width: int, height: int,
       },
       data: string  -- stored data for the instance
     },
     capServer: caps -- the cap server for this instance (if !state.remote)
     capTunnel: capt -- the cap tunnel for this instance (if state.remote)

     rowNode: node -- node in the item list
     pageWindow: window -- if open in page view, the window it is in
     gadgetNode: node -- if open in gadget view, the container node it is in
   }
*/

var dirtyInstances = [];
var dirtyProcess = function() {
  var inst;
  while (!inst) {
    if (dirtyInstances.length <= 0) { return; }
    var instID = dirtyInstances.shift(); 
    inst = instances[instID];
  }
  // TODO(arjun): who should do the saving? should windowed instances also
  // have a capserver stored by station?
  if (inst.capServer) {
    inst.state.capSnapshot = inst.capServer.snapshot();
  }
  inst.storageCap.post(inst.state, dirtyProcess);
};
var dirty = function(inst) {
  var instID = inst.state.id;
  if (dirtyInstances.indexOf(instID) >= 0) return;
  dirtyInstances.push(instID);
  if (dirtyInstances.length === 1)
    setTimeout(dirtyProcess, 1000);
};
var ensureSync = function(inst, k) {
  var ix = dirtyInstances.indexOf(inst.state.id);
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
  if (instances[id] && instances[id].capServer) {
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
    capServer = new CapServer(inst.state.id, inst.state.capSnapshot);
  }
  else {
    capServer = new CapServer(inst.state.id);
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


var closeGadgetInstance = function(inst) {
  if (inst.gadgetNode) {
    var g = inst.gadgetNode;
    g.hide(function() { g.remove(); });
    inst.gadgetNode = undefined;
    inst.state.opened = 'closed';
    dirty(inst);
  }
}

var closePageInstance = function(inst) {
  if (inst.pageWindow) {
    // inst.pageWindow.close();
    // TODO(mzero): we don't really have a window to close
    inst.pageWindow = undefined;
    inst.state.opened = 'closed';
    dirty(inst);
  }
}


var launchGadgetInstance = function(inst) {
  if (inst.gadgetNode) return;
  closePageInstance(inst);
  
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
  closeBox.click(function() { closeGadgetInstance(inst); });
  closeBox.hover(function() { closeBox.addClass('hover'); },
                 function() { closeBox.removeClass('hover'); });

  if ('page' in inst.launch) {
    header.append('<div class="belay-control">↑</div>');
    var maxBox = header.find(':last-child');
    maxBox.click(function() { launchPageInstance(inst); });
    maxBox.hover(function() { maxBox.addClass('hover'); },
                 function() { maxBox.removeClass('hover'); });
  }
  
  inst.gadgetNode = container;
  inst.state.opened = 'gadget';
  dirty(inst);

  topDiv.load(inst.launch.gadget.html, function() {
    foop(inst.launch.gadget.scripts, extras);
  });
};

var launchPageInstance = function(inst) {
  if (inst.pageWindow) return;
  closeGadgetInstance(inst);
  inst.pageWindow = true;
  inst.state.opened = 'page';
  dirty(inst);
  
  var features = [];
  if ('width' in inst.launch.page.window)
    features.push('width=' + Number(inst.launch.page.window.width));
  if ('height' in inst.launch.page.window)
    features.push('height=' + Number(inst.launch.page.window.height));

  var port = windowManager.open(inst.launch.page.html, inst.state.id,
      features.join(','));

  setupCapTunnel(inst.state.id, port);
  inst.capTunnel.sendOutpost(capServer.dataPreProcess({ 
    info: inst.launch.info,
    instanceID: inst.state.id,
    initialSnapshot: (inst.state.capSnapshot ? inst.state.capSnapshot : false),
    storage: capServer.grant({
      get: function() { return inst.state.data; },
      put: function(d) { inst.state.data = d; dirty(inst); }
    }),
    snapshot: capServer.grant({
      get: function() { return inst.state.capSnapshot; },
      put: function(snap) { inst.state.capSnapshot = snap; dirty(inst); }
    })
  }));
};

var launchInstance = function(inst, openType) {
  var instState = inst.state;
  
  // TODO(mzero) create cap for storage to station
  // gets/puts from instState.data, and dirty(inst) on put

  dirty(inst);
  instState.belayInstance.get(function(launch) {
    inst.launch = launch;
    var canGadget = 'gadget' in launch;
    var canPage = 'page' in launch;
    
    var row = inst.rowNode;
    var asVis = function(b) { return b ? 'visible' : 'hidden'; }
    row.find('.open-gadget').css('visibility', asVis(canGadget));
    row.find('.open-page').css('visibility', asVis(canPage));
    
    var preferred = canGadget ? 'gadget' : (canPage ? 'page' : 'none');
    
    if (openType == 'restore') {
      openType = ('opened' in instState) ? instState.opened : preferred;
    }
    else if (openType == 'openAny') {
      openType = preferred;
    };
    
    if (openType == 'closed' || openType == 'none') {
      // leave closed!
    }
    else if (openType == 'page' && canPage) {
      launchPageInstance(inst);
    }
    else if (openType == 'gadget' && canGadget) {
      launchGadgetInstance(inst);
    }
    else {
      alert('launchInstance: this instance cannot open as a ' + openType);
    }
  });
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


  var itemsDiv = topDiv.find('#belay-items');
  var itemsTable = itemsDiv.find('table');
  var protoItemRow = itemsTable.find('tr').eq(0).detach();
  itemsTable.find('tr').remove();

  var removeInstance = function(inst) {
    closeGadgetInstance(inst);
    closePageInstance(inst);
    inst.rowNode.fadeOut(function() { inst.rowNode.remove(); });
    inst.capServer.revokeAll();
    delete instances[inst.state.id];
    inst.storageCap.remove();
  };
  
  var addInstance = function(inst, openType) {
    setupCapServer(inst);
    instances[inst.state.id] = inst;

    var row = protoItemRow.clone();
    inst.rowNode = row;
    
    row.find('td').eq(0).text(inst.state.name || 'an item');
    row.find('td.actions .open-page').click(function() {
        launchInstance(inst, 'page');
      });
    row.find('td.actions .open-gadget').click(function() {
        launchInstance(inst, 'gadget');
      });
    row.find('td.actions .remove').click(function() {
        removeInstance(inst);
      });
    row.appendTo(itemsTable);
    
    launchInstance(inst, openType);
  };  
  
  var addInstanceFromTool = function(toolInfo) {
    toolInfo.generate.get(function(data) {
        var newID = newUUIDv4();
        var inst = {
          storageCap: capServer.grant(instanceInfo.instanceBase + newID),
            // TODO(arjun) still a hack. Should we be concatenaing URLs here?
          state: {
            id: newID,
            belayInstance: data,
            name: "an instance of " + toolInfo.name,
            info: undefined
          }
        };
        addInstance(inst, 'openAny');
        dirty(inst);
      },
      function(error) {
        alert('Failed to createNewInstanceFromTool ' +
          toolInfo.name + ', error = ' + error);
      }
    );
  };
  
  var addInstanceFromStorage = function(storageCap) {
    storageCap.get(function(instState) {
        var inst = {
          storageCap: storageCap,
          state: instState
        };
        addInstance(inst, 'restore');
      },
      function(status) { alert('Failed to load instance: ' + status); }
    );
  };


  defaultTools.forEach(function(toolInfo) {
    var tool = protoTool.clone();
    tool.find('p').text(toolInfo.name);
    tool.find('img').attr('src', toolInfo.icon);
    tool.appendTo(toolbar);
    tool.click(function() { addInstanceFromTool(toolInfo); return false; });
  });

  instanceCaps.forEach(addInstanceFromStorage);
};


$(function() {
  topDiv = $('#aux div').eq(0);

  var tunnel = new CapTunnel(window.belayPort);
  tunnel.setOutpostHandler(function(outpost) {
    instanceInfo = capServer.dataPostProcess(outpost).info;
    var instancesCap = instanceInfo.instances;
    instancesCap.get(initialize, function(err) { alert(err.message); });
  });
});
