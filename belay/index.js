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

/* local storage for belay-belay is as follows:
  localStorage['belay'] <a processed json blob>
    .stationLaunchCap -- cap to station to launch
*/

function visible(n) { return n.css('display') != 'none'; };
function enable(n) { n.removeAttr('disabled'); }
function disable(n) { n.attr('disabled', 'disabled'); }

function setUpLaunchButton(elem, params) {
  var stationHash = '#' + newUUIDv4();
  elem.attr('href', 'http://localhost:9001/redirect.html' + stationHash);
  elem.attr('target', '_blank')
  belay.outpost.setStationLaunchHash.put({ hash: stationHash, params: params });
}

onBelayReady(function() {
  setUpLaunchButton($('#open-button a'), { version: 'new' });
  setUpLaunchButton($('#create-button a'), { version: 'new' });

  var belayData = capServer.dataPostProcess(localStorage['belay']);
  var hasStation = belayData && 'stationLaunchCap' in belayData && belayData.stationLaunchCap;
  
  if (hasStation) {
    $('#open-button').show();
  }
  else {
    $('#create-button').show();
  }

  $('#advanced h2').click(function() { 
    if(visible($('#advanced .content'))) {
      $('#advanced .control').text('▸');
      $('#advanced .content').slideUp();
    } else {
      $('#station-cap').val(hasStation ? belayData.stationLaunchCap.serialize() : '');
      disable($('#station-set'))
      if (hasStation) {
        enable($('#station-clear'));
      }
      else {
        disable($('#station-clear'));
      }
      $('#advanced .control').text('▾');
      $('#advanced .content').slideDown();
    }
  })
})
