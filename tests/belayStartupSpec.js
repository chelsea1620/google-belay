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


describe("Startup and Routing Interface", function() {
  
  function makeFrame(src) {
	  var iframe = document.createElement('iframe');
	  iframe.src = src;
	  document.body.appendChild(iframe);
	  return iframe;
	}
	
	var handoffData = null;
	var client = null;
	var server = null;
	var clientInvoke = null;
	var testData = "from-test";
  
	window.handoff = function(data) {
	  handoffData = data;
  };
  
  window.clientReady = function(invoke) {
    clientInvoke = invoke;
  }
	  
  beforeEach(function() {
    handoffData = clientInvoke = null;
  	client = makeFrame('startup/route-client.html');
  	waitsFor(function() { return clientInvoke; }, "client invoke function", 2000);
  });
  
  afterEach(function() {
    document.body.removeChild(client);
  	document.body.removeChild(server);
  	handoffData = client = server = null;
  })

  it("shouldn't break normal invocations", function() {
    
    server = makeFrame('startup/route-old.html');
	  waitsFor(function() { return handoffData; }, "handoff data", 2000);
    
    runs(function() {
      mkRunner(clientInvoke).runsPostAndExpect({
          ser: handoffData,
          arg: testData
        }, {
          arg: testData,
          name: "route-old"
        });
    })
	});
	
	it("should work with the new route", function() {
    
    server = makeFrame('startup/route-new.html');
	  waitsFor(function() { return handoffData; }, "handoff data", 2000);
	  runs(function() {
	    expect(typeof handoffData.normalServerInstId).toBe('string');
	    expect(typeof handoffData.routeServerInstId).toBe('string');
	    expect(handoffData.normalServerInstId).not.toEqual(handoffData.routeServerInstId);
	    
	    expect(newInstanceId(handoffData.preImg)).toBe(handoffData.routeServerInstId);
	    
      mkRunner(clientInvoke).runsPostAndExpect({
      	  ser: handoffData.cap,
      	  arg: testData
      	}, {
          arg: testData,
          name: "route-new"
        });
  	});
  	
	});

  it("should work with just a call to route", function() {
    server = makeFrame('startup/route-only.html');
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      mkRunner(clientInvoke).runsPostAndExpect({
          ser: handoffData,
          arg: testData
        }, {
          arg: testData,
          name: "route-only"
        });
    });
  });

  it("should allow multiple calls to route", function() {
    server = makeFrame('startup/route-twice.html');
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      expect(handoffData.cs1Id).not.toBe(handoffData.cs2Id);
      mkRunner(clientInvoke).runsPostAndExpect({
          ser: handoffData.cap1,
        }, {
          name: "route-twice-cap-1"
        });
      mkRunner(clientInvoke).runsPostAndExpect({
          ser: handoffData.cap2,
        }, {
          name: "route-twice-cap-2"
        });
    });
  });

  it("should fail on multiple calls to route with same ident", function() {
    server = makeFrame('startup/route-twice-same.html');
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      expect(typeof handoffData.error).toBe('object');
      expect(handoffData.error.status).toBe(500);
      mkRunner(clientInvoke).runsPostAndExpect({
          ser: handoffData.cap,
        }, {
          name: "route-twice-same-cap"
        });
    });
  });
	
	it("should work if you shut down and restart the page", function() {
	  var preImg= null;
	  var originalCap = null;
    
    server = makeFrame('startup/route-new.html');
	  waitsFor(function() { return handoffData; }, "handoff data", 2000);
	  runs(function() {
	    preImg = handoffData.preImg;
	    originalCap = handoffData.cap;
	    document.body.removeChild(server);

	    // This should fail because the server no longer exists
	    var runner = mkRunner(clientInvoke);
	    runner.runsPost({
	      ser: originalCap,
	      arg: testData,
	      name: "route-new"
	    });
	    runner.runsExpectFailure();
  	});
			  
	  runs(function() {
	    var snapshot = handoffData.snapshot;
	    handoffData = null;
	    server = makeFrame('startup/route-existing.html#' + JSON.stringify({preImg: preImg, snapshot: snapshot}));
	  });
	  waitsFor(function() { return handoffData; });

    runs(function() {
  	  // Now invoke the *original* cap at the client	  
  	  mkRunner(clientInvoke).runsPostAndExpect({
    	    ser: originalCap,
    	    arg: testData
    	  }, {
    	    arg: testData,
    	    name: "route-existing"
    	  });
  	});
	});
	
	it("should fail when double-routing in different frames", function() {
	  var preImg= null;
	  var originalCap = null;
	  var revivedServer = null;
    
    server = makeFrame('startup/route-new.html');
	  waitsFor(function() { return handoffData; }, "handoff data", 2000);
	  runs(function() {
	    preImg = handoffData.preImg;
	    originalCap = handoffData.cap;
	    var snapshot = handoffData.snapshot;
	    handoffData = null;
	    revivedServer = makeFrame('startup/route-existing.html#' + JSON.stringify({preImg: preImg, snapshot: snapshot}));
	  });
	  waitsFor(function() { return handoffData; });

    runs(function() {
      // The handoffData should show an error from the revivedServer:
      expect(handoffData.error.status).toBe(500);

  	  // Now invoke the *original* cap, which should still work at route-new
  	  mkRunner(clientInvoke).runsPostAndExpect({
    	    ser: originalCap,
    	    arg: testData
    	  }, {
    	    arg: testData,
    	    name: "route-new"
    	  });
  	});
  	runs(function() {
      //cleanup
  	  document.body.removeChild(revivedServer);
  	})
	});

  it("should start()", function() {
    server = makeFrame("startup/start.html");
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      mkRunner(clientInvoke).runsPostAndExpect({
        ser: handoffData,
        arg: testData
      }, {
        arg: testData,
        name: "start"
      });
    });
  });

  it("should start() twice", function() {
    server = makeFrame("startup/start-twice.html");
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      expect(handoffData.originalServerId).toBe(handoffData.secondServerId);
      mkRunner(clientInvoke).runsPostAndExpect({
        ser: handoffData.cap,
        arg: testData
      }, {
        arg: testData,
        name: "start-twice"
      });
    });
  });

  it("should startForLaunch", function() {
    var preImg = newUUIDv4();
    server = makeFrame("startup/launcher.html#" +
      JSON.stringify({url: "start-launch.html", preImage: preImg, testName: "start-launch"}));
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      mkRunner(clientInvoke).runsPostAndExpect({
        ser: handoffData,
        arg: testData
      }, {
        arg: testData,
        name: "start-launch"
      });
    });
  });

  it("should give an error if the key doesn't exist in startForLaunch", function() {
    var preImg = newUUIDv4();
    server = makeFrame("startup/launcher.html#" +
      JSON.stringify({url: "start-launch.html", NOT_THE_RIGHT_KEY: preImg, name: "start-launch"}));
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      expect(typeof handoffData.message).toBe('string');
      expect(handoffData.status).toBe(404);
    });
  });

  it("should give an error if the instanceId is already routed to in startForLaunch", function() {
    var preImg = newUUIDv4();
    server = makeFrame("startup/launcher.html#" +
      JSON.stringify({url: "start-failed-launch.html", preImage: preImg, name: "start-launch"}));
    waitsFor(function() { return handoffData; }, "handoff data", 2000);
    runs(function() {
      expect(typeof handoffData.message).toBe('string');
      expect(handoffData.status).toBe(500);
    });
  });


});