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
  if (instances[id] && instances[id].windowedInstance &&
      instances[id].opened !== 'closed') {
    return belayBrowserTunnel.sendInterface;
  }
  if (id === capServer.instanceID) {
    return capServer.publicInterface;
  }
  return belayBrowserTunnel.sendInterface;
};


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
  capServer.setSyncNotifier(function() { dirty(inst); });
};


var launchPageInstance = function(inst, launchCap) {
  if (inst.pageWindow) return;
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
    instID: inst.state.id,
    url: inst.launch.page.html,
    height: inst.launch.page.window.height,
    width: inst.launch.page.window.width,
    outpostData: {
      info: inst.launch.info,
      instanceID: inst.state.id,
      initialSnapshot: inst.state.capSnapshot ? inst.state.capSnapshot : false,
      services: belayBrowser,
      storage: capServer.grant({
        get: function() { return inst.state.data; },
        put: function(d) {inst.state.data = d; dirty(inst); }
      }),
      snapshot: capServer.grant({
        get: function() { return inst.state.capSnapshot; },
        put: function(snap) { inst.state.capSnapshot = snap; dirty(inst); }
      })
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
    var canPage = 'page' in launch;

    var row = inst.rowNode;
    var asVis = function(b) { return b ? 'visible' : 'hidden'; }
    row.find('.open-page').css('visibility', asVis(canPage));

    var preferred = canPage ? 'page' : 'none';

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
  row.prependTo(itemsTable);

  launchInstance(inst, openType, launchCap);

  belaySuggestInst.put({
    instID: inst.state.id,
    domain: inst.state.belayInstance.serialize().match('https?://[^/]*')[0],
    name: inst.state.name,
    launchClicked: capServer.grant(function(launch) {
      launchPageInstance(inst, launch);
    })
  });
};

var removeInstance = function(inst) {
  if (inst.pageWindow) {
    inst.closeCap.put();
  }
  inst.rowNode.fadeOut(function() { inst.rowNode.remove(); });
  if (inst.capServer) inst.capServer.revokeAll();
  delete instances[inst.state.id];
  inst.storageCap.remove();
  belayRemoveSuggestInst.put({
    instID: inst.state.id,
    domain: inst.state.belayInstance.serialize().match('https?://[^/]*')[0]
  });
};

// list of attributes we support
var knownAttributes = [
  { attr: 'name', en: 'Name' },
  { attr: 'nick', en: 'Nickname' },
  { attr: 'loc', en: 'Location' },
  { attr: 'email', en: 'Email' },
  { attr: 'phone', en: 'Phone' },
  { attr: 'gender', en: 'Gender' },
  { attr: 'age', en: 'Age' },
];

var setupSection = function(sectionElem) {
  var headerElem = sectionElem.find('.header');
  var attributesElem = sectionElem.find('.attributes');
  var attributesDiv = attributesElem.find('div');
  headerElem.find('.settings').click(function() {
    if (attributesElem.css('display') === 'none') {
      attributesDiv.hide();
      attributesElem.show();
      attributesDiv.slideDown();
    }
    else {
      attributesDiv.slideUp(function() { attributesElem.hide(); });
    }
  });
  
  var data = {
    name: 'Mark Lentczner',
    nick: 'MtnViewMark',
    loc: '94041',
  };
  
  var attributesTable = attributesDiv.find('table');
  var protoRow = attributesTable.find('tr').eq(0).detach();
  knownAttributes.forEach(function(a) {
    var row = protoRow.clone();
    row.find('.tag').text(a.en);

    if (a.attr in data) {
      row.find('.include input').attr('checked', 'checked');
      row.find('.value').text(data[a.attr]);
    }
    else {
      row.find('.include input').removeAttr('checked');
      row.find('.value').text('');
    }
    
    row.appendTo(attributesTable);
  })
};

var initialize = function(instanceCaps, defaultTools) {
  var top = topDiv;
  
  top.find('.ex').remove(); // remove all the example layout on the page

  var itemsDiv = topDiv.find('#belay-items');
  itemsTable = itemsDiv.find('table.items');
  protoItemRow = itemsTable.find('tr').eq(0).detach();
  
  itemsDiv.find('.section').each(function() { setupSection($(this)); });

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

  instanceCaps.forEach(addInstanceFromStorage);
};

// Called by Belay (the extension) when a user visits a Web page, P, that wants
// to morph into an instance. The supplied launch cap has the same signature
// as belayLaunch. Instead of creating a new tab, it reloads P's tab.
var newInstHandler = function(args) {
  var instID = newUUIDv4();
  var inst = {
    storageCap: capServer.grant(instanceInfo.instanceBase + instID),
    // TODO(arjun) still a hack. Should we be concatenaing URLs here?
    state: {
      id: instID,
      belayInstance: args.launchData.launch,
      name: args.launchData.name,
      icon: args.launchData.icon,
      created: (new Date()).valueOf()
    }
  };
  addInstance(inst, 'page', args.relaunch);
};

var closeInstHandler = function(instID) {
  if (!(instID in instances)) return;

  var inst = instances[instID];
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
		capServer = new CapServer(initData.instanceID);
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
