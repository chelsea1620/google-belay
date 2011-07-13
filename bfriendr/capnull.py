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

import lib.belay as Belay

from google.appengine.ext import db
from google.appengine.ext import webapp

capPrefix = "error://broken/cap/"
privateMap = []

def setHandlers(prefix, map):
  global capPrefix, privateMap
  capPrefix = prefix
  privateMap = map

  
class Handler(Belay.CapHandler):
  def __init__(self, path, entity):
    self.private = {
      'path': path,
      'entity': entity
      }
  
class ProxyHandler(webapp.RequestHandler):
  pass

def grant(path_or_handler, item):
  path = Belay.get_path(path_or_handler)
  return "%s?path=%s&item=%s" % (capPrefix, path, str(item.key()))

def regrant(path, item):
  return grant(path, item)

def revoke(path, item):
  pass
  
def revokeEntity(item):
  pass
