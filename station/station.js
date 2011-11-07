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
var ui;
var instanceInfo;
var capServer;
var belayBrowserTunnel;
var belayBrowser;
var belaySuggestInst;
var belayRemoveSuggestInst;

var defaultIcon = '/tool.png';

//
// Desk top area
//
var showItems = function() { }; // reset in setupLayout
var showDesk = function() { }; // reset in setupLayout

var setupLayout = function() {
  var deskSizes = {
    small: 350,
    medium: 650,
    large: 1200
  };

  var controls = $('#belay-controls');
  var toolbar = $('#belay-toolbar');
  var items = $('#belay-items');
  var desk = $('#belay-desk');

  for (var p in deskSizes) {
    var tool = $('<span></span>').text(p);
    tool.click((function(s) {
        return function() { desk.height(s); };
      })(deskSizes[p]));
    controls.append(tool);
  }

  var itemsMaxHeight = items.css('maxHeight');

  var visible = function(n) { return n.css('display') != 'none'; };

  showItems = function() { items.slideDown(); };
  showDesk = function() {
    if (! visible(desk)) {
      desk.slideDown();
      if (items.css('maxHeight') == 'none')
        items.css('maxHeight', items.height());
      items.animate({ maxHeight: itemsMaxHeight });
    }
  };

  var hideItems = function() {
    items.slideUp();
    showDesk();
  };
  var hideDesk = function() {
    desk.slideUp();
    if (visible(items)) {
      items.animate({ maxHeight: items.height() + desk.height() },
        function() {
          items.css('maxHeight', 'none');
        });
    }
    else {
      items.css('maxHeight', 'none');
      showItems();
    }
  };

  var toggle = function(node, shower, hider) {
    if (visible(node)) hider(); else shower();
  };

  $('#belay-nav-toolbar').click(function() { toolbar.slideToggle(); });
  $('#belay-nav-items').click(function() {
      toggle(items, showItems, hideItems); });
  $('#belay-nav-desk').click(function() {
      toggle(desk, showDesk, hideDesk); });
};


var nextLeft = 100;
var nextTop = 50;


//
// Instance Data
//
var instances = {};
/*
  a map from instanceIds to
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
       created: Int      -- time created (seconds since epoch)
       name: string,
       icon: url,
       opened: string, -- 'page', 'gadget', or 'closed'
       window: {     -- info on gadget location
         top: int, left: int, width: int, height: int,
       },
       data: string  -- stored data for the instance
     },
     capServer: caps -- the cap server for this instance (if !state.remote)
     windowedInstance: bool -- if true, in a window (route via extension)

     rowNode: node -- node in the item list
     pageWindow: window -- if open in page view, the window it is in
     gadgetNode: node -- if open in gadget view, the container node it is in
     closeCap : cap -- present for windowed instances
   }
*/

var dirtyInstances = [];
var dirtyProcess = function() {
  var inst;
  while (!inst) {
    if (dirtyInstances.length <= 0) { return; }
    var instanceId = dirtyInstances.shift();
    inst = instances[instanceId];
  }
  inst.storageCap.post(inst.state, dirtyProcess);
};
var dirty = function(inst) {
  var instanceId = inst.state.id;
  if (dirtyInstances.indexOf(instanceId) >= 0) return;
  dirtyInstances.push(instanceId);
  if (dirtyInstances.length === 1)
    setTimeout(dirtyProcess, 1000);
};
var ensureSync = function(inst, k) {
  var ix = dirtyInstances.indexOf(inst.state.id);
  if (ix == -1) { k(); }
  else {
    dirtyInstances.splice(ix, 1);
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
  if (instances[id] && instances[id].windowedInstance &&
      instances[id].opened !== 'closed') {
    return belayBrowserTunnel.sendInterface;
  }
  if (id === capServer.instanceId) {
    return capServer.publicInterface;
  }
  return belayBrowserTunnel.sendInterface;
};


var setupCapServer = function(inst) {
  var capServer;
  capServer = new CapServer(inst.state.id);
  inst.capServer = capServer;
  capServer.setResolver(instanceResolver);
  capServer.setSyncNotifier(function() { dirty(inst); });
};

var desk = undefined;
var protoContainer = undefined;


var topGadget = function(inst) {
  var g = inst.gadgetNode;
  if (!g) return;

  showDesk();

  var gs = $.makeArray(desk.find('.belay-container'));
  gs.sort(function(a, b) { return a.style.zIndex - b.style.zIndex });
  $.each(gs, function(i, d) { d.style.zIndex = i; });
  g[0].style.zIndex = gs.length;
};


var closeGadgetInstance = function(inst) {
  if (inst.gadgetNode) {
    var g = inst.gadgetNode;
    g.hide('slow', function() { g.remove(); });
    inst.gadgetNode = undefined;
    inst.state.opened = 'closed';
    dirty(inst);
  }
};


var launchGadgetInstance = function(inst) {
  if (inst.gadgetNode) return;
  if (inst.pageWindow) {
    inst.closeCap.put();
  }
  if (!inst.capServer) setupCapServer(inst);

  var instState = inst.state;

  if (!('window' in instState)) {
    instState.window = { top: nextTop += 10, left: nextLeft += 20};
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
    // windowed instances require onBelayReady; gadgets also have it for
    // uniformity
    onBelayReady: function(callback) { callback(); },
    belay: { 
      outpost: {
        info: inst.launch.info
      } 
    },
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
      capDraggable: common.makeCapDraggable(inst.capServer),
      capDroppable: common.makeCapDroppable(inst.capServer)
    }
  };

  container.draggable({
    containment: desk,
    cursor: 'crosshair',
    handle: container.find('.belay-container-header'),
    stack: '.belay-container',
    stop: function(ev, ui) {
      instState.window.left = container.css('left');
      instState.window.top = container.css('top');
      dirty(inst);
    }
  });
  container.click(function() { topGadget(inst); });

  header.append('<div class="belay-control">×</div>');
  var closeBox = header.find(':last-child');
  closeBox.click(function() { closeGadgetInstance(inst); });
  closeBox.hover(function() { closeBox.addClass('hover'); },
                 function() { closeBox.removeClass('hover'); });

  if ('page' in inst.launch) {
    header.append('<div class="belay-control">↑</div>');
    var maxBox = header.find(':last-child');
    maxBox.click(function() { launchPageInstance(inst, belayLaunch); });
    maxBox.hover(function() { maxBox.addClass('hover'); },
                 function() { maxBox.removeClass('hover'); });
  }

  inst.gadgetNode = container;
  inst.state.opened = 'gadget';
  dirty(inst);

  topDiv.load(inst.launch.gadget.html, function() {
    topGadget(inst);
    foop(inst.launch.gadget.scripts, extras);
  });
};

