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

// used for selenium testing - ready is set to true when
// the station is fully initialised
if (!window.belaytest) {
  window.belaytest = {
    ready: false
  }
}

var topDiv;
var ui;
var stationInfo;
var capServer;
var belayBrowserTunnel;
var belayBrowser;

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
  a map from instanceIds to
   {
     storageCap: cap,-- where station stores instance state (see next member)
     state: {
       id: uuid,
       belayInstance: cap(belay/instance),
       created: Int      -- time created (seconds since epoch)
       name: string,
       icon: url,
       opened: boolean, -- whether the instance is open or not
       data: string  -- stored data for the instance
       section: string -- the section the instance belongs to
     },
     launch: {
        page: { html: url },
        info: any
        attributes: { set: cap }
     },
     capServer: caps -- the cap server for this instance (if !state.remote)
     rows: [node] -- nodes in the item list
     closeCap : cap -- present for windowed instances
   }
*/

var cmpInstByCreated = function(inst1, inst2) {
  return inst1.state.created - inst2.state.created;
};

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
  if (instances[id] && instances[id].state.opened) {
    return belayBrowserTunnel.sendInterface;
  }
  if (id === capServer.instanceId) {
    return capServer.publicInterface;
  }
  return belayBrowserTunnel.sendInterface;
};


