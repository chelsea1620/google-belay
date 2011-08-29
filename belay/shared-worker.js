var station = undefined;

var numConnects = 0;

self.addEventListener('connect', function(e) { 
  var port = e.ports[0];

  if (!station) {
    port.postMessage({ op: 'needStation' });
    port.postMessage({ op: 'log', msg: [ "Number of connections", 
                                          ++numConnects ] });
  }
});
