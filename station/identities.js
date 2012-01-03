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

define(['utils', 'sections', 'attributes', 'pageManager'],
function(utils, sections, attributes, pageManager) {

  var capServer;

  var identitiesCap = null;
  var navIdentityList = null;
  var protoIdentity = null;
  var identities = null;

  function hideDialog(dialog) {
    $('.dark-screen').hide();
    dialog.hide();
  }

  function showDialog(dialog) {
    $('.dark-screen').show();
    dialog.show();
    dialog.css('top', ($(window).height() - dialog.outerHeight()) / 2 + 'px');
    dialog.css('left', ($(window).width() - dialog.outerWidth()) / 2 + 'px');
  }

  function init(cs, idData, idCap, idAdders, createProfile) {
    capServer = cs;
    identitiesCap = idCap;
    navIdentityList = $('#nav-ids');
    protoIdentity = utils.detachProto(navIdentityList.find('.identity.proto'));

    var hideIdAddDialog = function() {
      hideDialog($('#id-add-dialog'));
      $('#custom-profile-fields input, #custom-profile-fields select')
        .each(function() { $(this).trigger('reset'); });
      $('#id-add-dialog .error').hide();
    }

    $('#id-add-button').click(function() { showDialog($('#id-add-dialog')); });
    $('#id-add-dialog .close').click(hideIdAddDialog);

    var protoButton = utils.detachProto($('#proto-add-id'));

    idAdders.forEach(function(adder) {
      var startId;

      var ready = capServer.grant(function(activate) {
        adder.launch.get(function(launchInfo) {
          var instanceId = newUUIDv4();
          activate.post({
            instanceId: instanceId,
            pageUrl: launchInfo.page.html,
            outpostData: {
              info: launchInfo.info,
              instanceId: instanceId
            }
          });
        });
      });

      function reprime() {
        startId = newUUIDv4();
        expectPage.post({
          startId: startId,
          ready: ready
        });
      }
      reprime();

      var addElem = protoButton.clone();
      addElem.find('span').text(adder.title);
      addElem.css('background-image', 'url(' + adder.image + ')');
      addElem.click(function() {
        hideIdAddDialog();
        var newWindow = window.open('redirect.html', startId,
            'width=600,height=600,resizable,scrollbars=yes,status=1');
        reprime();
        function checker(evt) {
          if (evt.originalEvent.source == newWindow) {
            handleNewId();
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
      $('#id-add-list').append(addElem);
    });

    $('#custom-profile-fields input, #custom-profile-fields select')
      .each(function() {
        var elem = this;
        var input = $(elem);
        if (input.attr('type') == 'submit') return;

        var initialText = input.val();
        input.bind('focus mousedown', function() {
          if (elem.classList.contains('fresh')) {
            elem.classList.remove('fresh');
            input.val('');
          }
        });

        input.focusout(function() {
          if (input.val() == '' || input.val() == initialText) {
            elem.classList.add('fresh');
            input.val(initialText);
          }
        });

        input.bind('reset', function() {
          elem.classList.add('fresh');
          input.val(initialText);
        });
      });

      $('#custom-profile-fields select').each(function() {
        var defaultOption = $(this).find('option[value=""]');
        var initialText = defaultOption.text();
        $(this).bind('focus mousedown', function() {
          defaultOption.text('');
        });

        $(this).focusout(function() {
          defaultOption.text(initialText);
        });

        $(this).bind('reset', function() {
          defaultOption.text(initialText);
        });
      });

    $('#custom-profile-fields input[type="submit"]').click(function() {
      attrs = {};
      var missingRequired = false;
      $('#custom-profile-fields input, #custom-profile-fields select')
        .each(function(index, elem) {
          var jqElem = $(elem);
          if (jqElem.attr('type') == 'submit') return;
          if (elem.classList.contains('fresh')) {
            if (elem.classList.contains('required')) {
              missingRequired = true;
            }
            return;
          }
          attrs[jqElem.attr('name')] = jqElem.val();
        });

      if (missingRequired) {
        $('.error').fadeIn('fast');
        return false;
      }

      if ('age' in attrs) {
        var ageNum = parseInt(attrs['age']);
        if (isNaN(ageNum) || ageNum < 0) {
          delete attrs['age'];
        }
      }

      createProfile.post(attrs, function() {
        hideIdAddDialog();
        refresh();
      }, hideIdAddDialog);

      return false;
    });

    rebuild(idData);
  }

  function showIdentityPage(identity) {
    var page = $('#id-page');

    var profileImage = page.find('.id-header img');
    var imageSource = identity.attributes.image || '/res/images/person_2x.png';
    profileImage.attr('src', imageSource);

    page.find('.id-header span').text(identity.display_name);

    var idProviderElem = page.find('.id-provider-field');
    if (identity.id_provider) {
      idProviderElem.show();
      page.find('.id-provider-value').text(identity.id_provider);
    } else {
      idProviderElem.hide();
    }

    page.find('ul').replaceWith(buildAttributeListing(identity));

    // TODO(iainmcgin): when we remove an identity, what should we do with
    // sections that were using that identity or individual attributes from
    // the identity? Should the user be asked what to do, should we retain
    // those values as "special" in some sense, or silently override the
    // user's attribute selections?
    
    var deleteButton = page.find('#delete-id');
    deleteButton.unbind('click');
    deleteButton.click(function() {
      identities = identities.filter(function(id) {
        return id.account_name != identity.account_name;
      });
      identitiesCap.put(identities, function() {
        rebuild(identities);
      });
      pageManager.returnToDefault();
    });

    page.show();
  }

  function buildAttributeListing(identity) {
    var attrList = $('<ul>');
    var attrProtoRow = $('<li>');
    attrProtoRow.append($('<span class="attr-name">'));
    attrProtoRow.append(' - ');
    attrProtoRow.append($('<span class="attr-values">'));

    for (attrName in identity.attributes) {
      var attributeValues = identity.attributes[attrName];
      var attrRow = attrProtoRow.clone();
      attrRow.find('.attr-name').text(attrName);
      var attrValueElem = attrRow.find('.attr-values');
      if (attributes.getAttributeProperties(attrName).type == 'image') {
        attributeValues.forEach(function(value) {
          attrValueElem.append($('<img>', { src: value }));
        });
      } else {
        var valueString = attributeValues
            .sort()
            .reduce(function(vals, val) {
              if (vals.length != 0) {
                if (vals[vals.length - 1] == val) return vals;
              }

              vals.push(val);
              return vals;
            }, [])
            .reduce(function(a, b) {
              if (a == '') return b;
              else return a + ', ' + b;
            });
            attrValueElem.text(valueString);
      }

      attrList.append(attrRow);
    }

    return attrList;
  }

  function handleNewId() {
    var oldIdentities = identities;
    identitiesCap.get(function(idData) {
      identities = idData;
      rebuild(idData);

      if (sections.withoutAssignedId().length == 0) return;

      var newIds = identities.filter(function(id) {
        return !(oldIdentities.some(function(oldId) {
          return oldId.account_name == id.account_name;
        }));
      });

      if (newIds.length == 0) return;

      var newId = newIds[0];
      var newIdDialog = $('#id-added-dialog');
      newIdDialog.find('.idp-name').text(newId.id_provider);

      var attributeList = newIdDialog.find('.attr-list');
      attributeList.replaceWith(buildAttributeListing(newId));

      var sectionList = newIdDialog.find('.section-list');
      var protoSection = $('<li>');
      protoSection.append($('<input>', { type: 'checkbox' }));
      protoSection.append($('<span>', { class: 'section-name' }));
      sectionList.empty();

      sections.withoutAssignedId().forEach(function(section) {
        var sectionElem = protoSection.clone();
        sectionElem.data('section', section);
        sectionElem.find('.section-name').text(section.name);
        sectionList.append(sectionElem);
      });

      var okButton = newIdDialog.find('button');
      okButton.unbind('click');
      okButton.click(function() {
        sectionList.find('li input:checked').each(function() {
          var selected = $(this).parent();
          var section = selected.data('section');
          section.setAssignedId(newId.account_name);
        });

        hideDialog(newIdDialog);
      });

      var closeButton = newIdDialog.find('.close');
      closeButton.unbind('click');
      closeButton.click(function() { hideDialog(newIdDialog); });
      showDialog(newIdDialog);
    });
  }

  function clearIds() {
    sections.forEach(function(section) {
      section.clearAssignedId();
    });
    refresh();
  }

  function refresh() {
    identitiesCap.get(rebuild);
  }

  function rebuild(idData) {
    identities = idData;
    var list = $('<ul></ul>');
    for (var k in idData) {
      var d = idData[k];
      var text = d.display_name || d.account_name;
      var title = d.account_name;
      if (d.id_provider) { title += ' — ' + d.id_provider; }

      var elem = protoIdentity.clone();
      var image = elem.find('img');
      image.attr('src', d.id_icon);
      image.attr('alt', d.id_provider || '');
      var desc = elem.find('span');
      desc.text(text);
      desc.attr('title', title);

      var showHandler = (function(id) {
        return function() { showIdentityPage(id); };
      })(d);
      var hideHandler = function() { $('#id-page').hide(); };
      pageManager.registerPage(elem, showHandler, hideHandler);

      list.append(elem);
    }

    navIdentityList.find('.identity').remove();
    navIdentityList.find('.head').after(list.children());

    sections.updateAttributes(idData);
  }

  return {
    init: init
  };
});