var launchPageInstance = function(inst, launcher) {
  inst.state.opened = true;
  dirty(inst);

  inst.capServer = undefined;

  launcher.post({
    instanceId: inst.state.id,
    url: inst.launch.page.html, // TODO(iainmcgin): remove
    pageUrl: inst.launch.page.html,
    relaunch: capServer.grant(function(activate) {
      launchInstance(inst, 'relaunchpage', activate);
    }),
    outpostData: {
      info: inst.launch.info,
      instanceId: inst.state.id,
      services: belayBrowser,
      setRefresh: capServer.grant(function(refreshCap) {
        inst.refreshCap = refreshCap;
      }),
      notifyClose: capServer.grant(function() {
        closeInstHandler(inst.state.id);
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
      if (instState.opened) {
        openType = 'none';
      } else {
        openType = preferred;
      }
    }
    else if (openType == 'openAny') {
      openType = preferred;
    }

    if (openType == 'closed' || openType == 'none') {
      // leave closed!
    }
    else if (openType == 'page' && canPage) {
      if (instState.opened) return;
      launchPageInstance(inst, launcher);
    } else if (openType == 'relaunchpage' && canPage) {
      launchPageInstance(inst, launcher);
    }
    else {
      alert('launchInstance: this instance cannot open as a ' + openType);
    }
  });
};


var getSuggestions = function(location) {
  var suggestions = [];
  Object.keys(instances).forEach(function(instanceId) {
    var inst = instances[instanceId];
    if (domainOfInst(inst) == location && !inst.state.opened) {
      suggestions.push({
        name: inst.state.name,
        doLaunch: capServer.grant(function(activate) {
          launchInstance(inst, 'page', activate);
        })
      });
    }
  });
  return suggestions;
};

var addInstance = function(inst) {
  instances[inst.state.id] = inst;
  sections.newInstance(inst);
};

var removeInstance = function(inst) {
  if (inst.state.opened) {
    inst.closeCap.put();
  }
  sections.deleteInstance(inst);
  if (inst.capServer) inst.capServer.revokeAll();
  delete instances[inst.state.id];
  inst.storageCap.remove();
};


var sections = (function(){
  var proto = null;
  var protoItemRow = null;
  var defaultName = 'Uncategorized';
  // Map<Name, { label: jQuery, list: jQuery }>
  var byName = Object.create(null);
  var sitesLabel = null; // jQuery
  var visible = [];

  var Section = function(info) {
    var me = this;
    
    // from the server
    this.name = info.name;
    this.data = info.data;
    this.dataCap = info.dataCap;
    this.attributes = info.attributes;
    this.attributesCap = info.attributesCap;
    
    // page elements (jQuery objects);    
    this.label = $('<li></li>');
    this.label.text(this.name);
    this.label.addClass('group');
    this.label.click(function(evt) { show(me); });
    this.label.appendTo($('#nav'));

    this.list = proto.clone();
    this.list.css('display', 'none');
    this.list.attr('id', 'section-' + this.name);
      // TODO(iainmcgin): what if name has a space?
    this.list.find('.header .name').text(this.name);
    this.list.appendTo($('#belay-items'));

    function makeDroppable(elt) {
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
          inst.state.section = me.name;
          row.detach();
          me.list.find('table.items').eq(0).prepend(row);
          dirty(inst);
          attributes.pushToInstance(inst);
        },
        accept: function(elt) { return !!elt.data('belay-inst'); }
      });
    };
    makeDroppable(this.label);
    makeDroppable(this.list);

    byName[this.name] = this;

    if(this.name != "Trash") {
      attributes.setup(this);
    } else {
      this.list.find('.header .settings').remove();
    }
  };
  
  
  function init(allSections) {
    proto = detachProto(topDiv.find('.section'));
    protoItemRow = detachProto(proto.find('table.items tr'));

    sitesLabel = $('#nav .selected').eq(0).removeClass('proto');
    sitesLabel.click(showSites);

    allSections.forEach(function(sectionInfo) { new Section(sectionInfo); });
    
    showSites();
  }
  
  function showSites() {
    sitesLabel.addClass('selected');
    // all visible, except for Recent
    visible =
      Object.keys(byName)
      .map(function(k) {
        var sec = byName[k];
        sec.label.removeClass('selected');
        sec.list.show();
        return sec;
      });
  }
  
  function show(v) {
    sitesLabel.removeClass('selected');
    v.label.addClass('selected');
    v.list.show();
    visible.forEach(function(sec) {
      if (sec !== v) {
        sec.label.removeClass('selected');
        sec.list.hide();
      }
    });
    visible = [v];
  }
  
  function deleteInstance(inst) {
    inst.rows.forEach(function(row) {
      row.fadeOut(400, function() { row.remove(); });
    });
    inst.rows = [];
  }
  
  function newInstance(inst) {
    var startId = newUUIDv4();

    var row = protoItemRow.clone();

    var icon = row.find('td.icon img');
    icon.attr('src', inst.state.icon || defaultIcon);
    row.find('td.name').text(inst.state.name || 'an item');
    row.find('td.actions .remove').click(function() {
        removeInstance(inst);
      });

    var openPageBtn = row.find('td.actions .open-page');
    openPageBtn.attr('href', 'redirect.html');
    openPageBtn.attr('target', startId);
    openPageBtn.click(function(evt) {
      if (inst.state.opened) {
        evt.preventDefault(); // do not re-open the window
      }
    });

    expectPage.post({
      startId: startId,
      ready: capServer.grant(function(activate) {
        launchInstance(inst, 'page', activate);
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
    if (!(inst.state.section in byName)) {
      inst.state.section = defaultName;
      dirty(inst);
    }
    var list = byName[inst.state.section].list;
    row.prependTo(list.find('table.items').eq(0));
  }
  
  function forInstance(inst) {
    return byName[inst.state.section];
  }
  
  return {
    init: init,
    newInstance: newInstance,
    deleteInstance: deleteInstance,
    forInstance: forInstance,
  }
})();

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
    setup: function(section) {
      var data = section.attributes;
      var editData;
      
      var attributesElem = section.list.find('.attributes');
      var attributesDiv = attributesElem.find('.box');
      var attributesTable = attributesDiv.find('table');
      var protoRow = detachProto(attributesTable.find('tr'));

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
        if (attributesElem.css('display') !== 'none') {
          for (var k in data) { if (data[k] != editData[k]) return; }
          hideAttributes();
          return;
        };

        resetAttributes();
        attributesDiv.hide();
        attributesElem.show();
        attributesDiv.slideDown();
      }
      function hideAttributes() {
        attributesDiv.slideUp(function() { attributesElem.hide(); });
      }
      function saveAttributes() {
        section.attributes = data = editData;
        section.attributesCap.put(data, hideAttributes);

        for (var instanceId in instances) {
          var inst = instances[instanceId];
          if (inst.state.section === section.name) {
            attributes.pushToInstance(inst);
          }
        }
      }
      function cancelAttributes() {
        hideAttributes();
      }

      section.list.find('.header .settings').click(showAttributes);
      attributesDiv.find('.save').click(saveAttributes);
      attributesDiv.find('.cancel').click(cancelAttributes);
    },

    pushToInstance: function(inst) {
      if (inst.launch.attributes && inst.launch.attributes.set) {
        var data = sections.forInstance(inst).attributes;
        inst.launch.attributes.set.put(data, function() {
          if (inst.refreshCap) {
            inst.refreshCap.post({});
          }
        });
      }
    }
  };
})();

