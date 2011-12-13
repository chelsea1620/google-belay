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

  var ChoiceAttribute = function(choices) { 
    this.choices = choices;
    this.choices.push({
      noValue: true,
      sources: [],
      display: 'Keep private'
    });
  };

  ChoiceAttribute.prototype = {
    build: function(td, setter) {
      var selectElem = $('<div>', { class: 'attr-select' });
      var indicatorElem = $('<div>', { class: 'indicator', text: '▼' });
      var currentSelectionElem = $('<div>', { class: 'selected' });
      var optionsElem = $('<ul>');
      var noValue = this.noValue;

      function chooseNoValue() {
        currentSelectionElem.html('<span class="no-value">Keep private</span>');
        currentSelectionElem.data('value', null);
        currentSelectionElem.data('sources', []);
        optionsElem.trigger('hide');
        setter(null, []);
      }

      this.choices.forEach(function(choice) {
        var optionElem = $('<li>');

        if(choice.image) {
          optionElem.append($('<img>', { 
            src: choice.image,
            class: 'value'
          }));
        } else {
          optionElem.append($('<span>', { text: choice.display }));
        }

        if(choice.sourceIcon) {
          optionElem.append($('<img>', { 
            src: choice.sourceIcon,
            class: 'source'
          }));
        }

        if(choice.noValue) {
          optionElem.click(chooseNoValue);
        } else {
          optionElem.data('value', choice.value);
          optionElem.data('sources', choice.sources);
          optionElem.click(function() {
            currentSelectionElem.html(optionElem.html());
            currentSelectionElem.data('value', optionElem.data('value'));
            currentSelectionElem.data('sources', optionElem.data('sources'));
            optionsElem.trigger('hide');
            setter(optionElem.data('value'), optionElem.data('sources'));
          });
        }

        optionsElem.append(optionElem);
      });

      selectElem.bind('reset', chooseNoValue);
      indicatorElem.click(function() { optionsElem.trigger('toggle'); });
      currentSelectionElem.click(function() { optionsElem.trigger('toggle'); });

      currentSelectionElem.html('<span class="no-value">Keep private</span>');
      currentSelectionElem.data('value', null);
      currentSelectionElem.data('sources', []);

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
    selectFromSource: function(td, source) {
      var selectionMade = false;
      td.find('.attr-select').each(function() {
        var choiceElem = $(this);
        
        choiceElem.find('li').each(function() {
          var sources = $(this).data('sources');
          if(!sources) return;
          for(var i=0; i < sources.length; i++) {
            if(sources[i] == source) {
              $(this).click();
              selectionMade = true;
            }
          }
        });
      });
      return selectionMade;
    },
    value: function(td, value) {
      return td.find('.attr-select .selected').data('value');
    },
    focus: function(td) {
      td.find('.attr-select').focus();
    }
  };

  var attributeProperties = {
    'id': {
      'en': 'Identity',
      'type': 'id',
      'showSource': true,
      'order': 0
    },
    'name': { 
      'en': 'Name',
      'type': 'text',
      'order': 1
    },
    'email': { 
      'en': 'Email',
      'type': 'text',
      'order': 2
    },
    'gender': { 
      'en': 'Gender',
      'type': 'text',
      'defaults': {
        'male': { 'en': 'Male' },
        'female': { 'en': 'Female' },
        'other': { 'en': 'Other' }
      },
      'order': 3
    },
    'age': { 
      'en': 'Age',
      'type': 'int',
      'order': 4
    },
    'location': { 
      'en': 'Location',
      'type': 'text',
      'order': 5
    },
    'image': { 
      'en': 'Image',
      'type': 'image',
      'showSource': true,
      'order': 6
    },
  };

  var knownAttributes = [];

  function rebuild(idData) {
    options = {};
    function opt(k, v) {
      if (!(k in options)) { options[k] = {}; }
      if(v.value in options[k]) {
        mapping = options[k][v.value];
        mapping.sources = mapping.sources.concat(v.sources);
      } else {
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
            value: val,
            display: val,
            sources: [ id.account_name ]
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

      var idName = id.display_name || id.account_name;
      addOpt('id', {
        value: id.account_name,
        display: idName,
        sourceIcon: id.id_icon,
        sources: [ id.account_name ]
      });
    });
  }

  function addDefaultAttributes(addOpt) {
    for(var attrKey in attributeProperties) {
      if(!('defaults' in attributeProperties[attrKey])) continue;

      var defaults = attributeProperties[attrKey].defaults;
      for(defaultOpt in defaults) {
        addOpt(attrKey, {
          'value': defaultOpt,
          'display': defaults[defaultOpt].en,
          sources: []
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

        var valueTD = row.find('.value');
        var choiceElem = row.find('.attr-select');

        if(!(a.attr in me.data)) {
          choiceElem.trigger('reset');
          delete me.editData[a.attr];
        } else {
          me.editData[a.attr] = a.controller.value(valueTD, me.data[a.attr]);
        }
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

    function selectFromSource(source) {
      me.attributesTable.find('tr').each(function() {
        var row = $(this);
        var attrName = row.data('attr');
        if(attrName == 'id') return;

        var checkBox = row.find('.include input');
        var selection = row.find('.value');
        
        knownAttributes.forEach(function(a) {
          if(a.attr != attrName) return;
          a.controller.selectFromSource(selection, source);
        });
      });
    }

    this.rebuild = function() {
      me.attributesTable.find('tr').remove();
      knownAttributes.forEach(function(a) {
        var row = me.protoRow.clone();
        row.find('.tag').text(a.en);
        row.data('attr', a.attr);

        var baseSetter = function(value, sources) {
          if(value == null) {
            delete me.editData[a.attr];
          } else {
            me.editData[a.attr] = value;
          }

          return !(value == null);
        };

        var setter = baseSetter;
        if(a.attr == 'id') {
          setter = function(value, sources) {
            if(baseSetter(value, sources)) selectFromSource(sources[0]);
          };
        }

        a.controller.build(row.find('.value'), setter);
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

