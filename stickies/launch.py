#!/usr/bin/env python

import os
import sys
import uuid

note_id = os.environ['QUERY_STRING']
note_uuid = None
note_new = False

if note_id != "":
  try:
    note_uuid = uuid.UUID(note_id)
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
    data: "http://%(host)s/data?%(note_id)s",
  }
};

$.ajax({
  url: "http://%(host)s/sticky.js",
  dataType: "text",
  success: function(data, status, xhr) {
    cajaVM.compileModule(data)({os: os, app: app});
  },
  error: function(xhr, status, error) {
    alert("Failed to load sticky: " + status);
  }
});
"""

# would be simpler to do this with JSON, but then have to include Django
# to get to the json serializer...

content = template % {
  'note_id': note_id,
  'note_new': 'true' if note_new else 'false',
  'host': os.environ['HTTP_HOST']
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
