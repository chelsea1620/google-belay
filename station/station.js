var $ = os.jQuery;

var capServer = new os.CapServer();
var instancesCap = capServer.restore(app.caps.instances);

var defaultTools = [
    { name: 'Hello',
      icon: 'http://localhost:9002/tool-hello.png',
      url: 'http://localhost:9002/generate'
    },
    { name: 'Sticky',
      icon: 'http://localhost:9003/tool-stickies.png',
      url: 'http://localhost:9003/generate'
    },
    { name: 'Buzzer',
      icon: 'http://localhost:9004/tool-buzzer.png',
      url: 'http://localhost:9004/generate'
    },
    { name: 'Emote',
      icon: 'http://localhost:9005/tool-emote.png',
      url: 'http://localhost:9005/generate'
    },
    { name: 'bfriendr',
      icon: 'http://localhost:9001/tool.png',
      url: 'http://localhost:9009/generate'
    }
  ];

var capture1 = function(f, a) { return function() { return f(a); } };

//
// Desk top area
//
var resizeDesk = function(s) {
  //os.topDiv.find('#belay-station-outer').width(s.w);
  os.topDiv.find('#belay-desk').height(s.h);
  return false;
};
var setupDeskSizes = function(top) {
  var controls = top.find('#belay-controls');
  var deskSizes = {
    small: {w: 600, h: 350},
    medium: {w: 1200, h: 650},
    large: {w: 2200, h: 1200} };
  for (var p in deskSizes) {
    var s = deskSizes[p];
    controls.append('<a href="#">' + p + '</a> ');
    controls.find(':last-child').click(capture1(resizeDesk, s));
  }
};

//
// Testing
//
var setupTestButton = function(top, f) {
  var controls = top.find('#belay-controls');
  controls.append('<a href="#">test</a>');
  controls.find(':last-child').click(f);
};

//
// Instance Data
//
var instances = {};
  // a map from instanceIDs to
  //  { id: uuid,       -- the id of this instance
  //    icap: url,      -- the URL of where to store/fetch the info
  //    info: { },      -- the stored state of this instance
  //    capServer: caps -- the cap server for this instance (if !info.remote)
  //    capTunnel: capt -- the cap tunnel for this instance (if info.remote)
  //  }

var dirtyInstances = [];
var dirtyProcess = function() {
  if (dirtyInstances.length <= 0) { return; }
  var instID = dirtyInstances.shift();
  var inst = instances[instID];
  inst.info.capSnapshot = inst.capServer.snapshot();
  inst.icap.post(inst.info);
  if (dirtyInstances.length > 0) {
    os.setTimeout(dirtyProcess, 1000);
  }
};
var dirty = function(inst) {
  var instID = inst.id;
  if (dirtyInstances.indexOf(instID) >= 0) return;
  dirtyInstances.push(instID);
  if (dirtyInstances.length > 1) return;
  os.setTimeout(dirtyProcess, 1000);
};
var saveK = function(inst, k) {
  var ix = dirtyInstances.indexOf(inst.id);
  if (ix == -1) { k(); }
  else {
    inst.info.capSnapshot = inst.capServer.snapshot();
    dirtyInstances.splice(ix, 1);
    inst.icap.post(inst.info, k);
  }
};

//
// CapServers
//
var instanceResolver = function(id) {
  if (instances[id] && !instances[id].info.remote) {
    return instances[id].capServer.publicInterface;
  }
  if (instances[id] && instances[id].info.remote) {
    return instances[id].capTunnel.sendInterface;
  }
  if (id === capServer.instanceID) {
    return capServer.publicInterface;
  }
  return null;
};

capServer.setResolver(instanceResolver);

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
  capServer.setResolver(instanceResolver);
};

var setupCapTunnel = function(instID, port) {
  var tunnel = new os.CapTunnel(port);
  var instance;
  if (instances[instID]) {
    instance = instances[instID];
  }
  else { throw 'Creating a tunnel for non-existent instanceID!'; }

  instance.capServer = undefined;
  instance.capTunnel = tunnel;

  var restoreCap = capServer.grant(function() {
    getAndLaunchInstance(instance.icap);
    return true;
  });

  tunnel.setLocalResolver(instanceResolver);
  tunnel.initializeAsOutpost(capServer, [instance.icap, restoreCap]);
};


