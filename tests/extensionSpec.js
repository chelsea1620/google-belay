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

describe('The extension', function() {

  beforeEach(function() {
    waitsFor(function() { return !!window.belay; }, 250);
  });

  it('should round trip to the background page', function() {
    var success = false;
    window.belay.offer('ping', {}, function(v) { console.log('v: ', v);
        success = v === 'pong'; });
    waitsFor(function() { return success; }, 100);
    runs(function() { expect(success).toBe(true); });
  });

  it('should connect offers and accepts', function() {
    var offerInvoked = acceptInvoked = false;
    var offerInfo = acceptInfo = false;
    var offeredCap = false;

    window.belay.offer(['test'], { info: 22 }, 
      function(rcList, info) { 
        offerInvoked = true;
        offerInfo = info.info;
        return 'offering'; 
      });
    window.belay.accept(['test'], { info: 44 },
      function(rcList, info, cap) {
        acceptInvoked = true;
        acceptInfo = info.info;
        offeredCap = cap;
      });

    waitsFor(function() { return offerInvoked && acceptInvoked; }, 1000);
    runs(function() {
      expect(offerInvoked).toBe(true);
      expect(acceptInvoked).toBe(true);

      expect(offeredCap).toBe('offering');

      expect(offerInfo).toBe(44);
      expect(acceptInfo).toBe(22);
    });
  });

  it('should connect accepts and offers', function() {
    var offerInvoked = acceptInvoked = false;
    var offerInfo = acceptInfo = false;
    var offeredCap = false;

    window.belay.accept(['test'], { info: 44 },
      function(rcList, info, cap) {
        acceptInvoked = true;
        acceptInfo = info.info;
        offeredCap = cap;
      });
    window.belay.offer(['test'], { info: 22 }, 
      function(rcList, info) { 
        offerInvoked = true;
        offerInfo = info.info;
        return 'offering'; 
      });

    waitsFor(function() { return offerInvoked && acceptInvoked; }, 1000);
    runs(function() {
      expect(offerInvoked).toBe(true);
      expect(acceptInvoked).toBe(true);

      expect(offeredCap).toBe('offering');

      expect(offerInfo).toBe(44);
      expect(acceptInfo).toBe(22);
    });
  });
});
