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
import uuid

from lib.py.utils import *

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
  print os.environ['SERVER_PROTOCOL'],"404 Not Found"
  sys.exit()


response = {
    'gadget': {
      'html': server_url("/sticky.html"),
      'scripts': [ server_url("/sticky.js") ]
    },
    'info': {
      'data': { '@': server_url('/data?' + note_id) }
    }
  }

bcap_response(response)

