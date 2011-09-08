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

function domainOfInst(inst) {
  return inst.state.belayInstance.serialize().match('https?://[^/]*')[0];
}

//
// Instance Data
//
var instances = Object.create(null);
/*
  a map from instanceIDs to
   {
     storageCap: cap,-- where station stores instance state (see next member)
     state: {
       id: uuid,
       belayInstance: cap(belay/instance),
       capSnapshot: string,
       created: Int      -- time created (seconds since epoch)
       name: string,
       icon: url,
       opened: string, -- 'page', 'gadget', or 'closed'
       window: {     -- info on gadget location
         top: int, left: int, width: int, height: int,
       },
       data: string  -- stored data for the instance
       section: string -- the section the instance belongs to
     },
     launch: {
        page: { html: url, window: { width: int, height: int } },
        gadget: { html: url, scripts: [url] },
        info: any
        attributes: { set: cap }
     },
     delayedLaunchHash : UUID
     capServer: caps -- the cap server for this instance (if !state.remote)
     windowedInstance: bool -- if true, in a window (route via extension)
     rows: [node] -- nodes in the item list
     pageWindow: window -- if open in page view, the window it is in
     gadgetNode: node -- if open in gadget view, the container node it is in
     closeCap : cap -- present for windowed instances
   }
*/

var cmpInstByCreated = function(inst1, inst2) {
  return inst1.state.created - inst2.state.created;
};

