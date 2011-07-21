$(function() {
  $(document.body).find('#new-emote').click(function(evt) {
    console.log('clicked');
    $.ajax({
      url: '/belay/generate-instance',
      dataType: 'text',
      success: function(data, status, xhr) {
        belayPort.postMessage({ 
          type: 'instanceRequest', 
          gen: data
        });
      },
      failure: function() {
        alert('Failed to generate instance');
      }
    });
  });
})
