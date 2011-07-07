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
import sys

content = "http://" + os.environ['HTTP_HOST'] + "/hello.js"
contentLength = len(content)
contentType = "text/plain"

print "Access-Control-Allow-Origin: *"
print "Cache-Control: no-cache"
print "Content-Type:", contentType
print "Content-Length:", contentLength
print "Expires: Fri, 01 Jan 1990 00:00:00 GMT"
print ""

sys.stdout.write(content)
