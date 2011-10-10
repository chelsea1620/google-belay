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

onBelayReady(function() {
  var belayData = capServer.dataPostProcess(localStorage['belay']);
  if (belayData && 'stationLaunchCap' in belayData && belayData.stationLaunchCap) {
    $('#open-button').show();
  }
  else {
    $('#create-button').show();
  }

  $('#advanced h2').click(function() { $('#advanced .content').slideToggle(); })

})
