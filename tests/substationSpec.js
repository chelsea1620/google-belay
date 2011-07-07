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

describe('SubStation protocol', function() {
  var tunnel;

  beforeEach(function() {
    var ready;
    var remotePort = windowManager.open('testSubstation.html',
                                        'test_substation');
    tunnel = new CapTunnel(remotePort);
  });

  afterEach(function() {
    runs(function() { windowManager.closeAll(); });
  });

  it('should outpost from the opening side, then respond to invoke', function()
  {
    runs(function() {
      var server = new CapServer();
      tunnel.setLocalResolver(function(instID) {
        return server.publicInterface;
      });
      var otherSideGotResponse = false;
      var cap = server.grant(function(v) {
        if (v === 'Got response') {
          otherSideGotResponse = true;
        }
        return 'invoked';
      });
      tunnel.initializeAsOutpost(server, [cap]);
      waitsFor(function() { return otherSideGotResponse; },
               'response timeout', 250);
    });
  });
});