//
// Dragging Support
//
var capDraggingInfo;
  // HACK: only works so long as only one drag in process at a time

var startDrag = function(info) {
  capDraggingInfo = info;
  info.node.addClass('belay-selected');
};
var stopDrag = function(info) {
  capDraggingInfo = undefined;
  info.node.removeClass('belay-selected');
};
var startDropHover = function(node, rc) {
  node.addClass('belay-selected');
  var sources = os.topDiv.find('.belay-cap-source');
  for (var i = 0; i < sources.length; ++i) {
    var s = sources.eq(i);
    if (s.data('rc') == rc) s.addClass('belay-possible');
  }
};
var stopDropHover = function(node, rc) {
  node.removeClass('belay-selected');
  os.topDiv.find('.belay-cap-source').removeClass('belay-possible');
};

var desk = undefined;
var protoContainer = undefined;

var launchInstance = function(inst) {
  // TODO(jpolitz) check if inst.info claims to be remote, and pop out
  var instInfo = inst.info;
  var container = protoContainer.clone();
  var header = container.find('.belay-container-header');
  var holder = container.find('.belay-container-holder');
  holder.empty();
  container.appendTo(desk);
  container.css('left', instInfo.window.left)
           .css('top', instInfo.window.top)
           .width(instInfo.window.width || '10em')
           .height(instInfo.window.height || '6em');
  var extras = {
    storage: {
      get: function() { return instInfo.data; },
      put: function(d) { instInfo.data = d; dirty(inst); }
    },
    capServer: inst.capServer,
    ui: {
      resize: function(minWidth, minHeight, resizable) {
        if (resizable) {
          container.resizable({
            containment: desk,
            handles: 'se',
            minWidth: minWidth,
            minHeight: minHeight,
            stop: function(ev, ui) {
              instInfo.window.width = container.width();
              instInfo.window.height = container.height();
              dirty(inst);
            }
          });
          if (container.width() < minWidth) container.width(minWidth);
          if (container.height() < minHeight) container.height(minHeight);
        }
        else {
          container.resizable('destroy');
          if (container.width() != minWidth ||
              container.height() != minHeight) {
            container.width(minWidth);
            container.height(minHeight);
            instInfo.window.width = container.width();
            instInfo.window.height = container.height();
            dirty(inst);
          }
        }
      },
      capDraggable: function(node, rc, generator) {
        var helper = node.clone();
        var info = {
          node: node,
          resourceClass: rc,
          generator: function(rc) {
            var cap = generator(rc);
            dirty(inst);
            return cap.serialize();
          }
        };
        node.data('rc', rc);
        node.draggable({
          appendTo: desk,
          helper: function() { return helper; },
          start: function() { startDrag(info); },
          stop: function() { stopDrag(info); },
          scope: rc,
          zIndex: 9999
        });
        node.addClass('belay-cap-source');
      },
      capDroppable: function(node, rc, acceptor) {
        node.droppable({
          scope: rc,
          activeClass: 'belay-possible',
          hoverClass: 'belay-selected',
          drop: function(evt, ui) {
            var info = capDraggingInfo;
            var result = acceptor(info.generator(info.resourceClass));
          }
        });

        // Note:  Without preventDf on dragenter and dragover, the
        // browser will not send the drop event
        var preventDf = function(e) {
          e.originalEvent.preventDefault();
          return false;
        };
        node.bind('dragenter', preventDf);
        node.bind('dragover', preventDf);
        node.bind('drop', function(e) {
          if (!e.originalEvent.dataTransfer) return;
          var data = e.originalEvent.dataTransfer.getData('text/plain');
          if (!data)
            data = e.originalEvent.dataTransfer.getData('text/uri-list');
          if (!data) return;
          var qLoc = data.indexOf('?');
          data = qLoc == -1 ? data : data.slice(qLoc);
          var params = os.jQuery.parseQuery(data);
          var scope = params.scope;
          var cap = params.cap;

          if (scope == rc) {
            acceptor(capServer.restore(cap));
          }
        });

        node.addClass('belay-cap-target');
        node.hover(
          function() { startDropHover(node, rc); },
          function() { stopDropHover(node, rc); });
      }
    }
  };

  container.draggable({
    containment: desk,
    cursor: 'crosshair',
    // handle: container.find('.belay-container-header'),
    stack: '.belay-container',
    stop: function(ev, ui) {
      instInfo.window.left = container.css('left');
      instInfo.window.top = container.css('top');
      dirty(inst);
    }
  });

  header.append('<div class="belay-control">×</div>');
  var closeBox = header.find(':last-child');
  closeBox.click(function() {
    inst.capServer.revokeAll();
    delete instances[inst.id];
    container.hide(function() { container.remove(); });
    inst.icap.remove(function() {}, function() {});
  });
  closeBox.hover(function() { closeBox.addClass('hover'); },
                 function() { closeBox.removeClass('hover'); });

  header.append('<div class="belay-control">↑</div>');
  var maxBox = header.find(':last-child');
  maxBox.click(function() {
    container.hide(function() { container.remove(); });
    launchExternal(inst);
  });
  maxBox.hover(function() { maxBox.addClass('hover'); },
               function() { maxBox.removeClass('hover'); });

  dirty(inst);

  os.foop(instInfo.iurl, holder, extras);
};

