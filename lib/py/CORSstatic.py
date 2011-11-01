# Copyright 2011 Google Inc. All Rights Reserved.
# 
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

#!/usr/bin/env python

import os
import os.path
import sys

# This script simply responds with static content, but sets the 
# Access-Control-Allow-Origin header to allow this content to be served to
# cross-domain XHR requests, as required by the by Belay protocols

# Alas, this means that we have to duplicate the lovely suport for static
# content that AppEngine already provides. In particular we need to support
# MIME Type sniffing, and add appropriate headers for caching.

pathInfo = os.environ['PATH_INFO'][1:] # strip leading slash
extension = os.path.splitext(pathInfo)[1]

mimeTypeMap = {
  '.html':  'text/html;charset=UTF-8',
  '.js':    'text/javascript;charset=UTF-8',
  '.css':   'text/css;charset=UTF-8',

  '.png':   'image/png',
  '.gif':	'image/gif'
}

if extension not in mimeTypeMap:
  print os.environ['SERVER_PROTOCOL'],"500 Unknown static file extension"
  sys.exit()

basePath = os.path.dirname(os.path.dirname(os.path.dirname(os.environ['PATH_TRANSLATED'])))
	# presumes that this script is two levels below the root of the application
filePath = os.path.join(basePath,pathInfo)

f = open(filePath, 'rb')
content = f.read()
f.close()

contentType = mimeTypeMap[extension]
contentLength = len(content)

print "Access-Control-Allow-Origin: *"
print "Cache-Control: no-cache"
print "Content-Type:", contentType
print "Content-Length:", contentLength
print "Expires: Fri, 01 Jan 1990 00:00:00 GMT"
print ""

sys.stdout.write(content)
