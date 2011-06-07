#!/usr/bin/env python

import os
import sys
import uuid

acct_id = os.environ['QUERY_STRING']
acct_uuid = None
acct_new = False

if acct_id != "":
  try:
    acct_uuid = uuid.UUID(acct_id)
  except:
    print os.environ['SERVER_PROTOCOL'],"404 Not Found"
    sys.exit()
else:
  # should redirect to "get you an account"
  print os.environ['SERVER_PROTOCOL'],"404 Not Found"
  sys.exit()

template = """
var $ = os.jQuery;

var app = {
  caps: {
    data: "http://localhost:9001/data?%(acct_id)s",
  }
};

$.ajax({
  url: "http://localhost:9001/station.js",
  dataType: "text",
  success: function(data, status, xhr) {
    cajaVM.compileModule(data)({os: os, app: app});
  },
  error: function(xhr, status, error) {
    alert("Failed to load station: " + status);
  }
});
"""

# would be simpler to do this with JSON, but then have to include Django
# to get to the json serializer...

content = template % {
  'acct_id': acct_id,
  'acct_new': 'true' if acct_new else 'false'
}
contentType = "text/javascript;charset=UTF-8"
contentLength = len(content)

print "Access-Control-Allow-Origin: *"
print "Cache-Control: no-cache"
print "Content-Type:", contentType
print "Content-Length:", contentLength
print "Expires: Fri, 01 Jan 1990 00:00:00 GMT"
print ""

sys.stdout.write(content)
