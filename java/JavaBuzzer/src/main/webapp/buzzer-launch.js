onBelayReady(function attachGenerateHandler() {
  $("#create-blog").click(function() {
    $.post('/generate', { 'name': $('#instance-name').val() })
    .success(function(data, status) {
      data = capServer.dataPostProcess(data);
      belay.outpost.becomeInstance.put(data);
    })
    .error(function() {
      alert('failed to generate :-(');
    });
  });
});