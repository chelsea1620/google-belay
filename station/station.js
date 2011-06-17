var $ = os.jQuery;

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
// Instance Data
//
var instances = {};
  // a map from instanceIDs to
  //  { id: uuid,       -- the id of this instance
  //    icap: url,      -- the URL of where to store/fetch the info
  //    info: { },      -- the stored state of this instance
  //    capServer: caps -- the cap server for this instance
  //  }

var dirtyInstances = [];
var dirtyProcess = function() {
  var instID = dirtyInstances.shift();
  var inst = instances[instID];
  inst.info.capSnapshot = inst.capServer.snapshot();
  $.ajax({
    url: inst.icap,
    data: os.JSON.stringify(inst.info),
    processData: false,
    type: 'POST'
  });
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


//
// CapServers
//
var instanceResolver = function(id) {
  return instances[id] ? instances[id].capServer.publicInterface : null;
};

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
  top.find('.belay-cap-source').addClass('belay-possible');
};
var stopDropHover = function(node, rc) {
  node.removeClass('belay-selected');
  top.find('.belay-cap-source').removeClass('belay-possible');
};



var initialize = function(instanceCaps) {
	var top = os.topDiv;
	var toolbar = top.find('#belay-toolbar');
	var desk = top.find('#belay-desk');

	var protoTool = toolbar.find('.belay-tool').eq(0).detach();
	toolbar.find('.belay-tool').remove(); // remove the rest

	var protoContainer = desk.find('.belay-container').eq(0).detach();
	desk.find('.belay-container').remove(); // remove the rest

	setupDeskSizes(top);

	var nextLeft = 100;
	var nextTop = 50;


	var launchInstance = function(inst) {
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
        		  stop: function(ev,ui) {
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
	          if (container.width() != minWidth || container.height() != minHeight) {
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
	            return cap;
	          }
	        };
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
			stop: function(ev,ui) {
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
	    $.ajax({ url: inst.icap, type: 'DELETE' });
		});
	  closeBox.hover(function() { closeBox.addClass('hover'); },
	                 function() { closeBox.removeClass('hover'); });

    os.foop(instInfo.iurl, holder, extras);
	}

	var showTool = function(info) {
	  $.ajax({
	    url: info.url,
	    dataType: 'text',
	    success: function(data, status, xhr) {
	      var inst = {
	        info: {
  	        iurl: data,
  	        info: undefined,
  	        window: { top: nextTop += 10, left: nextLeft += 20}
  	      }
	      };
    	  setupCapServer(inst);
    	  inst.icap = app.caps.instanceBase + inst.id; // TODO(mzero): hack!
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

	instanceCaps.forEach(function(icap) {
	  $.ajax({
	    url: icap,
  	  dataType: 'json',
	    success: function(instInfo, status, xhr) {
	      var inst = {
	        icap: icap,
	        info: instInfo
	      };
    	  setupCapServer(inst);
    	  inst.id = inst.capServer.instanceID; // TODO(mzero): hack!
	      instances[inst.id] = inst;
    	  launchInstance(inst);
	    },
    	error: function(xhr, status, error) {
    		os.alert('Failed to load instance: ' + status);
    	}
	  });
	});
};

$.ajax({
	url: 'http://localhost:9001/station.html',
	dataType: 'text',
	success: function(data, status, xhr) {
	  os.topDiv.html(data);
  	$.ajax({
  	  url: app.caps.instances,
  	  dataType: 'json',
  	  success: function(data, status, xhr) {
  	    initialize(data);
  	  },
    	error: function(xhr, status, error) {
    		os.alert('Failed to load data: ' + status);
    	}
  	});
	},
	error: function(xhr, status, error) {
		os.alert('Failed to load station: ' + status);
	}
});
