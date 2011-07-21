window.addEventListener('load', function() {
  $.ajax({
    url: '/belay/generate-instance',
    dataType: 'text',
    success: function(data, status, xhr) {
      window.setTimeout(function() {
				belayPort.postMessage({ 
					type: 'instanceRequest', 
					gen: data});
			}, 500);
		},
    failure: function() {
      alert('Failed to generate instance');
    }
  });
});
