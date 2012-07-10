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

require(['utils'], function(utils) {
'use strict';

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

belay.start(function(capServer){

function launchStation(launchCap) {
  launchCap.post({ version: 'new' },
    function(launchDescriptor) {
      var instanceId = belay.newUUIDv4();

      belay.outpost.activateLocalPage.post({
        instanceId: instanceId,
        isStation: true,
        pageUrl: launchDescriptor.pageUrl || launchDescriptor.page.html,
        outpostData: {
          info: launchDescriptor.info,
          instanceId: instanceId
        }
      });
    },
    function(err) { alert("Your station isn't on-line."); }
  );
}

function launchIfStored()
{
  var launchCap = localStorage.getItem('launchCap');
  if (launchCap != null) {
    launchStation(capServer.restore(launchCap));
  }
}

function launchAndStoreStation(launchCap)
{
  localStorage.setItem('launchCap', launchCap);
  launchStation(launchCap);
}

$(window).bind('storage', function(evt) {
  if (evt.originalEvent.key == 'launchCap-authenticated-time') {
    launchIfStored();
  }
});

function init() {
  if (launchIfStored()) { return; }

  loginMethods.forEach(function(login) {
    function refresh() {
    }

    var startId;

    var ready = capServer.grant(function(activate) {
      var origin = location.protocol + '//' + location.host;
      var url = origin + login.launch;
      capServer.restore(url).get(function(launchInfo) {
        var instanceId = belay.newUUIDv4();
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
      startId = belay.newUUIDv4();
      belay.outpost.expectPage.post({
        startId: startId,
        ready: ready
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
      setTimeout(unchecker, 60000);
    });
    $('#login-id-list').append(loginElem);
  });

  utils.initInputsWithEmbeddedLabels($('.confirm-set input'));

  var emailVerifyBtn = $('#email-verify input[type="submit"]');
  var emailInput = $('#email-verify input[name="email"]');
  emailVerifyBtn.click(function() {
    $.post('/verify/email',
      { email: emailInput.val() },
      function(data, status) {
        var verifyCap = capServer.dataPostProcess(data);
        $('#verify-code').unbind('click');
        $('#verify-code').click(function() {
          verifyCap.post({'code': $('#code').val() }, function(launch) {
            launchAndStoreStation(launch);
            utils.hideDialog($('#verify-code-dialog'));
          }, function(err) {
            var errorElem = $('#verify-code-dialog .error');
            if (err.status == 404) {
              errorElem.
                text('Too many attempts have been made to verify this code ' +
                'incorrectly. Please close this dialog and request a new ' +
                'code if you believe this to be in error.');
            } else if (err.status == 403) {
              errorElem.
                text('The provided code did not match the sent code, please ' +
                     'try re-entering the code.');
            } else {
              errorElem.
                text('An unexpected error occurred. Please try submitting ' +
                     'the code again.');
            }

            errorElem.show();
          });
        });

        $('#code').val('');
        $('#verify-code-dialog .error').hide();
        utils.showDialog($('#verify-code-dialog'));
      }).fail(function(resp) {
        if (resp.status == 400) {
          alert('The email address entered was not valid.');
        } else if (resp.status == 403) {
          alert('A verification code was generated too recently. Please wait ' +
                'at least one minute before trying again.');
        }
      });
  });

  $('#verify-code-dialog .close').click(function() {
    utils.hideDialog($('#verify-code-dialog'));
  });
}

init();
window.belaytest.ready = true;

});

});