var initialize = function() {
  $(document.body).find('.ex').remove(); // remove layout examples

  sections.init(stationInfo.allSections);
  
  // TODO(mzero): refactor the two addInstance functions and the newInstHandler
  var addInstanceFromGenerate = function(genCap) {
    genCap.get(function(data) {
        var newId = newUUIDv4();
        var inst = {
          storageCap: capServer.grant(stationInfo.instanceBase + newId),
            // TODO(arjun) still a hack. Should we be concatenaing URLs here?
          state: {
            id: newId,
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

  var itemsDiv = topDiv.find('#belay-items');
  ui.capDroppable(itemsDiv, 'belay/generate', addInstanceFromGenerate);

  var loadedInstances = [];
  stationInfo.allInstances.forEach(function(i) {
    var inst = {
      storageCap: i.cap,
      state: i.data
    };
    inst.state.opened = false;
    loadedInstances.push(inst);
  });
  loadedInstances.sort(cmpInstByCreated).forEach(addInstance);
  
  window.belaytest.ready = true;
};

// Called by Belay (the extension) when a user visits a Web page, P, that wants
// to morph into an instance. The supplied launch cap has the same signature
// as belayLaunch. Instead of creating a new tab, it reloads P's tab.
var newInstHandler = function(args) {
  var instanceId = newUUIDv4();
  var inst = {
    storageCap: capServer.grant(stationInfo.instanceBase + instanceId),
    // TODO(arjun) still a hack. Should we be concatenaing URLs here?
    state: {
      id: instanceId,
      belayInstance: args.instanceDescription.launch,
      name: args.instanceDescription.name,
      icon: args.instanceDescription.icon,
      created: (new Date()).valueOf(),
    }
  };
  addInstance(inst);
  launchInstance(inst, 'page', args.activate);
};

var closeInstHandler = function(instanceId) {
  if (!(instanceId in instances)) return;

  var inst = instances[instanceId];
  if (inst.state.opened) {
    inst.state.opened = false;
    dirty(inst);
  }

  // Re-prime the link for launching.
  var newStartId = newUUIDv4();
  inst.rows[0].find('td.actions .open-page').attr('target', newStartId);
  expectPage.post({
    startId: newStartId,
    ready: capServer.grant(function(activate) {
      launchInstance(inst, 'page', activate);
    })
  });
};

window.belay.portReady = function() {
  topDiv = $('#aux div').eq(0);

  belayBrowserTunnel = new CapTunnel(window.belay.port);
  belayBrowserTunnel.setLocalResolver(instanceResolver);
  belayBrowserTunnel.setOutpostHandler(function(outpost) {
    capServer = new CapServer(outpost.instanceId);
    capServer.setResolver(instanceResolver);

    expectPage = outpost.expectPage;
    belayLaunch = outpost.launch;
    belayBrowser = outpost.services;
    stationInfo = outpost.info;
    outpost.setStationCallbacks.put({
      newInstHandler: capServer.grant(newInstHandler),
      closeInstHandler: capServer.grant(closeInstHandler),
      getSuggestions: capServer.grant(getSuggestions)
    });
    ui = {
      capDraggable: common.makeCapDraggable(capServer, function() {}),
      capDroppable: common.makeCapDroppable(capServer, function() {})
    };
    initialize();
  });
};
