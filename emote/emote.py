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

import datetime
import logging
import os
import sys
import uuid
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app
from lib.py import belay


class EmoteData(db.Model):
  postCap = db.TextProperty()
  nameCap = db.TextProperty()


class GenerateHandler(belay.BcapHandler):
  def post(self):
    bzrInfo = self.bcapRequest()
    emote = EmoteData()
    emote.postCap = bzrInfo['postCap'].serialize()
    emote.nameCap = bzrInfo['nameCap'].serialize()
    emote.put()
    self.bcapResponse({
      'launch': self.cap_server.regrant(LaunchHandler, emote),
      'icon': self.server_url("/tool-emote.png"), 
      'name': 'Emote to ' + bzrInfo['name']
    })


class LaunchHandler(belay.CapHandler):
  def get(self):
    self.bcapResponse({
        'page': {
          'html': self.server_url("/"),
          'window': { 'width': 300, 'height': 250 }
        },
        'gadget': {
          'html': self.server_url("/view/gadget"),
          'scripts': [ self.server_url("/emote.js") ]
        },
        'info': { 
          'post': self.get_entity().postCap,
          'name': self.get_entity().nameCap,
        }
      })


application = webapp.WSGIApplication(
  [(r'/cap/.*', belay.ProxyHandler),
  ('/generate', GenerateHandler),
  ],
  debug=True)
  

belay.set_handlers(
  '/cap',
  [ ('/belay/launch', LaunchHandler),
  ])
