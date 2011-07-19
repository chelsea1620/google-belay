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

var PortQueue = function() {
  this.port = undefined;
  this.sendQueue = [];
  this.recvQueue = [];
};

PortQueue.prototype.setPort = function(port) {
  if (this.port) {
    throw 'PortQueue.setPort: Double-set port';
  }
  this.port = port;
  var queue = this.sendQueue;
  this.sendQueue = undefined;

  queue.forEach(function(msg) {
    port.postMessage(msg.data, msg.ports);
  });

  var me = this;
  port.onmessage = function(evt) {
    if (me.onmessage) {
      me.onmessage(evt);
    }
    else {
      me.recvQueue.push(evt);
    }
  };
};

PortQueue.prototype.hasPort = function() { return this.port !== undefined; }

PortQueue.prototype.postMessage = function(data, ports) {
  if (this.port) {
    this.port.postMessage(data, ports);
  }
  else {
    this.sendQueue.push({data: data, ports: ports});
  }
};

Object.defineProperty(PortQueue.prototype, 'onmessage',
  {set: function(handler) {
     this._onmessage = handler;

     if (handler) {
       var queue = this.recvQueue;
       this.recvQueue = [];

       queue.forEach(function(evt) {
         handler(evt);
       });
     }
   },
   get: function() { return this._onmessage; }
  });

