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

"use strict";

// TODO(jasvir): These should be modules not scripts
require([
    "lib/js/include-belay.js", 
    "lib/js/caps.js", 
    "lib/js/common.js",
    "lib/js/belay-client.js"], 
  function () {
  function visible(n) { return n.css('display') != 'none'; };
  function enable(n) { n.removeAttr('disabled'); }
  function disable(n) { n.attr('disabled', 'disabled'); }
  function setEnabled(n, state) { state ? enable(n) : disable(n) }
  
  function setUpLaunchButton(elem, action) {
    var startId = newUUIDv4();
    elem.attr('href', 'redirect.html');
    elem.attr('target', startId);
    belay.outpost.expectPage.post(
      { startId: startId, ready: capServer.grant(action) });
  }
  
  onBelayReady(function() {
    var belayData = capServer.dataPostProcess(localStorage['belay']) || { };
    var hasStation;
    var stationCapString;
  
    function openStation(activate) {
      belayData.stationLaunchCap.post({ version: 'new' },
        function(launchDescriptor) {
          var instanceId = newUUIDv4();
          
          activate.post({
            instanceId: instanceId,
            isStation: true,
            pageUrl: launchDescriptor.pageUrl || launchDescriptor.page.html,
            outpostData: {
              info: launchDescriptor.info,
              instanceId: instanceId,
            }
          });
        },
        function(err) { alert("Your station isn't on-line."); });
    }
  
    function createAndOpenStation(activate) {
      var genCap = capServer.restore($('#advanced .gen:eq(0) input').val());
      genCap.get(function(launchCap){
        setLaunchCap(launchCap);
        openStation(activate);
      })
    }
  
    setUpLaunchButton($('#open-button a'), openStation);
    setUpLaunchButton($('#create-button a'), createAndOpenStation);
  
    $('#open-button a').click(function() {
      // if the user clicks the launch button, we need to reinitialise
      // it so that it can be used again, as the belay infrastructure
      // will forget the startId allocated after the first use.
      setUpLaunchButton($('#open-button a'), openStation);
    });
  
    function resetUI() {
      hasStation = belayData && 'stationLaunchCap' in belayData && belayData.stationLaunchCap != null;
      stationCapString = hasStation ? belayData.stationLaunchCap.serialize() : '';
  
      if (hasStation) {
        $('#open-button').show();
        $('#create-button').hide();
      } else {
        $('#open-button').hide();
        $('#create-button').show();
      }
  
      $('#station-cap').val(stationCapString);
      disable($('#station-set'));
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
  
    window.addEventListener('storage', function(ev) {
      if(ev.storageArea === localStorage && ev.key == 'belay') {
        belayData = capServer.dataPostProcess(localStorage['belay']);
        resetUI();
      }
    });
    
    resetUI();
    window.belaytest.ready = true;
  });
});

