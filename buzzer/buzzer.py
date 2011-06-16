#!/usr/bin/env python

import datetime
import logging
import os
import sys
import uuid

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
from django.template.loader import render_to_string


server_url = "http://" + os.environ['HTTP_HOST']
  # TODO(mzero): this should be safer

def xhr_response(response):
  response.headers.add_header("Access-Control-Allow-Origin", "*")

def xhr_content(content, content_type, response):
  xhr_response(response)
  response.out.write(content)
  response.headers.add_header("Cache-Control", "no-cache")
  response.headers.add_header("Content-Type", content_type)
  response.headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")
  
def render_to_response(tmpl_filename, dictionary, response):
  """Note that this is different than Django's similarly named function"""
  content = render_to_string(tmpl_filename, dictionary)
  # django is misguided here - it doesn't read the file as UTF-8
  xhr_content(content, "text/html;charset=UTF-8", response)


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




class BaseHandler(webapp.RequestHandler):
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
    

class LaunchHandler(BaseHandler):
  def get(self):
    feed_id = self.validate_feed();
    feed = FeedData.get_by_key_name(feed_id);

    template = """
var $ = os.jQuery;

var app = {
  caps: {
    editor: "%(editor_cap)s",
    post: "%(post_cap)s"
  },
  data: {
    name: "%(feed_name)s"
  }
};

$.ajax({
  url: "%(server_url)s/buzzer.js",
  dataType: "text",
  success: function(data, status, xhr) {
    cajaVM.compileModule(data)({os: os, app: app});
  },
  error: function(xhr, status, error) {
    alert("Failed to load buzzer: " + status);
  }
});
"""
    content = template % {
      'server_url': server_url,
      'editor_cap': server_url + '/view/editor?' + feed_id,
      'post_cap': server_url + '/data/post?' + feed_id,
      'feed_name': feed and (feed.name + " in " + feed.location) or '',
    }
    
    xhr_content(content, "text/plain", self.response)
    
    
class GenerateHandler(webapp.RequestHandler):
  def get(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)
    content = server_url + "/?" + feed_id
    xhr_content(content, "text/plain", self.response)


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
    
    render_to_response('buzzer.tmpl',
      { 'css_url': server_url + '/buzzer.css',
        'chit_url': server_url + '/chit-24.png',
        'post_url': server_url + '/data/post?' + feed_id,
        'profile_url': server_url + '/data/profile?' + feed_id,
        'include_post': self.include_post(),
        'need_profile': need_profile,
        'feed': feed,
        'items': items,
      },
      self.response)

class EditorViewHandler(ViewHandler):
  def include_post(self):
    return True

class ReaderViewHandler(ViewHandler):
  def include_post(self):
    return False


class DataProfileHandler(BaseHandler):
  def post(self):
    feed_id = self.validate_feed();
    feed = FeedData(key_name=feed_id);
    
    feed.name = self.request.get('name')
    feed.location = self.request.get('location')
    feed.put()

    xhr_response(self.response)

class DataPostHandler(BaseHandler):
  def post(self):
    feed_id = self.validate_feed();
    feed = FeedData(key_name=feed_id);

    item = ItemData(parent=feed, body=self.request.get('body'))
    v = self.request.get('when')
    if (v):
      item.when = v
    v = self.request.get('via')
    if (v):
      item.via = v
    item.put()

    xhr_response(self.response)



application = webapp.WSGIApplication(
  [('/', LaunchHandler),
  ('/generate', GenerateHandler),
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
