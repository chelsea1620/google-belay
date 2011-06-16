#!/usr/bin/env python

import os
import sys
import uuid

acct_uuid = uuid.uuid4()
acct_id = str(acct_uuid)

content = "http://" + os.environ['HTTP_HOST'] + "/?" + acct_id
contentLength = len(content)
contentType = "text/plain"

print "Access-Control-Allow-Origin: *"
print "Cache-Control: no-cache"
print "Content-Type:", contentType
print "Content-Length:", contentLength
print "Expires: Fri, 01 Jan 1990 00:00:00 GMT"
print ""

sys.stdout.write(content)
