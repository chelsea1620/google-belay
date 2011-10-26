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

function detachProto(elem) {
  var proto = elem.eq(0).detach();
  proto.removeClass('proto');
  return proto;
}

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


var launchPageInstance = function(inst, launcher) {
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

  launcher.post({
    instID: inst.state.id, // TODO(iainmcgin): remove
    instanceId: inst.state.id,
    url: inst.launch.page.html, // TODO(iainmcgin): remove
    pageUrl: inst.launch.page.html,
    height: inst.launch.page.window.height,
    width: inst.launch.page.window.width,
    outpostData: {
      info: inst.launch.info,
      instanceID: inst.state.id, // TODO(iainmcgin): remove
      instanceId: inst.state.id,
      services: belayBrowser,
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

var launchInstance = function(inst, openType, launcher) {
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
      launchPageInstance(inst, launcher);
    }
    else if (openType === 'gadget') {
      // ignore
    }
    else {
      alert('launchInstance: this instance cannot open as a ' + openType);
    }
  });
};

var addSuggestion = function(inst) {
  belaySuggestInst.put({
    instID: inst.state.id,
    domain: domainOfInst(inst),
    name: inst.state.name,
    doLaunch: capServer.grant(function(activate) {
      launchPageInstance(inst, activate);
    })
  });
};

var protoItemRow; // TODO(jpolitz): factor this differently?
var addInstance = function(inst) {
  instances[inst.state.id] = inst;
  sections.newInstance(inst);
  addSuggestion(inst);
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
  defaultName: 'Uncategorized',
  names: ['Uncategorized', 'Personal', 'Shopping', 'Games', 'Work'],
  // Map<Name, { label: jQuery, list: jQuery, insts: inst }>
  byName: Object.create(null),
  sitesLabel: null, // jQuery
  visible: [],
  ready: false,
  instToAdd: [],

  init: function(sectionCap) {
    sections.sitesLabel = $('#nav .selected').eq(0).removeClass('proto');
    sections.sitesLabel.click(sections.showSites);

    var fetched = [];
    function addNextSection(names) {
      if (names.length) {
        var name = names.shift();
        sectionCap.post(name, function(sectionInfo) {
          fetched.push({name: name, sectionInfo: sectionInfo});
          addNextSection(names);
        });
      }
      else {
        for (var i in fetched) {
          sections.add(fetched[i].name, fetched[i].sectionInfo);
        }
        sections.showSites();
        sections.ready = true;
        sections.instToAdd.forEach(sections.newInstance);
      }
    }

    addNextSection(sections.names);
  },
  add: function(name, sectionInfo) {
    var label = $('<li></li>');
    label.text(name);
    label.addClass('group');
    $('#nav').append(label);


    var makeDroppable = function(elt) {
      elt.droppable({
        tolerance: 'pointer',
        over: function(evt) {
          elt.addClass('dropHover');
        },
        out: function(evt) {
          elt.removeClass('dropHover');
        },
        drop: function(evt, ui) {
          elt.removeClass('dropHover');
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
    };

    var section = sections.proto.clone();
    section.css('display', 'none');
    section.appendTo($('#belay-items'));
    label.click(function(evt) { sections.show(name); });
    makeDroppable(label);
    makeDroppable(section);


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
    if (!sections.ready) {
      sections.instToAdd.push(inst);
      return;
    }

    var startId = newUUIDv4();

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

    var openPageBtn = row.find('td.actions .open-page');
    openPageBtn.attr('href', 'redirect.html');
    openPageBtn.attr('target', startId);
    openPageBtn.click(function(evt) {
      if (inst.state.opened !== 'closed') {
        evt.preventDefault(); // do not re-open the window
      }
    });

    expectPage.post({
      startId: startId,
      ready: capServer.grant(function(activate) {
        launchPageInstance(inst, activate);
      })
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
    if (!(inst.state.section in sections.byName)) {
      inst.state.section = sections.defaultName;
      dirty(inst);
    }
    var list = sections.byName[inst.state.section].list;
    row.prependTo(list.find('table.items').eq(0));
  }
};

var attributes = (function() {
  // list of attributes we support

  var FixedAttribute = function(value) { this.fixed = value; };
  FixedAttribute.prototype = {
    build: function(td, setter) {
      var span = $('<span></span>');
      span.text(this.fixed);
      td.empty();
      td.append(span);
    },
    value: function(td, value) {
      return this.fixed;
    },
    focus: function(td) {
    }
  };

  var TextAttribute = function() { };
  TextAttribute.prototype = {
    build: function(td, setter) {
      var input = $('<input />');
      input.change(function() {
        setter(input.val().trim());
      });
      td.empty();
      td.append(input);
    },
    value: function(td, value) {
      td.find('input').val(value);
      return value;
    },
    focus: function(td) {
      td.find('input').focus();
    }
  };

  var ChoiceAttribute = function(choices) { this.choices = choices; };
  ChoiceAttribute.prototype = {
    build: function(td, setter) {
      var select = $('<select></select>');
      select.addClass('button');
      this.choices.forEach(function(choice) {
        var option = $('<option></option>');
        option.attr('value', choice);
        option.text(choice);
        select.append(option);
      });
      select.change(function() {
        setter(select.val());
      });
      td.empty();
      td.append(select);
    },
    value: function(td, value) {
      td.find('select').val(value);
      return td.find('select').val();
    },
    focus: function(td) {
      td.find('select').focus();
    }
  };

  var MultiChoiceAttribute = function(choices) { this.choices = choices; };
  MultiChoiceAttribute.prototype = {
    build: function(td, setter) {
      td.empty();
      this.choices.forEach(function(choice) {
        var option = $('<input type="checkbox"/>');
        option.attr('name', choice);
        option.attr('value', choice);
        option.change(function() {
          var nv = [];
          td.find('input').each(function(i, elem) {
            var input = $(elem);
            if (input.attr('checked')) {
              nv.push(input.attr('name'));
            }
          });
          setter(nv.join(','));
        });
        var span = $('<span></span>');
        span.text(choice);
        span.prepend(option);
        td.append(span);
      });
    },
    value: function(td, value) {
      // TODO(mzero): should really split value on ',' to be safe
      value = value || '';
      var nv = [];
      td.find('input').each(function(i, elem) {
        var input = $(elem);
        var name = input.attr('name');
        if (value.indexOf(name) >= 0) {
          input.attr('checked', 'checked');
          nv.push(name);
        }
        else {
          input.removeAttr('checked');
        }
      });
      return nv.join(',');
    },
    focus: function(td) {
    }
  };

  var knownAttributes = [
    { attr: 'name', en: 'Name', controller: new ChoiceAttribute(
      ['Betsy Ross', 'Betsy Asburn', 'Betsy Claypool', 'Bee Girl']) },
    { attr: 'location', en: 'Location', controller: new ChoiceAttribute(
      ['239 Arch Street, Philadelphia, Pennsylvania',
       'Philadelphia, Pennsylvania',
       'Pennsylvania',
       'USA']) },
    { attr: 'email', en: 'Email', controller: new ChoiceAttribute(
      ['besty@ross-upholstery.com', 'betsy@ralvery.com']
      ) },
    { attr: 'gender', en: 'Gender', controller: new FixedAttribute('Female') },
    { attr: 'age', en: 'Age', controller: new FixedAttribute('34') }
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
        var protoRow = detachProto(attributesTable.find('tr'));

        sectionElem.find('.header .name').text(name);

        attributesTable.find('tr').remove();
        knownAttributes.forEach(function(a) {
          var row = protoRow.clone();
          row.find('.include input').removeAttr('checked');
          row.find('.tag').text(a.en);
          a.controller.build(row.find('.value'), function(v) {
            editData[a.attr] = v;
          });
          row.appendTo(attributesTable);
        });

        function resetAttributes(editable) {
          editData = { };

          attributesTable.find('tr').each(function(i, tr) {
            var a = knownAttributes[i];
            var row = $(tr);

            var includeInput = row.find('.include input');
            var valueTD = row.find('.value');

            function enable() {
              editData[a.attr] = a.controller.value(valueTD, data[a.attr]);
              includeInput.attr('checked', 'checked');
              valueTD.children().show();
            }
            function disable() {
              delete editData[a.attr];
              includeInput.removeAttr('checked');
              valueTD.children().hide();
              valueTD.click(function() {
                valueTD.unbind();
                enable();
                a.controller.focus(valueTD);
              });
            }
            function able(bool) { bool ? enable() : disable(); }

            able(a.attr in data);

            includeInput.change(function() {
              able(includeInput.attr('checked'));
            });
          });
        }
        function showAttributes() {
          if (attributesElem.css('display') !== 'none') return;

          resetAttributes();
          attributesDiv.hide();
          attributesElem.show();
          attributesDiv.slideDown();
        }
        function hideAttributes() {
          attributesDiv.slideUp(function() { attributesElem.hide(); });
        }
        function saveAttributes() {
          sections.byName[name].attributes = data = editData;
          console.log('data saved:', data);
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
    }
  };
})();

var initialize = function(instanceCaps, defaultTools) {
  var top = topDiv;

  $(document.body).find('.ex').remove(); // remove layout examples

  var itemsDiv = topDiv.find('#belay-items');

  sections.proto = detachProto(topDiv.find('.section'));
  protoItemRow = detachProto(sections.proto.find('table.items tr'));

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
        addInstance(inst);
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
      addInstance(inst);
    });
  };

  var addInstanceFromStorage = function(storageCap) {
    storageCap.get(function(instState) {
        var inst = {
          storageCap: storageCap,
          state: instState
        };
        inst.state.opened = 'closed';
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
      belayInstance: args.instanceDescription.launch,
      name: args.instanceDescription.name,
      icon: args.instanceDescription.icon,
      created: (new Date()).valueOf(),
      section: sections.defaultName
    }
  };
  addInstance(inst);
  launchInstance(inst, 'page', args.activate);
};

var closeInstHandler = function(instID) {
  if (!(instID in instances)) return;

  var inst = instances[instID];
  if (inst.pageWindow) {
    inst.pageWindow = undefined;
    inst.state.opened = 'closed';
    dirty(inst);
  }

  // Re-prime the link for launching.
  var newStartId = newUUIDv4();
  inst.rows[0].find('td.actions .open-page').attr('target', newStartId);
  expectPage.post({
    startId: newStartId,
    ready: capServer.grant(function(activate) {
      launchPageInstance(inst, activate);
    })
  });

  // Instace closed, so let it re-appear as a suggestion
  addSuggestion(inst);
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
    expectPage = outpost.expectPage;
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
      capDraggable: common.makeCapDraggable(capServer, function() {}),
      capDroppable: common.makeCapDroppable(capServer, function() {})
    };
  });
};
