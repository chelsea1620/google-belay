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
function setEnabled(n, state) { state ? enable(n) : disable(n) }

function setUpLaunchButton(elem, params) {
  var stationHash = '#' + newUUIDv4();
  elem.attr('href', 'redirect.html' + stationHash);
  elem.attr('target', '_blank')
  belay.outpost.setStationLaunchHash.put({ hash: stationHash, params: params });
}

onBelayReady(function() {
  var belayData = capServer.dataPostProcess(localStorage['belay']);
  var hasStation;
  var stationCapString;

  setUpLaunchButton($('#open-button a'), { version: 'new' });
  setUpLaunchButton($('#create-button a'), { version: 'new' });

  $('#create-button a').click(function() {
    belayData.stationGenerateCap =
      capServer.restore($('#advanced .gen:eq(1) input').val());
        // TODO(mzero): change to :first when appspot version is live
    localStorage['belay'] = capServer.dataPreProcess(belayData);
    setTimeout(resetUI, 1000); // TODO(mzero): should be a callback from worker
    // now let the click go on
  })
  
  function resetUI() {
    hasStation = belayData && 'stationLaunchCap' in belayData && belayData.stationLaunchCap;
    stationCapString = hasStation ? belayData.stationLaunchCap.serialize() : '';

    if (hasStation) {
      $('#open-button').show();
      $('#create-button').hide();
    } else {
      $('#open-button').hide();
      $('#create-button').show();
    }

    $('#station-cap').val(stationCapString);
    disable($('#station-set'))
    setEnabled($('#station-clear'), hasStation);
  }

  function setLaunchCap(cap) {
    belayData.stationLaunchCap = cap;
    localStorage['belay'] = capServer.dataPreProcess(belayData);
    resetUI();
  }

  $('#advanced h2').click(function() { 
    if(visible($('#advanced .content'))) {
      $('#advanced .control').text('▸');
      $('#advanced .content').slideUp();
    } else {
      $('#advanced .control').text('▾');
      $('#advanced .content').slideDown();
    }
  });
  
  $('#station-clear').click(function() { setLaunchCap(null); });
  $('#station-set').click(function() { 
    var newVal = $('#station-cap').val().trim();
    var cap = newVal != '' ? capServer.restore(newVal) : null;
    setLaunchCap(cap);
  });
  
  
  $('#station-cap').bind('change keypress keyup keydown click', function () {
    setEnabled($('#station-set'), $('#station-cap').val() != stationCapString);
  });
  
  $('#advanced .gen').each(function() {
    var input = $(this).find('input');
    $(this).find('button').click(function() {
      var gen = capServer.restore(input.val());
      gen.get(
        function(newLaunch) { setLaunchCap(newLaunch); },
        function(err) { alert("Generation failed."); });
    });
  });
  
  resetUI();
})