var launchPageInstance = function(inst, launchCap) {
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

  inst.capServer = undefined;
  inst.windowedInstance = true;

  launchCap.post({
    instanceId: inst.state.id,
    url: inst.launch.page.html,
    height: inst.launch.page.window.height,
    width: inst.launch.page.window.width,
    outpostData: {
      info: inst.launch.info,
      instanceId: inst.state.id,
      services: belayBrowser,
    }
  },
  function(closeCap) {
    inst.closeCap = closeCap;
  },
  function(error) {
    console.assert(false);
  });
};

var launchInstance = function(inst, openType, launchCap) {
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
      if (instState.opened === 'page') {
        openType = 'none';
      }
      else {
        openType = ('opened' in instState) ? instState.opened : preferred;
      }
    }
    else if (openType == 'openAny') {
      openType = preferred;
    }

    if (openType == 'closed' || openType == 'none') {
      // leave closed!
    }
    else if (openType == 'page' && canPage) {
      launchPageInstance(inst, launchCap);
    }
    else if (openType == 'gadget' && canGadget) {
      launchGadgetInstance(inst);
    }
    else {
      alert('launchInstance: this instance cannot open as a ' + openType);
    }
  });
};


var protoItemRow; // TODO(jpolitz): factor this differently?
var itemsTable;
var addInstance = function(inst, openType, launchCap) {
  instances[inst.state.id] = inst;

  var row = protoItemRow.clone();
  inst.rowNode = row;

  row.click(function() { topGadget(inst); });
  row.find('td.icon img').attr('src', inst.state.icon || defaultIcon);
  row.find('td.name').text(inst.state.name || 'an item');
  row.find('td.actions .open-page').click(function() {
      launchInstance(inst, 'page', belayLaunch);
    });
  row.find('td.actions .open-gadget').click(function() {
      launchInstance(inst, 'gadget');
    });
  row.find('td.actions .remove').click(function() {
      removeInstance(inst);
    });
  row.hover(
    function() {
      if (inst.gadgetNode) inst.gadgetNode.addClass('belay-hilite');
    },
    function() {
      if (inst.gadgetNode) inst.gadgetNode.removeClass('belay-hilite');
    });
  row.prependTo(itemsTable);
  showItems();

  launchInstance(inst, openType, launchCap);

  belaySuggestInst.put({
    id: inst.state.id,
    domain: inst.state.belayInstance.serialize().match('https?://[^/]*')[0],
    name: inst.state.name,
    launchClicked: capServer.grant(function(launch) {
      launchPageInstance(inst, launch);
    })
  });
};

var removeInstance = function(inst) {
  closeGadgetInstance(inst);
  if (inst.pageWindow) {
    inst.closeCap.put();
  }
  inst.rowNode.fadeOut(function() { inst.rowNode.remove(); });
  if (inst.capServer) inst.capServer.revokeAll();
  delete instances[inst.state.id];
  inst.storageCap.remove();
  belayRemoveSuggestInst.put({
    id: inst.state.id,
    domain: inst.state.belayInstance.serialize().match('https?://[^/]*')[0]
  });
};

