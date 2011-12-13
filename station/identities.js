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

define(['utils', 'sections'], function(utils, sections) {

  var capServer;
  
  var identitiesCap = null;
  var navIdentityList = null;
  var protoIdentity = null;
  
  function init(cs, idData, idCap, idAdders, createProfile) {
    capServer = cs;
    identitiesCap = idCap;
    navIdentityList = $('#nav-ids');
    protoIdentity = utils.detachProto(navIdentityList.find('.identity.proto'));

    var openDialogButton = $('#add-id-button');
    openDialogButton.click(function() {
      $('.dark-screen').show();
      dialog = $('#id-add-dialog');
      dialog.show();
      dialog.css('top', ($(window).height() - dialog.outerHeight()) / 2 + 'px');
      dialog.css('left', ($(window).width() - dialog.outerWidth()) / 2 + 'px');
    });

    var hideIdAddDialog = function() {
      $('.dark-screen').hide();
      $('#id-add-dialog').hide();
      $('#custom-profile-fields input, #custom-profile-fields select')
        .each(function() { $(this).trigger('reset'); });
      $('#id-add-dialog .error').hide();
    }

    $('#id-add-dialog .close').click(hideIdAddDialog);

    var protoButton = utils.detachProto($('#proto-add-id'));

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
      addElem.find('span').text(adder.title);
      addElem.css('background-image', 'url(' + adder.image + ')');
      addElem.click(function() {
        hideIdAddDialog();
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
      $('#add-id-list').append(addElem);
    });

    // TODO (iainmcgin): when we remove an identity, what should we do with
    // sections that were using that identity or individual attributes from
    // the identity? Should the user be asked what to do, should we retain
    // those values as "special" in some sense, or silently override the
    // user's attribute selections?
    var removeElem = $('#add-id-button').clone();
    removeElem.attr('id', 'id-remove-button');
    removeElem.text("Remove All Identities");
    removeElem.click(function() {
      identitiesCap.put([ ], refresh);
    });
    navIdentityList.append(removeElem);

    $('#custom-profile-fields input, #custom-profile-fields select')
      .each(function() {
        var elem = this;
        var input = $(elem);
        if(input.attr('type') == 'submit') return;

        var initialText = input.val();
        input.bind('focus mousedown', function() {
          if(elem.classList.contains('fresh')) {
            elem.classList.remove('fresh');
            input.val('');
          }
        });

        input.focusout(function() {
          if(input.val() == '' || input.val() == initialText) {
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
        })

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
          if(jqElem.attr('type') == 'submit') return;
          if(elem.classList.contains('fresh')) {
            if(elem.classList.contains('required')) {
              missingRequired = true;
            }
            return;
          }
          attrs[jqElem.attr('name')] = jqElem.val();
        });
      
      if(missingRequired) {
        $('.error').fadeIn('fast');
        return false;
      }

      if('age' in attrs) {
        var ageNum = parseInt(attrs['age']);
        if(isNaN(ageNum) || ageNum < 0) {
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

    sections.updateAttributes(idData);
  }
  
  return {
    init: init
  };
});

