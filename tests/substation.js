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

var log = function(text) {
  os.$('<li></li>').text(text).appendTo('#transcript');
};

os.$(function() {
  var openerPort = os.window.opener; log('Constructed port');
  var tunnel = new os.CapTunnel(openerPort); log('Constructed tunnel');
  var server = new os.CapServer(); log('Constructed server');
  tunnel.setLocalResolver(function(instID) {
    return server.publicInterface;
  });
  server.setResolver(tunnel.remoteResolverProxy);

  var intervalID;
  var timerID;
  var cap;

  tunnel.setOutpostHandler(function(msg) {
    cap = server.restore(msg.seedSers[0]);
    go();
  });

  function go() {
    cap.post({body: ':-)', via: 'emote'}, function(r) {
      log('Got response (before foop 2): ' + os.JSON.stringify(r));
    }, function() { log('Other end failed'); });
    os.foop('subemote.js', os.$('#invoker'), {$: os.$, log: log, cap: cap});
  }
});