var initialize = function(instanceCaps, defaultTools) {
  var top = topDiv;
  var toolbar = top.find('#belay-toolbar');
  desk = top.find('#belay-desk');

  var protoTool = toolbar.find('.belay-tool').eq(0).detach();
  toolbar.find('.belay-tool').remove(); // remove the rest

  protoContainer = desk.find('.belay-container').eq(0).detach();
  desk.find('.belay-container').remove(); // remove the rest


  setupLayout(top);


  var itemsDiv = topDiv.find('#belay-items');
  itemsTable = itemsDiv.find('table');
  protoItemRow = itemsTable.find('tr').eq(0).detach();
  itemsTable.find('tr').remove();


  // TODO(mzero): refactor the two addInstance functions and the newInstHandler
  var addInstanceFromGenerate = function(genCap) {
    genCap.get(function(data) {
        var newID = newUUIDv4();
        var inst = {
          storageCap: capServer.grant(instanceInfo.instanceBase + newID),
            // TODO(arjun) still a hack. Should we be concatenaing URLs here?
          state: {
            id: newID,
            belayInstance: data.launch,
            name: data.name,
            icon: data.icon,
            info: undefined,
            created: (new Date()).valueOf()
          }
        };
        addInstance(inst, 'openAny', belayLaunch);
        dirty(inst);
      },
      function(error) {
        alert('Failed to addInstanceFromGenerate, error = ' + error);
      }
    );
  };
  ui.capDroppable(itemsDiv, 'belay/generate', addInstanceFromGenerate);
  ui.capDroppable(desk, 'belay/generate', addInstanceFromGenerate);

  var addInstanceFromTool = function(toolInfo) {
    toolInfo.generate.get(function(data) {
        var newID = newUUIDv4();
        var inst = {
          storageCap: capServer.grant(instanceInfo.instanceBase + newID),
            // TODO(arjun) still a hack. Should we be concatenaing URLs here?
          state: {
            id: newID,
            belayInstance: data,
            name: 'an instance of ' + toolInfo.name,
            icon: toolInfo.icon,
            info: undefined,
            created: (new Date()).valueOf()
          }
        };
        addInstance(inst, 'openAny', belayLaunch);
        dirty(inst);
      },
      function(error) {
        alert('Failed to createNewInstanceFromTool ' +
          toolInfo.name + ', error = ' + error);
      }
    );
  };

  var loadedInstances = [];

  var loadInsts = function() {
    var cmpInstByCreated = function(inst1, inst2) {
      return inst1.state.created - inst2.state.created;
    };
    loadedInstances.sort(cmpInstByCreated).forEach(function(inst) {
      addInstance(inst, 'restore', belayLaunch);
    });
  };

  var addInstanceFromStorage = function(storageCap) {
    storageCap.get(function(instState) {
        var inst = {
          storageCap: storageCap,
          state: instState
        };
        loadedInstances.push(inst);
        if (loadedInstances.length === instanceCaps.length) {
          loadInsts();
        }
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

// Called by Belay (the extension) when a user visits a Web page, P, that wants
// to morph into an instance. The supplied launch cap has the same signature
// as belayLaunch. Instead of creating a new tab, it reloads P's tab.
var newInstHandler = function(args) {
  var instanceId = newUUIDv4();
  var inst = {
    storageCap: capServer.grant(instanceInfo.instanceBase + instanceId),
    // TODO(arjun) still a hack. Should we be concatenaing URLs here?
    state: {
      id: instanceId,
      belayInstance: args.launchData.launch,
      name: args.launchData.name,
      icon: args.launchData.icon,
      created: (new Date()).valueOf()
    }
  };
  addInstance(inst, 'page', args.relaunch);
};

var closeInstHandler = function(instanceId) {
  if (!(instanceId in instances)) return;

  var inst = instances[instanceId];
  if (inst.pageWindow) {
    inst.pageWindow = undefined;
    inst.state.opened = 'closed';
    dirty(inst);
  }
};

window.belay.portReady = function() {
  topDiv = $('#aux div').eq(0);

  belayBrowserTunnel = new CapTunnel(window.belay.port);
  belayBrowserTunnel.setLocalResolver(instanceResolver);
  belayBrowserTunnel.setOutpostHandler(function(outpost) {
    var radishServer = new CapServer('radish');
    var initData = radishServer.dataPostProcess(outpost);
    capServer = new CapServer(initData.instanceId);
    capServer.setResolver(instanceResolver);

    outpost = capServer.dataPostProcess(outpost);
    belayLaunch = outpost.launch;
    belayBrowser = outpost.services;
    belaySuggestInst = outpost.suggestInst;
    belayRemoveSuggestInst = outpost.removeSuggestInst;
    instanceInfo = outpost.info;
    var instancesCap = instanceInfo.instances;
    instancesCap.get(function(instances) {
      initialize(instances, outpost.info.defaultTools);
    }, function(err) { alert(err.message); });
    outpost.setStationCallbacks.put({
      newInstHandler: capServer.grant(newInstHandler),
      closeInstHandler: capServer.grant(closeInstHandler)
    });
    ui = {
      resize: function() { /* do nothing in page mode */ },
      capDraggable: common.makeCapDraggable(capServer, function() {}),
      capDroppable: common.makeCapDroppable(capServer, function() {})
    };
  });
};