var launchExternal = function(inst) {
  inst.info.remote = true;
  dirty(inst);
  saveK(inst, function() {
    os.window.open('http://localhost:9001/substation.js', inst.id,
        function(port) { setupCapTunnel(inst.id, port); },
        function() { os.alert('Oh noes!  No port'); });
  });
};

var getAndLaunchInstance = function(icap) {
  icap.get(function(instInfo) {
    var inst = {
      icap: icap,
      info: instInfo
    };
    setupCapServer(inst);
    inst.id = inst.capServer.instanceID; // TODO(mzero): hack!
    instances[inst.id] = inst;
    if (instInfo.remote) launchExternal(inst);
    else launchInstance(inst);
  },
  function(status) { os.alert('Failed to load instance: ' + status); });
};

var initialize = function(instanceCaps) {
  var top = os.topDiv;
  var toolbar = top.find('#belay-toolbar');
  desk = top.find('#belay-desk');

  var protoTool = toolbar.find('.belay-tool').eq(0).detach();
  toolbar.find('.belay-tool').remove(); // remove the rest

  protoContainer = desk.find('.belay-container').eq(0).detach();
  desk.find('.belay-container').remove(); // remove the rest

  setupDeskSizes(top);
  setupTestButton(top, function() { os.alert('test!'); });

  var nextLeft = 100;
  var nextTop = 50;


  var showTool = function(info) {
    $.ajax({
      url: info.url,
      dataType: 'text',
      success: function(data, status, xhr) {
        var inst = {
          info: {
            remote: false,
            iurl: data,
            info: undefined,
            window: { top: nextTop += 10, left: nextLeft += 20}
          }
        };
        setupCapServer(inst);
        // TODO(arjun) still a hack. Should we be concatenaing URLs here?
        inst.icap = capServer.grant(app.caps.instanceBase + inst.id);
        instances[inst.id] = inst;
        launchInstance(inst);
        dirty(inst);
      },
      error: function(xhr, status, error) {
        os.alert('Failed to showTool ' + info.name + ', status = ' + status);
      }
    });
  }

  defaultTools.forEach(function(toolInfo) {
    var tool = protoTool.clone();
    tool.find('p').text(toolInfo.name);
    tool.find('img').attr('src', toolInfo.icon);
    tool.appendTo(toolbar);
    tool.click(capture1(showTool, toolInfo));
  });

  instanceCaps.forEach(getAndLaunchInstance);
};

// TODO(arjun): Retreiving vanilla HTML. Not a Belay cap?
$.ajax({
  url: 'http://localhost:9001/station.html',
  dataType: 'text',
  success: function(data, status, xhr) {
    os.topDiv.html(data);
    instancesCap.get(initialize, function(err) { os.alert(err.message); });
  },
  error: function(xhr, status, error) {
    os.alert('Failed to load station: ' + status);
  }
});
