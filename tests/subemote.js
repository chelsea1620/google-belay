os.log('Sending 2x fooped post...');
os.cap.post({body: ':-)', via: 'emote'}, function(r) {
  os.cap.post('Got response');
}, function() { os.log('Other end failed'); });
