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


// "use strict";

// TODO(jasvir): These should be modules not scripts
require([
    "utils",
    "order!lib/js/include-belay.js", 
    "order!lib/js/caps.js", 
    "order!lib/js/common.js",
    "order!lib/js/belay-client.js"], 
  function (utils) {

var protoButton = utils.detachProto($('#proto-login-id'));
$(document.body).find('.ex').remove(); // remove layout examples

var loginMethods = [ 
    // NOTE(mzero): launch paths must be absolute
    { 'title': 'Sign in via Gmail',
      'launch': '/login/openid/google/launch',
      'image': '/res/images/gmail.png' },
    { 'title': 'Sign in via Yahoo',
      'launch': '/login/openid/yahoo/launch',
      'image': '/res/images/yahoo.png' },
    { 'title': 'Sign in via AOL',
      'launch': '/login/openid/aol/launch',
      'image': '/res/images/aol.png' }
  ];

$(window).bind('storage', function(evt) {
  if (evt.originalEvent.key == 'launchCap') {
    var launchCap = evt.originalEvent.newValue;
    if (launchCap != null) {
      capServer.restore(launchCap).post({ version: 'new' },
        function(launchDescriptor) {
          var instanceId = newUUIDv4();

          belay.outpost.activate.post({
            instanceId: instanceId,
            isStation: true,
            pageUrl: launchDescriptor.pageUrl || launchDescriptor.page.html,
            outpostData: {
              info: launchDescriptor.info,
              instanceId: instanceId,
            }
          });
        },
        function(err) { alert("Your station isn't on-line."); }
      );
    }
  }
});

function init() {
  loginMethods.forEach(function(login){
    function refresh() {
    }
    
    var startId;

    var ready = capServer.grant(function(activate) {
      var url = location.origin + login.launch;
      capServer.restore(url).get(function(launchInfo) {
        var instanceId = newUUIDv4();
        activate.post({
          instanceId: instanceId,
          pageUrl: launchInfo.page.html,
          outpostData: { 
            info: launchInfo.info,
            instanceId: instanceId,
          }
        });
      });
    });

    function reprime() {
      startId = newUUIDv4();
      belay.outpost.expectPage.post({
        startId: startId,
        ready: ready,
      });
    }
    reprime();

    var loginElem = protoButton.clone();
    loginElem.find('span').text(login.title);
    loginElem.css('background-image', 'url(' + login.image + ')');
    loginElem.click(function() {
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
    $('#login-id-list').append(loginElem);
  });
}

onBelayReady(function(){
  init();
  window.belaytest.ready = true;
});

});
