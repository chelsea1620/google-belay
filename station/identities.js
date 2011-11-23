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

define(['utils', 'attributes'], function(utils, attributes) {

  var capServer;
  
  var identitiesCap = null;
  var navIdentityList = null;
  var protoIdentity = null;
  
  function init(cs, idData, idCap, idAdders) {
    capServer = cs;
    identitiesCap = idCap;
    navIdentityList = $('#nav-ids');
    protoIdentity = utils.detachProto(navIdentityList.find('.identity.proto'));

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
  };
});

