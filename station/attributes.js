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

define(['utils', 'instances', 'require'], function(utils, instances, require) {

  function isChildOf(elem, parentCandidate) {
    var parent = elem.parentNode;
    while(parent != null) {
      if(parent == parentCandidate) {
        return true;
      }
      parent = parent.parentNode;
    }

    return false;
  }

  // top-level click handler which is used to collapse opened choice
  // attribute selectors if the user clicks somewhere outside of the
  // selector when it is expanded.
  $(document).click(function(evt) {
    $('.attr-select.expanded').each(function() {
      if(!isChildOf(evt.target, this)) {
        $(this).find('ul').trigger('hide');
      }
    });
  });

  var ChoiceAttribute = function(choices) { this.choices = choices; };

  ChoiceAttribute.prototype = {
    build: function(td, setter) {
      var selectElem = $('<div>', { class: 'attr-select' });
      var indicatorElem = $('<div>', { class: 'indicator', text: '▼' });
      var currentSelectionElem = $('<div>', { class: 'selected' });
      var optionsElem = $('<ul>');

      this.choices.forEach(function(choice) {
        var optionElem = $('<li>');
        optionElem.data('value', choice.value);
        if(choice.image) {
          optionElem.append($('<img>', { 
            src: choice.image,
            class: 'value'
          }));
        } else {
          optionElem.append($('<span>', { text: choice.value }));
        }

        if(choice.sourceIcon) {
          optionElem.append($('<img>', { 
            src: choice.sourceIcon,
            class: 'source'
          }));
        }

        optionElem.click(function() {
          currentSelectionElem.html(optionElem.html());
          currentSelectionElem.data('value', optionElem.data('value'));
          optionsElem.trigger('hide');
          setter(optionElem.data('value'));
        });

        optionsElem.append(optionElem);
      });

      indicatorElem.click(function() { optionsElem.trigger('toggle'); });
      currentSelectionElem.click(function() { optionsElem.trigger('toggle'); });

      optionsElem.find('li:eq(0)').click();

      selectElem.append(indicatorElem);
      selectElem.append(currentSelectionElem);
      selectElem.append(optionsElem);

      optionsElem.bind('show', function() {
        if(optionsElem.is(":animated")) return false;
        selectElem.addClass('expanded');
        optionsElem.css('width', selectElem.innerWidth());
        optionsElem.css('top', selectElem.outerHeight());
        optionsElem.slideDown('fast');
      });

      optionsElem.bind('hide', function() {
        if(optionsElem.is(":animated")) return false;
        selectElem.removeClass('expanded');
        optionsElem.slideUp('fast');
      });

      optionsElem.bind('toggle', function() {
        if(selectElem.hasClass('expanded')) optionsElem.trigger('hide');
        else optionsElem.trigger('show');
      });

      td.empty();
      td.append(selectElem);

      optionsElem.hide();
    },
    value: function(td, value) {
      return td.find('.attr-select .selected').data('value');
    },
    focus: function(td) {
      td.find('.attr-select').focus();
    }
  };

  var attributeProperties = {
    'name': { 
      'en': 'Name',
      'type': 'text',
      'order': 0
    },
    'email': { 
      'en': 'Email',
      'type': 'text',
      'order': 1
    },
    'gender': { 
      'en': 'Gender',
      'type': 'text',
      'defaults': {
        'male': { 'en': 'Male' },
        'female': { 'en': 'Female' },
        'other': { 'en': 'Other' }
      },
      'order': 2
    },
    'age': { 
      'en': 'Age',
      'type': 'int',
      'order': 3
    },
    'location': { 
      'en': 'Location',
      'type': 'text',
      'order': 4
    },
    'image': { 
      'en': 'Image',
      'type': 'image',
      'showSource': true,
      'order': 5
    },
  };

  var knownAttributes = [];

  function rebuild(idData) {
    // map of attr -> (map of value -> {value, Maybe sourceIcon, Maybe image})
    options = {};
    function opt(k, v) {
      if (!(k in options)) { options[k] = {}; }
      if(!(v.value in options[k])) {
        options[k][v.value] = v;
      }
    }
    
    knownAttributes = [];
    extractAttributes(idData, opt);
    addDefaultAttributes(opt);
    sortAttributeOptions(options);
    knownAttributes = sortAttributes(options);
  }

  function extractAttributes(idData, addOpt) {
    idData.forEach(function(id) {
      for (var attrName in id.attributes) {
        id.attributes[attrName].forEach(function(val) {
          var optionInfo = {
            value: val
          };

          if(attributeProperties[attrName].showSource) {
            optionInfo.sourceIcon = id.id_icon;
          }

          if(attributeProperties[attrName].type == 'image') {
            optionInfo.image = val;
          }

          addOpt(attrName, optionInfo);
        });
      }
    });
  }

  function addDefaultAttributes(addOpt) {
    for(var attrKey in attributeProperties) {
      if(!('defaults' in attributeProperties[attrKey])) continue;

      var defaults = attributeProperties[attrKey].defaults;
      for(defaultOpt in defaults) {
        addOpt(attrKey, {
          'value': defaults[defaultOpt].en
        });
      }
    }
  }

  function sortAttributeOptions(options) {
    for (var attrKey in options) {
      var sortedOptions = [];
      Object.keys(options[attrKey])
        .sort()
        .forEach(function(value) {
          sortedOptions.push(options[attrKey][value]);
        });
      options[attrKey] = sortedOptions;
    }
  }

  function sortAttributes(options) {
    return Object.keys(options)
      .sort(function(a, b) {
        return attributeProperties[a].order - attributeProperties[b].order;
      })
      .map(function(attrName) {
        return {
          attr: attrName,
          en: attributeProperties[attrName].en,
          controller: new ChoiceAttribute(options[attrName])
        };
      });
  }

  function SectionAttributesEditor(section) {
    var me = this;
    this.data = section.attributes;
    this.editData = {};
    
    this.attributesElem = section.list.find('.attributes');
    this.attributesDiv = this.attributesElem.find('.box');

    this.attributesTable = this.attributesDiv.find('table');
    this.protoRow = utils.detachProto(this.attributesTable.find('tr'));

    function resetAttributes() {
      me.editData = { };

      me.attributesTable.find('tr').each(function(i, tr) {
        var a = knownAttributes[i];
        var row = $(tr);

        var includeInput = row.find('.include input');
        var valueTD = row.find('.value');

        function enable() {
          me.editData[a.attr] = a.controller.value(valueTD, me.data[a.attr]);
          includeInput.attr('checked', 'checked');
          valueTD.children().css('visibility', 'visible');
        }
        function disable() {
          delete me.editData[a.attr];
          includeInput.removeAttr('checked');
          valueTD.children().css('visibility', 'hidden');
          valueTD.click(function() {
            valueTD.unbind();
            enable();
            a.controller.focus(valueTD);
          });
        }
        function able(bool) { bool ? enable() : disable(); }

        able(a.attr in me.data);

        includeInput.change(function() {
          able(includeInput.attr('checked'));
        });
      });
    };

    function showAttributes() {
      if (me.attributesElem.css('display') !== 'none') {
        for (var k in me.data) { 
          if (me.data[k] != me.editData[k]) return; 
        }
        hideAttributes();
        return;
      };

      resetAttributes();
      me.attributesDiv.hide();
      me.attributesElem.show();
      me.attributesDiv.slideDown();
    }

    function hideAttributes() {
      me.attributesDiv.slideUp(function() { me.attributesElem.hide(); });
    }

    function saveAttributes() {
      console.log('save');
      section.attributes = me.data = me.editData;
      section.attributesCap.put(me.data, hideAttributes);

      instances.forEach(function(inst) {
        if (inst.state.section === section.name) {
          pushToInstance(inst);
        }
      });
    }

    function cancelAttributes() {
      hideAttributes();
    }

    this.rebuild = function() {
      me.attributesTable.find('tr').remove();
      knownAttributes.forEach(function(a) {
        var row = me.protoRow.clone();
        row.find('.include input').removeAttr('checked');
        row.find('.tag').text(a.en);
        a.controller.build(row.find('.value'), function(v) {
          me.editData[a.attr] = v;
        });
        row.appendTo(me.attributesTable);
      });

      resetAttributes();
    };

    this.rebuild();
    section.list.find('.header .settings').click(showAttributes);
    me.attributesDiv.find('.save').click(saveAttributes);
    me.attributesDiv.find('.cancel').click(cancelAttributes);
  }

  function pushToInstance(inst) {
    if (inst.launch && 
        inst.launch.attributes && 
        inst.launch.attributes.set) { 
      var data = require('sections').forInstance(inst).attributes;
      inst.launch.attributes.set.put(data, function() {
        if (inst.refreshCap) {
          inst.refreshCap.post({});
        }
      });
    }
  }

  return {
    rebuild: rebuild,
    SectionAttributesEditor: SectionAttributesEditor,
    pushToInstance: pushToInstance,
  };
});

