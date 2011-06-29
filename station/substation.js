var instance;
var tunnel;
var capServer = new os.CapServer();

var resolver = function(instID) {
  if (!instance || !instance.capServer) {
    return tunnel.sendInterface;
  }
  if (instID === instance.capServer.instanceID) {
    return instance.capServer.publicInterface;
  }
  return tunnel.sendInterface;
};

capServer.setResolver(resolver);

tunnel = new os.CapTunnel(os.window.opener);
tunnel.setLocalResolver(resolver);

var setupCapServer = function(inst) {
  var instServer;
  if ('capSnapshot' in inst.info) {
    instServer = new os.CapServer(inst.info.capSnapshot);
  }
  else {
    instServer = new os.CapServer();
  }
  inst.capServer = instServer;
  instServer.setResolver(resolver);
};

var setupInstance = function(seedSers) {
  console.log('SeedSers: ', seedSers);
  var seedCap = capServer.restore(seedSers[0]);
  var restoreCap = capServer.restore(seedSers[1]);

  seedCap.get(function(instInfo) {
    var inst = {
      icap: seedCap,
      info: instInfo
    };
    setupCapServer(inst);
    inst.id = inst.capServer.instanceID; // TODO(joe): transitive hack!
    instance = inst;
    launchInstance(inst, restoreCap);
  });
};

os.jQuery.ajax({
  url: 'http://localhost:9001/substation.html',
  dataType: 'text',
  success: function(data, status, xhr) {
    console.log('Tunnel: ', tunnel);
    os.topDiv.html(data);
    tunnel.setOutpostHandler(function(message) {
      console.log('Outpost message: ', message);
      setupInstance(message.seedSers);
    });
  },
  error: function(xhr, status, error) {
    os.alert('Failed to load station: ' + status);
  }
});

var isDirty = false;
var dirtyProcess = function() {
  if (!instance) { return; }
  instance.info.capSnapshot = instance.capServer.snapshot();
  instance.icap.post(instance.info);
  isDirty = false;
};
var dirty = function() {
  if (isDirty) { return; }
  isDirty = true;
  os.setTimeout(dirtyProcess, 1000);
};

var launchInstance = function(inst, restoreCap) {
  var instInfo = inst.info;
  var top = os.topDiv.find('#substation-container');
  var header = os.topDiv.find('.belay-container-header');

  header.append('<div class="belay-control">↙</div>');
  var popInButton = header.find(':last-child');

  popInButton.click(function() {
    inst.info.capSnapshot = inst.capServer.snapshot();
    inst.info.remote = false;
    inst.icap.post(inst.info, function(_) {
      restoreCap.get(function() {
        os.poof();
      });
    });
  });
  popInButton.hover(function() { popInButton.addClass('hover'); },
                    function() { popInButton.removeClass('hover'); });

  top.width(inst.info.window.width || '50em')
     .height(inst.info.window.height || '50em');


  var extras = {
    storage: {
      get: function() { return instInfo.data; },
      put: function(d) { instInfo.data = d; dirty(inst); }
    },
    capServer: inst.capServer,
    ui: {
      resize: function(minWidth, minHeight, isResizable) {
        // Do not think we can make an OS window un-resizable.
        if (isResizable) { return; }
        else {
          top.width(minWidth || '50em').height(minHeight || '50em');
        }
      },
      capDraggable: function() { /* TODO: implement */ },
      capDroppable: function() { /* TODO: implement */ }
    }
  };

  os.foop(instInfo.iurl, top, extras);
};

