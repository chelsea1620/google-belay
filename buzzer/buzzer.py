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

from django.utils import simplejson as json
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
from django.template.loader import render_to_string

from lib.py import belay

def server_url(path):
  return belay.this_server_url_prefix() + path

def server_feed_url(path, feed_id):
  return server_url(path + "?" + feed_id)

def server_cap(path, feed_id):
  return { '@': server_feed_url(path, feed_id) }


class FeedData(db.Model):
  name = db.StringProperty()
  location = db.StringProperty()
  
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




class BaseHandler(belay.BcapHandler):
  class InvalidFeed(Exception):
    pass

  def validate_feed(self):
    try:
      feed_uuid = uuid.UUID(self.request.query_string)
      return str(feed_uuid)
    except:
      raise BaseHandler.InvalidFeed()

  def handle_exception(self, exc, debug_mode):
    if isinstance(exc,BaseHandler.InvalidFeed):
      self.error(404)
    else:
      super(BaseHandler, self).handle_exception(exc, debug_mode)

  def render_to_response(self, tmpl_filename, dictionary):
    """Note that this is different than Django's similarly named function"""
    content = render_to_string(tmpl_filename, dictionary)
    # django is misguided here - it doesn't read the file as UTF-8
    self.xhr_content(content, "text/html;charset=UTF-8")
    

class LaunchHandler(BaseHandler):
  def get(self):
    feed_id = self.validate_feed();
    feed = FeedData.get_by_key_name(feed_id);

    response = {
      'page': {
        'html': server_url('/buzzer-belay.html'),
        'window': { 'width': 300, 'height': 400 } 
      },
      'gadget': {
        'html': server_feed_url("/view/editor", feed_id),
        'scripts': [ server_url("/buzzer.js") ]
      },
      'info': {
        'post_cap': server_cap('/data/post', feed_id),
        'reader_gen_cap': server_cap("/belay/generateReader", feed_id),
        'editor_url': server_feed_url("/view/editor", feed_id),
      }
    }

    self.bcapResponse(response)    


class LaunchReaderHandler(BaseHandler):
  def get(self):
    feed_id = self.validate_feed();
    feed = FeedData.get_by_key_name(feed_id);

    response = {
      'page': {
        'html': server_url('/buzzer-belay.html'),
        'window': { 'width': 300, 'height': 400 } 
      },
      'gadget': {
        'html': server_feed_url("/view/reader", feed_id),
        'scripts': [ server_url("/buzzer.js") ]
      },
      'info': {
        'editor_url': server_feed_url("/view/reader", feed_id),
      }
    }

    self.bcapResponse(response)    


class GenerateHandler(BaseHandler):
  def get(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)
    self.bcapResponse(server_cap("/belay/launch", feed_id))

class GenerateProfileHandler(BaseHandler):
  def post(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)

    feed = FeedData(key_name=feed_id);
    # TODO(jpolitz): bcapRequest should be used here, but was yielding None
    # Find out why
    feed.name = self.request.get('name')
    feed.location = self.request.get('location')
    feed.put()

    self.bcapResponse(server_cap("/belay/launch", feed_id))

class GenerateReaderHandler(BaseHandler):
  def get(self):
    feed_id = self.validate_feed();
    feed = FeedData.get_by_key_name(feed_id);
    response = {
        'launch': server_cap('/belay/launchReader', feed_id),
        'name': 'buzz about ' + feed.name + " of " + feed.location,
        'icon': server_url('/tool-buzzer.png')
    };
    self.bcapResponse(response)

class ViewHandler(BaseHandler):
  def get(self):
    feed_id = self.validate_feed();
    feed = FeedData.get_by_key_name(feed_id);
    need_profile = feed == None or feed.name == ''
    if feed == None:
      feed = FeedData(key_name=feed_id);
    
    q = ItemData.all();
    q.ancestor(feed);
    q.order('-when');
    items = q.fetch(10);
    
    self.render_to_response('buzzer.tmpl',
      { 'css_url': server_url('/buzzer.css'),
        'chit_read_url': server_url('/chit-24.png'),
        'chit_post_url': server_url('/chit-25.png'),
        'post_url': server_feed_url('/data/post', feed_id),
        'profile_url': server_feed_url('/data/profile', feed_id),
        'include_post': self.include_post(),
        'need_profile': need_profile,
        'feed': feed,
        'items': items,
      })

class EditorViewHandler(ViewHandler):
  def include_post(self):
    return True

class ReaderViewHandler(ViewHandler):
  def include_post(self):
    return False

class DataProfileHandler(BaseHandler):
  def post(self):
    feed_id = self.validate_feed()
    feed = FeedData(key_name=feed_id)
    
    request = self.bcapRequest()
    feed.name = request.get('name')
    feed.location = request.get('location')
    feed.put()

    self.xhr_response()

class DataPostHandler(BaseHandler):
  def post(self):
    feed_id = self.validate_feed()
    feed = FeedData(key_name=feed_id)
    
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

    self.xhr_response()



application = webapp.WSGIApplication(
  [('/belay/launch', LaunchHandler),
  ('/belay/launchReader', LaunchReaderHandler),
  ('/belay/generate', GenerateHandler),
  ('/belay/generateProfile', GenerateProfileHandler),
  ('/belay/generateReader', GenerateReaderHandler),
  ('/view/editor', EditorViewHandler),
  ('/view/reader', ReaderViewHandler),
  ('/data/profile', DataProfileHandler),
  ('/data/post', DataPostHandler),
  ],
  debug=True)

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
