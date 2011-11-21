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

"use strict";

// TODO(jasvir): These should be modules not scripts
require([
    "lib/js/include-belay.js", 
    "lib/js/caps.js", 
    "lib/js/common.js",
    "lib/js/belay-client.js"], 
  function () {

var topDiv;
var ui;
var stationInfo;
var capServer;
var belayBrowserTunnel;
var belayBrowser;
var dragData = {
  dragString: null,
  instanceId: null
};

var defaultIcon = '/res/images/tool.png';

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
     row: node -- the row representing the instance in the section list
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
    if (domainOfInst(inst) == location
        && !inst.state.opened
        && inst.state.section != "Trash") {
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
};


var sections = (function(){
  var protoSection = null;
  var protoItemRow = null;
  var protoNavSection = null;
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
    this.hidden = info.hidden;
    
    // page elements (jQuery objects);    
    this.label = protoNavSection.clone();
    this.label.text(this.name);
    this.label.click(function(evt) { show(me); });
    

    divider = $('#nav-sections .divider');
    if(this.hidden) {
      this.label.insertAfter(divider);
    } else {
      this.label.insertBefore(divider);
    }

    this.showingFullList = false;
    this.shortListSize = 5;
    this.list = protoSection.clone();
    this.list.css('display', 'none');
    this.list.attr('id', 'section-' + this.name);
      // TODO(iainmcgin): what if name has a space?
    this.list.find('.header .name').text(this.name);
    this.list.find('.header .show-all').click(function() { show(me) });
    this.list.appendTo($('#belay-items'));

    function makeDroppable(elt) {
      elt.bind('dragenter', function(evt) {
        elt.addClass('dropHover');

        evt.preventDefault();
        return false;
      });

      elt.bind('dragover', function(evt) {
        elt.addClass('dropHover');
        evt.originalEvent.dataTransfer.dropEffect = 'move';

        evt.preventDefault();
        return false;
      });

      elt.bind('dragend', function(evt) {
        elt.removeClass('dropHover');
      });

      elt.bind('dragleave', function(evt) {
        elt.removeClass('dropHover');

        evt.preventDefault();
        return false;
      });

      elt.bind('drop', function(evt) {
        var realEvt = evt.originalEvent;
        var content = realEvt.dataTransfer.getData('text/html');

        elt.removeClass('dropHover');

        var contentElem = $(content);
        var data = contentElem.filter('span[data]').attr('data') ||
          contentElem.find('span[data]').attr('data');

        if(dragData.dragString != data) {
          return true;
        }

        var instance = instances[dragData.instanceId];
        moveInstanceToSection(instance, me);
        evt.stopPropagation();
        return false;
      });
    };

    makeDroppable(this.label);
    makeDroppable(this.list);

    byName[this.name] = this;

    if(this.name != "Trash") {
      attributes.setup(this);
    } else {
      this.list.find('.header .settings').remove();

      // TODO(iainmcgin): the clear button should exist in a special
      // template for the trash section, not be injected into the actions list
      // as it is below.

      actionsGroup = this.list.find('.header .actions');
      deleteAll = $('<span>clear</span>')
      deleteAll.click(function() {
        for(instanceId in instances) {
          instance = instances[instanceId];
          if(instance.state.section == me.name) {
            removeInstance(instance);
          }
        }
      });
      actionsGroup.append(deleteAll);
    }

    this.showShortList = function() {
      me.showingFullList = false;
      me.list.show();
      me.list.find('.items tr:lt(' + me.shortListSize + ')').show();
      me.list.find('.items tr:gt(' + (me.shortListSize-1) + ')').hide();

      me.updateActionsBar();
    };

    this.showFullList = function() {
      me.showingFullList = true;
      me.list.show();
      itemRows = me.list.find('.items tr').show();
      me.list.find('.header .show-all').hide();
      me.updateActionsBar();
    };

    this.showList = function() {
      if(me.showingFullList) {
        me.showFullList();
      } else {
        me.showShortList();
      }
    }

    this.updateList = function() {
      if(me.list.css('display') == 'none') return;
      me.showList();
    }

    this.hideList = function() {
      me.list.hide();
    };

    this.addInstance = function(inst) {
      inst.state.section = me.name;
      inst.row.prependTo(me.list.find('table.items').eq(0));
      
      // the fade in is only visible after a delete from another section, 
      // not when explicitly dragging between sections
      inst.row.fadeIn(400);

      me.updateList();
    }

    this.removeInstance = function(inst) {
      inst.row.detach();
      me.updateList();
    }

    this.updateActionsBar = function() {
      var showAllElem = me.list.find('.header .actions .show-all');
      if(!me.showingFullList) {
        var totalItems = me.list.find('.items tr').size();
        var numExtra = totalItems - me.shortListSize;

        if(numExtra > 0) {
          showAllElem.show();
          showAllElem.text('show all (' + numExtra + ' more)');
        } else {
          showAllElem.hide();
        }
      } else {
        showAllElem.hide();
      }

      actionsBar = me.list.find('.header .actions');
      actions = actionsBar.find('span');

      if(actions.size() <= 0) return;

      actions.detach();
      actionsBar.html('');

      var lastAction = $(actions.get(0));
      actionsBar.append(lastAction);

      var i;
      for(i=1; i < actions.size(); i++) {
        var action = $(actions.get(i));
        if(lastAction.css('display') != 'none'
            && action.css('display') != 'none') {
          actionsBar.append(' • ');
        }

        actionsBar.append(action);
      }
    }
  };
  
  
  function init(allSections) {
    protoSection = detachProto(topDiv.find('.section.proto'));
    protoItemRow = detachProto(protoSection.find('table.items tr.proto'));
    protoNavSection = detachProto($('#nav-sections .proto'));
    
    sitesLabel = $('#nav-sections .head');
    sitesLabel.click(showSites);

    allSections.forEach(function(sectionInfo) { new Section(sectionInfo); });
    
    showSites();
  }
  
  function showSites() {
    sitesLabel.addClass('selected');
    // all visible, except for Recent
    visible = []
    Object.keys(byName).forEach(function(k) {
      var sec = byName[k];
      sec.label.removeClass('selected');
      if(sec.hidden) {
        sec.hideList();
      } else {
        sec.showShortList();
        visible.push(sec);
      }
    });
  }
  
  function show(v) {
    sitesLabel.removeClass('selected');
    v.label.addClass('selected');
    v.showFullList();
    visible.forEach(function(sec) {
      if (sec !== v) {
        sec.label.removeClass('selected');
        sec.hideList();
      }
    });
    visible = [v];
  }
  
  function deleteInstance(inst) {
    inst.row.fadeOut(400, function() {
      inst.row.detach();

      byName[inst.state.section].updateList();
      if(inst.state.section == "Trash") {
        if (inst.capServer) inst.capServer.revokeAll();
        delete instances[inst.state.id];
        inst.storageCap.remove();
      } else {
        moveInstanceToSection(inst, byName["Trash"])
        byName["Trash"].updateList();
      }
    });
  }

  function moveInstanceToSection(inst, section) {
    if(inst.state.section == section.name) return;
    byName[inst.state.section].removeInstance(inst);
    byName[section.name].addInstance(inst);
    
    dirty(inst);
    attributes.pushToInstance(inst);
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

    row.attr('draggable', 'true');
    row.bind('dragstart', function(evt) {
      var realEvt = evt.originalEvent;

      // TODO(iainmcgin): a chrome bug prevents the use of mime types for data
      // other than text/plain and text/html. Ideally this should be a
      // custom mime type, like text/x-belay-instance, but use text/plain
      // for now.
      dragData.dragString = newUUIDv4();
      dragData.instanceId = inst.state.id;
      content = '<span data="' + dragData.dragString + '">' 
        + inst.state.name 
        + '</span>';
      realEvt.dataTransfer.setData('text/html', content);
      realEvt.dataTransfer.effectAllowed = 'move';
      row.addClass('dragging');
    });
    row.bind('dragend', function() {
      row.removeClass('dragging');
    })

    inst.row = row;
    if (!(inst.state.section in byName)) {
      inst.state.section = defaultName;
      dirty(inst);
    }
    var section = byName[inst.state.section];
    section.addInstance(inst);
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

  function rebuild(idData) {
    options = {}
    function opt(k, v) {
      if (!(k in options)) { options[k] = []; }
      options[k].push(v);
    }
    function opts(k, vs) {
      options[k] = (options[k] || []).concat(vs);
    }
    
    for (var k in idData) {
      var d = idData[k];
      var text = d.display_name || d.account_name;
      if (d.id_provider) { text += ' — ' + d.id_provider; }
      text += '(' + d.id_type + ')';
      
      opt('id', text);
      
      for (var t in d.attributes) {
        opts(t, d.attributes[t]);
      }
    }
    for (var z in options) {
      console.log(z + ': ' + options[z].join(', '));
    }
  }

  return {
    rebuild: rebuild,
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
      if (inst.launch && 
          inst.launch.attributes && 
          inst.launch.attributes.set) {
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


var identities = (function() {
  var identitiesCap = null;
  var navIdentityList = null;
  var protoIdentity = null;
  
  function init(idData, idCap, idAdders) {
    identitiesCap = idCap;
    navIdentityList = $('#nav-ids');
    protoIdentity = detachProto(navIdentityList.find('.identity.proto'));

    var protoButton = protoIdentity.clone();
    protoButton.removeClass('identity');
    protoButton.addClass('button');
    
    idAdders.forEach(function(adder){
      var startId;
      
      var ready = capServer.grant(function(activate) {
        adder.launch.get(function(launchInfo) {
          var instanceId = newUUIDv4();
          activate.post({
            instanceId: instanceId,
            pageUrl: launchInfo.page.html,
            outpostData: { 
              info: launchInfo.info,
              instanceId: instanceId,
              notifyClose: capServer.grant(refresh)
            }
          });
        });
      });
      
      function reprime() {
        startId = newUUIDv4();
        expectPage.post({
          startId: startId,
          ready: ready,
        });        
      }
      reprime();
      
      var addElem = protoButton.clone();
      addElem.text(adder.title);
      addElem.click(function() {
        var newWindow = window.open('redirect.html', startId,
            'width=600,height=600,resizable,scrollbars=yes,status=1');
        reprime();
        function checker(evt) {
          if (evt.originalEvent.source == newWindow) {
            refresh();
            unchecker();
            return true;
          }
        }
        function unchecker() {
          $(window).unbind('message', checker);
        }
        $(window).bind('message', checker);
        setTimeout(unchecker, 10000);
      });
      navIdentityList.append(addElem);
    });

    var addTestElem = protoButton.clone();
    addTestElem.text("Add Test Identities");
    addTestElem.click(function() {
      identitiesCap.put([
        {'id_type': 'OpenID',
         'id_provider': 'google',
         'account_name': 'betsy.ross@gmail.com',
         'display_name': 'Betsy Ross'},
        {'id_type': 'OpenID',
         'id_provider': 'yahoo',
         'account_name': 'bross@yahoo.com'},
        {'id_type': 'email',
         'account_name': 'bee.girl@ralvery.com'},
        ], refresh);
    });
    navIdentityList.append(addTestElem);
    var removeElem = protoButton.clone();
    removeElem.text("Remove All Identities");
    removeElem.click(function() {
      identitiesCap.put([ ], refresh);
    });
    navIdentityList.append(removeElem);

    rebuild(idData);
  }
  
  function refresh() {
    identitiesCap.get(rebuild);
  }
  
  function rebuild(idData) {
    var list = $('<ul></ul>');
    for (var k in idData) {
      var d = idData[k];
      var text = d.display_name || d.account_name;
      var title = d.account_name;
      if (d.id_provider) { title += ' — ' + d.id_provider; }
      
      var elem = protoIdentity.clone();
      var image = elem.find('img');
      image.attr('src', d.id_icon);
      image.attr('alt', d.id_provider || '')
      var desc = elem.find('span');
      desc.text(text);
      desc.attr('title', title);
      list.append(elem);
    }
    
    navIdentityList.find('.identity').remove();
    navIdentityList.find('.head').after(list.children());

    attributes.rebuild(idData);
  }
  return {
    init: init
  }
})();

var initialize = function() {
  $(document.body).find('.ex').remove(); // remove layout examples

  sections.init(stationInfo.allSections);
  identities.init(
    stationInfo.allIdentities,
    stationInfo.identities,
    stationInfo.addIdentityLaunchers);
  
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
  inst.row.find('td.actions .open-page').attr('target', newStartId);
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


});
