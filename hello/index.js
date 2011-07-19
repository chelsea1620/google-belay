window.addEventListener('load', function() {
  $.ajax({
    url: '/belay/generate',
    dataType: 'text',
    success: function(data, status, xhr) {
      window.setTimeout(function() {
				belayPort.postMessage({ 
					type: 'instanceRequest', 
					gen: JSON.stringify({value: {
							launch: JSON.parse(data).value,
							icon: 'http://localhost:9002/tool-hello.png',
							name: 'Hello' 
					}})
				});
			}, 500);
		},
    failure: function() {
      alert('Failed to generate instance');
    }
  });
});
