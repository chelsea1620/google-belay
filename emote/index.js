$(function() {
  $(document.body).find('#new-emote').click(function(evt) {
    console.log('clicked');
    $.ajax({
      url: '/belay/generate',
      dataType: 'text',
      success: function(data, status, xhr) {
        belayPort.postMessage({ 
					type: 'instanceRequest', 
					gen: JSON.stringify({value: {
						launch: JSON.parse(data).value,
						icon: 'http://localhost:9005/tool-emote.png',
						name: 'Emote' 
					}})
				});
      },
      failure: function() {
        alert('Failed to generate instance');
      }
    });
  });
})
