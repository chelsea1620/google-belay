var PortQueue = function() {
  this.port = undefined;
  this.sendQueue = [];
  this.recvQueue = [];
};

PortQueue.prototype.setPort = function(port) {
  if(this.port) { 
    throw "PortQueue.setPort: Double-set port"; 
  }
  this.port = port;
  var queue = this.sendQueue;
  this.sendQueue = undefined;

  queue.forEach(function(msg) {
    port.postMessage(msg.data, msg.ports);    
  });

  var me = this;
  port.onmessage = function(evt) {
    if(me.onmessage) {
      me.onmessage(evt);
    }
    else {
      me.recvQueue.push(evt);
    }
  };
};

PortQueue.prototype.postMessage = function(data, ports) {
  if(this.port) {
    this.port.postMessage(data, ports);
  }
  else {
    this.sendQueue.push({data: data, ports: ports});
  }
}

Object.defineProperty(PortQueue.prototype, 'onmessage',
  {set: function(handler) {
     this._onmessage = handler;

     if(handler) {
       var queue = this.recvQueue;
       this.recvQueue = [];
       
       queue.forEach(function(evt) {
         handler(evt);
       });
     }
   },
   get: function() { return this._onmessage; }
  });

