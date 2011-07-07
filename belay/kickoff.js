var foop = function(sourceURL, node, extras) {
  // insert a div into the node, and foop the source into existance there

  $.ajax({
    url: sourceURL,
    dataType: 'text',
    success: function(data, status, xhr) {
      var jq = {
        // A sanitized jQuery object
        ajax: jQuery.ajax,
        parseQuery: jQuery.parseQuery
      };
      var js = {
        // A sanitized JSON object
        stringify: JSON.stringify,
        parse: JSON.parse
      };

      var os = {
        topDiv: $('<div></div>').prependTo(node),
        jQuery: jq,
        JSON: js,

        // can't just pass these, you have to wrap them for some reason
        alert: function(s) { alert(s); },
        setTimeout: function(f, s) { return setTimeout(f, s); },
        setInterval: function(f, s) { return setInterval(f, s); },
        clearTimeout: function(t) { clearTimeout(t); },
        clearInterval: function(t) { clearInterval(t); },
        FormData: FormData,

        foop: foop,
        poof: function() { window.close(); },

        CapServer: CapServer,
        CapTunnel: CapTunnel,
        window: {
          open: function(url, name, success, failure) {
            var port = windowManager.open('http://localhost:9000/subbelay?url=' +
                encodeURI(url), name);
            success(port);
          },
          opener: window.opener ? window.openerPort : undefined,
          gmail: function(to, subject, body) {
            var makeGmailLink = function(to, subject, body) {
              return 'https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=' +
                     to +
                     '&su=' + subject + '&body=' + encodeURIComponent(body) +
                     '&zx=RANDOMCRAP&shva=1&disablechatbrowsercheck=1&ui=1';
            };
            windowManager.open(makeGmailLink(to, subject, body));
          },
          serverBase: window.location.host
        }

      };

      if (extras) {
        for (p in extras) {
          os[p] = extras[p];
        }
      }

      cajaVM.compileModule(data)({os: os});
    },
    error: function(xhr, status, error) {
      alert('Failed to kickoff: ' + status);
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

