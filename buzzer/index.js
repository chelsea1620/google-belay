$(function() {
  $(document.body).find('#new-buzzer').click(function(evt) {
    console.log('clicked');
    $.ajax({
      url: '/belay/generate',
      dataType: 'text',
      success: function(data, status, xhr) {
        belayPort.postMessage({ 
					type: 'instanceRequest',
					gen: JSON.stringify({value: {
						launch: JSON.parse(data).value,
						icon: 'http://localhost:9004/tool-buzzer.png',
						name: 'Buzzer' 
					}})
				});
      },
      failure: function() {
        alert('Failed to generate instance');
      }
    });
  });
})
