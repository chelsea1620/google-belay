var foop = function(sourceURL, node, extras) {
	// insert a div into the node, and foop the source into existance there

	$.ajax({
		url: sourceURL,
		dataType: "text",
		success: function(data, status, xhr) {
			var jq = {
				// A sanitized jQuery object
				ajax: jQuery.ajax
			};
			var js = {
			  // A sanitized JSON object
			  stringify: JSON.stringify,
			  parse: JSON.parse
			}

			var os = {
				topDiv: $('<div></div>').prependTo(node),
				jQuery: jq,
				JSON: js,
				
				// can't just pass these, you have to wrap them for some reason
				alert: function(s) { alert(s); },
				setTimeout: function(f, s) { setTimeout(f, s); },
				clearTimeout: function(t) { clearTimeout(t); },
				
				foop: foop,
				CapServer: CapServer,
			};
			
			if (extras) {
  			for (p in extras) {
  			  os[p] = extras[p];
  			}
			}

      cajaVM.compileModule(data)({os: os});
		},
		error: function(xhr, status, error) {
			alert("Failed to kickoff: " + status);
		}
	});
};


(function() {
  var DEBUG = true;
  
  whitelist['foop'] = true;
  if (DEBUG) {
    whitelist['console'] = 'skip';
  }

  startSES(window, whitelist, atLeastFreeVarNames, DEBUG);
})();