function recentInstances(instances, numRecent) {
  
}

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
      }),
      setRefresh: capServer.grant(function(refreshCap) {
        inst.refreshCap = refreshCap;
      })
    }
  },
  function(closeCap) {
    // Instance opened, so do not show it as a suggestion
    belayRemoveSuggestInst.put({
      instID: inst.state.id,
      domain: domainOfInst(inst)
    });
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
    attributes.pushToInstance(inst);
    var canPage = 'page' in launch;

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
var addInstance = function(inst, openType, launchCap) {
  instances[inst.state.id] = inst;

  sections.newInstance(inst);

  launchInstance(inst, openType, launchCap);

  belaySuggestInst.put({
    instID: inst.state.id,
    domain: domainOfInst(inst),
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
  sections.deleteInstance(inst);
  if (inst.capServer) inst.capServer.revokeAll();
  delete instances[inst.state.id];
  inst.storageCap.remove();
  belayRemoveSuggestInst.put({
    instID: inst.state.id,
    domain: domainOfInst(inst)
  });
};


var sections = {
  proto: null,
  names: [ 'Recent', 'News and Blogs', 'Forums and Discussions' ],
  // Map<Name, { label: jQuery, list: jQuery, insts: inst }>
  byName: Object.create(null),
  sitesLabel: null, // jQuery
  visible: [],
  
  init: function(sectionCap) {
    sections.sitesLabel = $('#nav .selected').eq(0);
    sections.sitesLabel.click(sections.showSites);

    sections.names.forEach(function(name) {
      sectionCap.post(name, function(sectionInfo) {
        sections.add(name, sectionInfo);
        if (name == 'Recent') {
          sections.show(name);
        }
      });
    })
  },
  add: function(name, sectionInfo) {
    var label = $('<li>' + name + '</li>'); // todo: XSS
    $('#nav').append(label);

    var section = sections.proto.clone();
    section.css('display', 'none');
    section.appendTo($('#belay-items'));
      
    label.click(function(evt) { sections.show(name); });
    label.droppable({ 
      tolerance: 'pointer',
      drop: function(evt, ui) {
        var row = ui.draggable;
        var inst = row.data('belay-inst');
        inst.state.section = name;
        row.detach();
        section.find('table.items').eq(0).prepend(row);
        dirty(inst);
        attributes.pushToInstance(inst);
      },
      accept: function(elt) { return !!elt.data('belay-inst'); }
    });

    sections.byName[name] = {
      label: label,
      list: section,
      attributes: { }
    };
    
    attributes.setup(name, section, sectionInfo.attributes);
  },
  showSites: function() {
    sections.sitesLabel.addClass('selected');
    // all visible, except for Recent
    sections.visible = 
      Object.keys(sections.byName)
      .map(function(k) { 
        var sec = sections.byName[k];
        sec.label.removeClass('selected');
        sec.list.show();
        return sec;
      });
  },
  show: function(name) {
    var v = sections.byName[name];
    sections.sitesLabel.removeClass('selected');
    v.label.addClass('selected');
    v.list.show();
    sections.visible.forEach(function(sec) { 
      if (sec !== v) {
        sec.label.removeClass('selected');
        sec.list.hide();
      }
    });
    sections.visible = [v];
  },
  deleteInstance: function(inst) {
    inst.rows.forEach(function(row) { 
      row.fadeOut(400, function() { row.remove(); });
    });
    inst.rows = [];
  },
  newInstance: function(inst) {
    var delayedLaunchUUID = '#' + newUUIDv4();
    var delayedLaunchURL = 'redirect.html' + delayedLaunchUUID;
    inst.delayedLaunchHash = delayedLaunchUUID;

    var row = protoItemRow.clone();

    var icon = row.find('td.icon img');
    icon.attr('src', inst.state.icon || defaultIcon);
    row.find('td.name').text(inst.state.name || 'an item');
    row.find('td.actions .open-gadget').click(function() {
        launchInstance(inst, 'gadget');
      });
    row.find('td.actions .remove').click(function() {
        removeInstance(inst);
      });
    
    setDelayedLaunch.post(delayedLaunchUUID, function() {
      var openPageBtn = row.find('td.actions .open-page');
      openPageBtn.attr('href', delayedLaunchURL);
      openPageBtn.click(function(evt) {
        if (inst.state.opened !== 'closed' || !delayed.newDelayed(inst)) {
          evt.preventDefault(); // do not re-open the window 
        }
      });
    });
   
    row.draggable({ 
      handle: icon, 
      revert: 'invalid',
      helper: function() {
        var cl = row.clone();
        cl.css('width', row.width());
        cl.css('background-color', 'white');
        return cl;
      }, 
      cursor: 'pointer' 
    });
    row.data('belay-inst', inst);

    inst.rows = [row];
    var list = sections.byName[inst.state.section].list;

    row.prependTo(list.find('table.items').eq(0));
  }
}

var attributes = (function() {
  // list of attributes we support
  var knownAttributes = [
    { attr: 'name', en: 'Name' },
    { attr: 'nick', en: 'Nickname' },
    { attr: 'location', en: 'Location' },
    { attr: 'email', en: 'Email' },
    { attr: 'phone', en: 'Phone' },
    { attr: 'gender', en: 'Gender' },
    { attr: 'age', en: 'Age' },
  ];
  
  return {
    setup: function(name, sectionElem, attributesCap) {
      attributesCap.get(function(data) {
        sections.byName[name].attributes = data;
        
        var editData;

        var headerElem = sectionElem.find('.header');
        var attributesElem = sectionElem.find('.attributes');
        var attributesDiv = attributesElem.find('.box');
        var attributesTable = attributesDiv.find('table');
        var protoRow = attributesTable.find('tr').eq(0).detach();
  
        sectionElem.find('.header .name').text(name);

        attributesTable.find('tr').remove();
        knownAttributes.forEach(function(a) {
          var row = protoRow.clone();
          row.find('.include input').removeAttr('checked');
          row.find('.tag').text(a.en);
          row.find('.value').text('');
          row.appendTo(attributesTable);
        });

        function resetAttributes(editable) {
          editData = { };
  
          attributesTable.find('tr').each(function(i, tr) {
            var a = knownAttributes[i];
            var row = $(tr);
    
            var includeInput = row.find('.include input');
            var valueTD = row.find('.value');
    
            valueTD.empty();
            if (a.attr in data) {
              var v = data[a.attr];
              editData[a.attr] = v;
              includeInput.attr('checked', 'checked');
              valueTD.text(v);
            }
            else {
              includeInput.removeAttr('checked');
              valueTD.text('');
            }
    
            if (editable) {
              valueTD.click(function() {
                valueTD.unbind();
                var input = $('<input />');
                input.val(editData[a.attr]);
                input.blur(function() {
                  var t = input.val().trim();
                  if (t === '') {
                    delete editData[a.attr];
                    includeInput.removeAttr('checked');
                  }
                  else {
                    editData[a.attr] = t;
                    includeInput.attr('checked', 'checked');
                  }
                });
                valueTD.empty();
                valueTD.append(input);
                input.focus();
              });
            }
          });
        }
        function showAttributes() {
          if (attributesElem.css('display') !== 'none') return;
  
          resetAttributes(true);
          attributesDiv.hide();
          attributesElem.show();
          attributesDiv.slideDown();
        }
        function hideAttributes() {
          resetAttributes(false);
          setTimeout(function() {
            attributesDiv.slideUp(function() { attributesElem.hide(); });
          }, 300);
        }
        function saveAttributes() {
          sections.byName[name].attributes = data = editData;
          attributesCap.put(data, hideAttributes);
          
          Object.keys(instances).forEach(function(instID) {
            var inst = instances[instID];
            if (inst.state.section === name) {
              attributes.pushToInstance(inst);
            }
          });
        }
        function cancelAttributes() {
          hideAttributes();
        }        
  
        headerElem.find('.settings').click(showAttributes);
        attributesDiv.find('.save').click(saveAttributes);
        attributesDiv.find('.cancel').click(cancelAttributes);
      });
    },
    
    pushToInstance: function(inst) {
      if (inst.launch.attributes && inst.launch.attributes.set) {
        var data = sections.byName[inst.state.section].attributes;
        inst.launch.attributes.set.put(data, function() {
          if (inst.refreshCap) {
            inst.refreshCap.post({});
          }
        });
      }
    },
  }
})();

var initialize = function(instanceCaps, defaultTools) {
  var top = topDiv;
  
  $(document.body).find('.ex').remove(); // remove layout examples

  var itemsDiv = topDiv.find('#belay-items');

  sections.proto = topDiv.find('.section').eq(0).detach();
  protoItemRow = sections.proto.find('table.items tr').eq(0).detach();

  sections.init(instanceInfo.section);

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

var delayed = {
  insts : Object.create(null), // Map<Hash, Info>
  // Called by Belay when a delayed window is ready. Should return launch
  // information to navigate to the actual instance.
  readyHandler: function(hash, sk, fk) {
    var inst = delayed.insts[hash];
    launchInstance(inst, 'page', capServer.grant(function(info, sk2, fk2) {
      delete (delayed.insts)[hash];
      sk(info); // return to worker
      sk2(true); // succeed locally
    }));
  },
  newDelayed: function(inst) {
    if (delayed.insts[inst.delayedLaunchHash]) {
      return false;
    }
    else {
      delayed.insts[inst.delayedLaunchHash] = inst;
      return true;
    }
  }
}

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
      created: (new Date()).valueOf(),
      section: 'Recent'
    },
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
    
  // Re-prime the delayed URL for launching.
  setDelayedLaunch.post(inst.delayedLaunchHash);

  // Instace closed, so let it re-appear as a suggestion
  belaySuggestInst.put({
    instID: inst.state.id,
    domain: domainOfInst(inst),
    name: inst.state.name,
    launchClicked: capServer.grant(function(launch) {
      launchPageInstance(inst, launch);
    })
  });
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
    setDelayedLaunch = outpost.setDelayedLaunch;
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
      closeInstHandler: capServer.grant(closeInstHandler),
      delayedReadyHandler: capServer.grant(delayed.readyHandler),
    });
    ui = {
      resize: function() { /* do nothing in page mode */ },
      capDraggable: common.makeCapDraggable(capServer, function() {}),
      capDroppable: common.makeCapDroppable(capServer, function() {})
    };
  });
};
