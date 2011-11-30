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

  function setup(section) {
    var data = section.attributes;
    var editData;
    
    var attributesElem = section.list.find('.attributes');
    var attributesDiv = attributesElem.find('.box');
    var attributesTable = attributesDiv.find('table');
    var protoRow = utils.detachProto(attributesTable.find('tr'));

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

      instances.forEach(function(inst) {
        if (inst.state.section === section.name) {
          pushToInstance(inst);
        }
      });
    }
    function cancelAttributes() {
      hideAttributes();
    }

    section.list.find('.header .settings').click(showAttributes);
    attributesDiv.find('.save').click(saveAttributes);
    attributesDiv.find('.cancel').click(cancelAttributes);
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
    setup: setup,
    pushToInstance: pushToInstance,
  };
});

