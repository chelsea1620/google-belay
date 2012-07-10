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

define(['utils', 'instances', 'attributes', 'pageManager'],
  function(utils, instances, attributes, pageManager) {

  var capServer;
  var expectPage;

  var protoSection = null;
  var protoItemRow = null;
  var protoNavSection = null;
  var defaultName = 'Uncategorized';
  // Map<Name, { label: jQuery, list: jQuery }>
  var byName = Object.create(null);
  var sitesLabel = null; // jQuery
  var visible = [];

  var dragData = {
    dragString: null,
    instanceId: null
  };

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

    var showSection = function() { show(me); };
    var pid = pageManager.registerPage(this.label, showSection, hideSites);

    divider = $('#nav-sections .divider');
    if (this.hidden) {
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
    this.list.find('.header .show-all').click(function() {
      pageManager.showPage(pid);
    });
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

        if (dragData.dragString != data) {
          return true;
        }

        var instance = instances.getById(dragData.instanceId);
        moveInstanceToSection(instance, me);
        evt.stopPropagation();
        return false;
      });
    };

    makeDroppable(this.label);
    makeDroppable(this.list);

    byName[this.name] = this;

    if (this.name != 'Trash') {
      this.attributesEditor = new attributes.SectionAttributesEditor(this);
    } else {
      this.list.find('.header .settings').remove();

      // TODO(iainmcgin): the clear button should exist in a special
      // template for the trash section, not be injected into the actions list
      // as it is below.

      actionsGroup = this.list.find('.header .actions');
      deleteAll = $('<span>clear</span>');
      deleteAll.click(function() {
        instances.forEach(function(instance) {
          if (instance.state.section == me.name) {
            deleteInstance(instance);
          }
        });
      });
      actionsGroup.append(deleteAll);
    }

    this.showShortList = function() {
      me.showingFullList = false;
      me.list.show();
      me.list.find('.items tr:lt(' + me.shortListSize + ')').show();
      me.list.find('.items tr:gt(' + (me.shortListSize - 1) + ')').hide();

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
      if (me.showingFullList) {
        me.showFullList();
      } else {
        me.showShortList();
      }
    };

    this.updateList = function() {
      if (me.list.css('display') == 'none') return;
      me.showList();
    };

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
    };

    this.removeInstance = function(inst) {
      inst.row.detach();
      me.updateList();
    };

    this.updateActionsBar = function() {
      var showAllElem = me.list.find('.header .actions .show-all');
      if (!me.showingFullList) {
        var totalItems = me.list.find('.items tr').size();
        var numExtra = totalItems - me.shortListSize;

        if (numExtra > 0) {
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

      if (actions.size() <= 0) return;

      actions.detach();
      actionsBar.html('');

      var lastAction = $(actions.get(0));
      actionsBar.append(lastAction);

      var i;
      for (i = 1; i < actions.size(); i++) {
        var action = $(actions.get(i));
        if (lastAction.css('display') != 'none' &&
            action.css('display') != 'none') {
          actionsBar.append(' • ');
        }

        actionsBar.append(action);
      }
    };

    this.updateAttributes = function() {
      if (this.attributesEditor) { this.attributesEditor.rebuild(); }
    };

    this.setAssignedId = function(id) {
      if (this.attributesEditor) { this.attributesEditor.setAssignedId(id); }
    };

    this.assignIdCandidate = function() {
      if (!this.attributesEditor) { return false; }
      return !(this.attributesEditor.hasAssignedId());
    }

    this.clearAssignedId = function() {
      if (this.attributesEditor) { this.attributesEditor.clearAssignedId(); }
    }
  };


  function init(cs, allSections, ep) {
    capServer = cs;
    expectPage = ep;

    protoSection = utils.detachProto($('#aux .section.proto'));
    protoItemRow = utils.detachProto(protoSection.find('table.items tr.proto'));
    protoNavSection = utils.detachProto($('#nav-sections .proto'));

    sitesLabel = $('#nav-sections .head');
    // the "Sites" header is the default page, where all nav flows
    // should return to by default
    pageManager.registerDefaultPage(sitesLabel, showSites, hideSites);

    allSections.forEach(function(sectionInfo) { new Section(sectionInfo); });
    pageManager.showDefaultPage();
  }

  function showSites() {
    // all visible, except for Recent
    visible = [];
    Object.keys(byName).forEach(function(k) {
      var sec = byName[k];
      if (sec.hidden) {
        sec.hideList();
      } else {
        sec.showShortList();
        visible.push(sec);
      }
    });
    $('#belay-items').show();
  }

  function hideSites() {
    $('#belay-items').hide();
  }

  function show(v) {
    v.showFullList();
    visible.forEach(function(sec) {
      if (sec !== v) {
        sec.hideList();
      }
    });
    visible = [v];
    $('#belay-items').show();
  }

  function deleteInstance(inst) {
    // TODO (iainmcgin): this is the main 'delete' action for instances,
    // despite not living in the instances.js module. Responsibility for delete
    // needs to be more clearly defined.
    if (inst.closeCap) {
      inst.closeCap.put();
    }
    inst.row.fadeOut(400, function() {
      inst.row.detach();

      byName[inst.state.section].updateList();
      if (inst.state.section == 'Trash') {
        instances.deleteInstance(inst.state.id);
        inst.storageCap.remove();
      } else {
        moveInstanceToSection(inst, byName['Trash']);
        byName['Trash'].updateList();
      }
    });
  }

  function moveInstanceToSection(inst, section) {
    if (inst.state.section == section.name) return;
    byName[inst.state.section].removeInstance(inst);
    byName[section.name].addInstance(inst);

    instances.dirty(inst);
    attributes.pushToInstance(inst);
  }

  function newInstance(inst) {
    var row = protoItemRow.clone();

    var icon = row.find('td.icon img');
    icon.attr('src', inst.state.icon || defaultIcon);
    row.find('td.name').text(inst.state.name || 'an item');
    row.find('td.actions .remove').click(function() {
      deleteInstance(inst);
    });

    var readyCap = capServer.grant(function(activate) {
      instances.launchInstance(inst, activate);
    });
    function reprime() {
      var startId = belay.newUUIDv4();
      openPageBtn.attr('target', startId);
      expectPage.post({
        startId: startId,
        ready: readyCap
      });
    }
    var openPageBtn = row.find('td.actions .open-page');
    openPageBtn.attr('href', 'redirect.html');
    openPageBtn.click(function(evt) {
      setTimeout(reprime, 0);
    });
    reprime();


    row.attr('draggable', 'true');
    row.bind('dragstart', function(evt) {
      var realEvt = evt.originalEvent;

      // TODO(iainmcgin): a chrome bug prevents the use of mime types for data
      // other than text/plain and text/html. Ideally this should be a
      // custom mime type, like text/x-belay-instance, but use text/plain
      // for now.
      dragData.dragString = belay.newUUIDv4();
      dragData.instanceId = inst.state.id;
      content = '<span data="' + dragData.dragString + '">' +
          inst.state.name + '</span>';
      realEvt.dataTransfer.setData('text/html', content);
      realEvt.dataTransfer.effectAllowed = 'move';
      row.addClass('dragging');
    });
    row.bind('dragend', function() {
      row.removeClass('dragging');
    });

    inst.row = row;
    if (!(inst.state.section in byName)) {
      inst.state.section = defaultName;
      instances.dirty(inst);
    }
    var section = byName[inst.state.section];
    section.addInstance(inst);
  }

  function forInstance(inst) {
    return byName[inst.state.section];
  }

  function forEach(visitor) {
    for (sectionName in byName) {
      visitor(byName[sectionName]);
    }
  }

  function updateAttributes(idData) {
    attributes.rebuild(idData);
    for (sectionName in byName) {
      byName[sectionName].updateAttributes();
    }
  }

  function withoutAssignedId() {
    var sections = [];
    for (var secName in byName) {
      var section = byName[secName];
      if (section.assignIdCandidate()) {
        sections.push(byName[secName]);
      }
    }

    return sections;
  }

  function forEach(visitor) {
    for (var secName in byName) {
      visitor(byName[secName]);
    }
  }

  return {
    init: init,
    newInstance: newInstance,
    deleteInstance: deleteInstance,
    forInstance: forInstance,
    updateAttributes: updateAttributes,
    withoutAssignedId: withoutAssignedId,
    forEach: forEach
  };
});

