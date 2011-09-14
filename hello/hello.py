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


os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
from django.template.loader import render_to_string

def server_url(path):
  return belay.this_server_url_prefix() + path

class HelloData(db.Model):
  lang = db.TextProperty()


class ViewHandler(belay.BcapHandler):
  def get(self):
    content = \
      render_to_string("hello-gadget.html", { 'url': server_url("/hello.css") })
    self.xhr_content(content, "text/html;charset=UTF-8")


class GenerateHandler(belay.BcapHandler):
  def get(self):
    hello = HelloData()
    hello.put()
    self.bcapResponse(belay.regrant(LaunchHandler, hello))


class GenerateInstanceHandler(belay.BcapHandler):
  def get(self):
    hello = HelloData()
    hello.put()
    self.bcapResponse({
      'launch': belay.regrant(LaunchHandler, hello),
      'icon': server_url("/tool-hello.png"), 
      'name': 'Hello'
    })


class LaunchHandler(belay.CapHandler):
  def get(self):
    self.bcapResponse({
        'page': {
          'html': server_url("/hello-belay.html"),
          'window': { 'width': 300, 'height': 250 }
        },
        'gadget': {
          'html': server_url("/view/gadget"),
          'scripts': [ server_url("/hello.js") ]
        },
        'info': { 
          'lang': self.get_entity().lang,
          'setLang': belay.regrant(LaunchHandler, self.get_entity())

        }
      })

  def put(self):
    hello = self.get_entity()
    hello.lang = self.bcapRequest()
    hello.put()
    self.bcapNullResponse()


application = webapp.WSGIApplication(
  [(r'/cap/.*', belay.ProxyHandler),
  ('/belay/generate', GenerateHandler),
  ('/belay/generate-instance', GenerateInstanceHandler),
  ('/view/gadget', ViewHandler),
  ],
  debug=True)
  

belay.set_handlers(
  '/cap',
  [ ('/belay/launch', LaunchHandler),
  ])

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
