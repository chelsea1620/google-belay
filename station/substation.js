var instance;
var tunnel;
var capServer = new os.CapServer();

var resolver = function(instID) {
  if(instID === instance.instID) {
    return instance.capServer.publicInterface;
  }
  if(instID === capServer.instanceID) {
    return capServer.publicInterface;
  }
  return tunnel.sendInterface;
}

tunnel = new os.CapTunnel(os.window.opener);
tunnel.setLocalResolver(resolver);

function waitOnOutpost(tunnel, success, failure) {
  var onReady = function() { 
    if(tunnel.outpost) { 
      os.clearInterval(intervalID);
      os.clearTimeout(timerID);
      success(tunnel);
    }
  }; 
  var intervalID = os.setInterval(onReady, 100);

  var timerID = os.setTimeout(function() { 
    os.clearInterval(intervalID); 
    failure();
  }, 3000);
}


var setupCapServer = function(inst) {
  var capServer;
  if ('capSnapshot' in inst.info) {
    capServer = new os.CapServer(inst.info.capSnapshot);
  }
  else {
    capServer = new os.CapServer();
    inst.id = capServer.instanceID;
  }
  inst.capServer = capServer;
  capServer.setResolver(resolver);
};

var setupInstance = function(seedSer) {
  var seedCap = capServer.restore(seedSer);
  seedCap.get(function(instInfo) {
    var inst = {
      icap: seedCap,
      info: instInfo
    };
    setupCapServer(inst);
    inst.id = inst.capServer.instanceID; // TODO(joe): transitive hack!
    instance = inst;
    launchInstance(inst); 
  });
}

waitOnOutpost(tunnel,
    function(tunnel) { setupInstance(tunnel.outpost.seedSer); },
    function() {  } );



os.jQuery.ajax({
  url: 'http://localhost:9001/substation.html',
  dataType: 'text',
  success: function(data, status, xhr) {
    os.topDiv.html(data);
  },
  error: function(xhr, status, error) {
    os.alert('Failed to load station: ' + status);
  }
});


var dirty = function() {};

var launchInstance = function(inst) {
  var instInfo = inst.info;
  var top = os.topDiv.find("#substation-container");

  var extras = {
    storage: {
      get: function() { return instInfo.data; },
      put: function(d) { instInfo.data = d; dirty(inst); }
    },
    capServer: inst.capServer,
    ui: {
      resize: function(minWidth, minHeight, isResizable) {
        // Do not think we can make an OS window un-resizable.
        os.topDiv.width(minWidth || '50em')
                 .height(minHeight || '50em');
      },
      capDraggable: function() { /* TODO: implement */ },
      capDroppable: function() { /* TODO: implement */ }
    }
  };

  os.foop(instInfo.iurl, top, extras);
}

