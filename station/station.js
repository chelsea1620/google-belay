var $ = os.jQuery;

var defaultState = {
  // tools are stored as:
  //  { name: string, url: url }
  tools: [
      { name: "Hello",
        icon: "http://localhost:9002/tool-hello.png",
        url: "http://localhost:9002/generate",
      },
      { name: "Sticky",
        icon: "http://localhost:9003/tool-stickies.png",
        url: "http://localhost:9003/generate",
      },
      { name: "Buzzer",
        icon: "http://localhost:9004/tool-buzzer.png",
        url: "http://localhost:9004/generate",
      },
      { name: "Emote",
        icon: "http://localhost:9005/tool-emote.png",
        url: "http://localhost:9005/generate",
      },
    ],
  
  // instances are stored as:
  //   { iurl: url, data: json, window: { top: int, left: int }}
  instances: [
    ],
}

var capture1 = function(f, a) { return function() { return f(a); } }

var resizeDesk = function(s) {
  //os.topDiv.find('#belay-station-outer').width(s.w);
  os.topDiv.find('#belay-desk').height(s.h);
  return false;
}
var setupDeskSizes = function(top) {
  var controls = top.find('#belay-controls');
	var deskSizes = {
	  small: {w: 600, h: 350},
	  medium: {w: 1200, h: 650},
	  large: {w: 2200, h: 1200} };
	for (var p in deskSizes) {
	  var s = deskSizes[p];
	  controls.append('<a href="#">'+p+'</a> ');
	  controls.find(':last-child').click(capture1(resizeDesk, s));
	} 
}
var initialize = function(stationStateJSON) {
  var stationState;
  
  if (stationStateJSON == '') {
    stationState = defaultState;
  }
  else {
    stationState = os.JSON.parse(stationStateJSON);
    // TODO(mzero): should merge tools
    stationState.tools = defaultState.tools;
  }

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


	
	var capServerMap = {}
	var instanceResolver = function(id) { return capServerMap[id] || null; }

  var setupCapServer = function(instInfo) {
  	var capServer;
  	if ('capSnapshot' in instInfo) {
  	  capServer = new os.CapServer(instInfo.capSnapshot);
  	}
  	else {
  	  capServer = new os.CapServer();
  	  dirty();
  	}
  	instInfo.capInstanceID = capServer.instanceID;
  	capServerMap[capServer.instanceID] = capServer;
  	capServer.setInstanceResolver(instanceResolver);
  };
  
  var getCapServer = function(instInfo) {
    return capServerMap[instInfo.capInstanceID];
  };

  var removeCapServer = function(instInfo) {
    capServerMap[instInfo.capInstanceID].revokeAll();
    delete capServerMap[instInfo.capInstanceID];
  };
  
  var updateCapServerState = function() {
    for (var i in stationState.instances) {
      var info = stationState.instances[i];
      info.capSnapshot = capServerMap[info.capInstanceID].snapshot();
    }
  };
	

	var dirtyPending = false;
	var dirty = function () {
	  if (dirtyPending) return;
	  dirtyPending = true;
	  os.setTimeout(function() {
	    dirtyPending = false;
	    updateCapServerState();
  	  $.ajax({
  	    url: app.caps.data,
  	    data: os.JSON.stringify(stationState),
  	    processData: false,
  	    type: 'POST'
  	  });
  	}, 0);
	}
	
	var capDraggingInfo;
	  // HACK: only works so long as only one drag in process at a time

	var startDrag = function (info) {
	  capDraggingInfo = info;
	  info.node.addClass('belay-selected');
	};
	var stopDrag = function (info) {
	  capDraggingInfo = undefined;
	  info.node.removeClass('belay-selected');
	};
	var startDropHover = function (node, rc) {
	  node.addClass('belay-selected');
	  top.find('.belay-cap-source').addClass('belay-possible');
	}
	var stopDropHover = function (node, rc) {
	  node.removeClass('belay-selected');
	  top.find('.belay-cap-source').removeClass('belay-possible');
	}
	
	var launchInstance = function (instInfo) {
		var container = protoContainer.clone();
		var header = container.find('.belay-container-header');
		var holder = container.find('.belay-container-holder');
		holder.empty();
		container.appendTo(desk);
		container.css('left', instInfo.window.left)
						 .css('top', instInfo.window.top)
		         .width(instInfo.window.width || '10em')
		         .height(instInfo.window.height || '6em');
    var capServer = getCapServer(instInfo);
		var extras = {
		  storage: {
		    get: function () { return instInfo.data; },
		    put: function (d) { instInfo.data = d; dirty(); }
	    },
	    capServer: capServer,
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
        		    dirty();
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
      		    dirty();
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
	            dirty();
	            return cap;
	          },
	        };
	        node.draggable({
	          appendTo: desk,
	          helper: function() { return helper; },
	          start: function() { startDrag(info); },
	          stop: function() { stopDrag(info); },
	          scope: rc,
	          zIndex: 9999,
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
			  dirty();
			}
		});
		
		header.append('<div class="belay-control">×</div>');
		var closeBox = header.find(':last-child');
		closeBox.click(function () {
		  var k = stationState.instances.indexOf(instInfo);
		  if (k >= 0) {
		    removeCapServer(instInfo);
		    stationState.instances.splice(k,1);
		    container.hide(function () { container.remove(); });
		    dirty();
		  }
		});
	  closeBox.hover(function () { closeBox.addClass('hover'); },
	                 function () { closeBox.removeClass('hover'); });

    os.foop(instInfo.iurl, holder, extras);
	}
	
	var showTool = function (info) {
	  $.ajax({
	    url: info.url,
	    dataType: "text",
	    success: function(data, status, xhr) {
	      var instInfo = {
	        iurl: data,
	        data: undefined,
	        window: { top: nextTop += 10, left: nextLeft += 20}
	      };
	      stationState.instances.push(instInfo);
    	  setupCapServer(instInfo);
	      launchInstance(instInfo);
	      dirty();
	    },
	    error: function(xhr, status, error) {
	      os.alert("Failed to showTool " + info.name + ", status = " + status);
	    }
	  })
	}

	for (var t in stationState.tools) {
		var toolInfo = stationState.tools[t];
		var tool = protoTool.clone();
		tool.find('p').text(toolInfo.name);
		tool.find('img').attr('src', toolInfo.icon);
		tool.appendTo(toolbar);
		tool.click(capture1(showTool,toolInfo));
	}
	for (var i in stationState.instances) {
	  var instInfo = stationState.instances[i];
	  setupCapServer(instInfo);
	}
	for (var i in stationState.instances) {
	  var instInfo = stationState.instances[i];
	  launchInstance(instInfo);
	}
}

$.ajax({
	url: "http://localhost:9001/station.html",
	dataType: "text",
	success: function(data, status, xhr) {
	  os.topDiv.html(data);
  	$.ajax({
  	  url: app.caps.data,
  	  dataType: "text",
  	  success: function(data, status, xhr) {
  	    initialize(data);
  	  },
    	error: function(xhr, status, error) {
    		os.alert("Failed to load data: " + status);
    	}
  	})
	},
	error: function(xhr, status, error) {
		os.alert("Failed to load station: " + status);
	}
});
