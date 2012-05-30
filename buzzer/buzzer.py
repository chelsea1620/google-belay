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
import json
import logging
import os
import sys
import uuid

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
from django.template.loader import render_to_string

from lib.py import belay

class FeedData(db.Model):
  title = db.StringProperty()
  name = db.StringProperty()
  location = db.StringProperty()
  client_preimg = db.StringProperty()


class SnapshotData(db.Model):
  snapshot = db.TextProperty()
  
  
class ItemData(db.Model):
  when = db.DateTimeProperty(auto_now_add=True);
  body = db.TextProperty(required=True);
  via = db.TextProperty();
  
  def nicedate(self):
    date = self.when
    today = datetime.datetime.now()
    date_ordinal = date.toordinal()
    today_ordinal = today.toordinal()
    format = ""
    if date_ordinal == today_ordinal:
      format = "today"
    elif date_ordinal == today_ordinal - 1:
      format = "yesterday"
    elif date_ordinal > today_ordinal - 7:
      format = '%a'
    elif date.year == today.year:
      format = '%a, %b %d'
    else:
      format = '%a, %b %d %Y'
    format += ' - %I:%M %p'
    return date.strftime(format)    


class GenerateHandler(belay.BcapHandler):
  def post(self):
    feed = FeedData()
    feed.title = self.request.POST['title']
    feed.client_preimg = str(uuid.uuid4())
    feed.put()
    snapshot = SnapshotData(parent=feed)
    snapshot.put()
    
    response = {
      'launch': self.cap_server.regrant(LaunchHandler, feed),
      'icon': self.server_url("/tool-buzzer.png"),
      'name': feed.title
    }

    self.bcapResponse(response)


class GenerateReaderHandler(belay.CapHandler):
  def get(self):
    feed = self.get_entity()
    response = {
        'launch': self.cap_server.regrant(LaunchReaderHandler, feed),
        'name': 'buzz about ' + feed.title,
        'icon': self.server_url('/tool-buzzer.png')
    };
    self.bcapResponse(response)


class LaunchHandler(belay.CapHandler):
  def get(self):
    feed = self.get_entity()
    snapshot = SnapshotData.all().ancestor(feed).get()

    response = {
      'page': {
        'html': self.server_url('/buzzer-belay.html'),
        'window': { 'width': 300, 'height': 400 } 
      },
      'gadget': {
        'html': self.cap_server.regrant(EditorViewHandler, feed).serialize(),
        'scripts': [ self.server_url("/buzzer.js") ]
      },
      'info': {
        'client_preimg': feed.client_preimg,
        'post_cap': self.cap_server.regrant(DataPostHandler, feed),
        'snapshot_cap': self.cap_server.regrant(SnapshotHandler, snapshot),
        'snapshot': snapshot.snapshot,
        'reader_gen_cap': self.cap_server.regrant(GenerateReaderHandler, feed),
        'editor_cap': self.cap_server.regrant(EditorViewHandler, feed),
        'readChitURL': self.server_url("/chit-24.png"),
        'postChitURL': self.server_url("/chit-25.png")
      },
      'attributes': {
        'set': self.cap_server.regrant(SetAttributesHandler, feed)
      }
    }

    self.bcapResponse(response)    


class LaunchReaderHandler(belay.CapHandler):
  def get(self):
    feed = self.get_entity()

    response = {
      'page': {
        'html': self.server_url('/buzzer-belay.html'),
        'window': { 'width': 300, 'height': 400 } 
      },
      'gadget': {
        'html': self.cap_server.regrant(ReaderViewHandler, feed).serialize(),
        'scripts': [ self.server_url("/buzzer.js") ]
      },
      'info': {
        'client_preimg': str(uuid.uuid4()),
        'editor_cap': self.cap_server.regrant(ReaderViewHandler, feed),
      }
    }

    self.bcapResponse(response)


class ViewHandler(belay.CapHandler):
  def get(self):
    feed = self.get_entity()
    need_profile = feed.title is None
    has_name = feed.name and feed.name != ''
    has_location = feed.location and feed.location != ''
    
    q = ItemData.all();
    q.ancestor(feed);
    q.order('-when');
    items = q.fetch(10);
    
    self.render_to_response('buzzer.tmpl',
      { 'css_url': self.server_url('/buzzer.css'),
        'chit_read_url': self.server_url('/chit-24.png'),
        'chit_post_url': self.server_url('/chit-25.png'),
        'post_url': self.cap_server.regrant(DataPostHandler, feed).serialize(),
        'profile_url': self.cap_server.regrant(DataProfileHandler, feed).serialize(),
        'include_post': self.include_post(),
        'need_profile': need_profile,
        'feed': feed,
        'items': items,
        'has_name': has_name,
        'has_location': has_location,
        'has_subtitle': has_name or has_location
        
      })

  def render_to_response(self, tmpl_filename, dictionary):
    os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
    """Note that this is different than Django's similarly named function"""
    content = render_to_string(tmpl_filename, dictionary)
    # django is misguided here - it doesn't read the file as UTF-8
    self.xhr_content(content, "text/html;charset=UTF-8")


class EditorViewHandler(ViewHandler):
  def include_post(self):
    return True


class ReaderViewHandler(ViewHandler):
  def include_post(self):
    return False


class DataProfileHandler(belay.CapHandler):
  def post(self):
    feed = self.get_entity()
    
    request = self.bcapRequest()
    feed.title = request.get('title')
    feed.put()

    self.bcapNullResponse()


class DataPostHandler(belay.CapHandler):
  def post(self):
    feed = self.get_entity()
    
    request = self.bcapRequest()
    v = request.get('body', '')
    if not v:
      self.error(400, "Empty or missing posting body")
      return
      
    item = ItemData(parent=feed, body=request['body'])
    v = request.get('when', '')
    if v:
      item.when = v
    v = request.get('via', '')
    if v:
      item.via = v
    item.put()

    self.bcapNullResponse()


class SnapshotHandler(belay.CapHandler):
  def get(self):
    self.bcapResponse(self.get_entity().snapshot)

  def put(self):
    v = self.bcapRequest()
    snapshot = self.get_entity()
    snapshot.snapshot = v
    snapshot.put()
    self.bcapNullResponse()


class SetAttributesHandler(belay.CapHandler):
  def put(self):
    feed = self.get_entity()
    request = self.bcapRequest()
    
    feed.name = request.get('name', '')
    feed.location = request.get('location', '')
    feed.put()
    
    self.bcapNullResponse()


application = webapp.WSGIApplication(
  [(r'/cap/.*', belay.ProxyHandler),
  ('/generate', GenerateHandler),
  ],
  debug=True)


# Internal Cap Paths
belay.set_handlers(
  '/cap',
  [ ('/belay/launch', LaunchHandler),
    ('/belay/generateReader', GenerateReaderHandler),
    ('/belay/launchReader', LaunchReaderHandler),
    ('/view/editor', EditorViewHandler),
    ('/view/reader', ReaderViewHandler),
    ('/data/profile', DataProfileHandler),
    ('/data/post', DataPostHandler),
    ('/data/snapshot', SnapshotHandler),
    ('/data/attributes', SetAttributesHandler),
  ])
