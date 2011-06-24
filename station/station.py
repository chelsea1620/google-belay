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
  

class StationData(db.Model):
  pass

class InstanceData(db.Model):
  data = db.TextProperty()



class GenerateHandler(webapp.RequestHandler):
  def get(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)
    content = server_url + "/?s=" + feed_id
    xhr_content(content, "text/plain", self.response)


class BaseHandler(webapp.RequestHandler):
  class InvalidStation(Exception):
    pass
  class InvalidInstance(Exception):
    pass

  def validate_station(self):
    try:
      station_uuid = uuid.UUID(self.request.GET['s'])
      station_id = str(station_uuid)
      station = StationData.get_by_key_name(station_id)
      if station == None:
        station = StationData(key_name=station_id)
      return station
    except:
      raise BaseHandler.InvalidStation()

  def validate_instance(self):
    try:
      station = self.validate_station()
      instance_uuid = uuid.UUID(self.request.GET['i'])
      instance_id = str(instance_uuid)
      instance = InstanceData.get_by_key_name(instance_id, parent=station)
      if instance == None:
        instance = InstanceData(key_name=instance_id, parent=station)
      return instance
    except:
      raise BaseHandler.InvalidInstance()

  def options(self):
    m = self.request.headers["Access-Control-Request-Method"]
    h = self.request.headers["Access-Control-Request-Headers"]

    self.response.headers["Access-Control-Allow-Origin"] = "*"
    self.response.headers["Access-Control-Max-Age"] = "2592000"
    self.response.headers["Access-Control-Allow-Methods"] = m      
    if h:
      self.response.headers["Access-Control-Allow-Headers"] = h
      
          
  def handle_exception(self, exc, debug_mode):
    if isinstance(exc,BaseHandler.InvalidStation):
      logging.getLogger().warn("unrecognized station")
      self.error(404)
    elif isinstance(exc,BaseHandler.InvalidInstance):
      logging.getLogger().warn("unrecognized instance")
      self.error(404)
    else:
      super(BaseHandler, self).handle_exception(exc, debug_mode)
    

class LaunchHandler(BaseHandler):
  def get(self):
    station = self.validate_station()
    if not station.is_saved():
      station.put()

    app = {
	  'caps': {
	    'instances': "%s/instances?s=%s" % (server_url, station.key().name()),
	    'instanceBase': '%s/instance?s=%s&i=' % (server_url, station.key().name())
	  }
	}

    template = """
    var $ = os.jQuery;

    var app = %(app)s;

    $.ajax({
      url: "%(server_url)s/station.js",
      dataType: "text",
      success: function(data, status, xhr) {
        cajaVM.compileModule(data)({os: os, app: app});
      },
      error: function(xhr, status, error) {
        alert("Failed to load station: " + status);
      }
    });
    """

    # would be simpler to do this with JSON, but then have to include Django
    # to get to the json serializer...

    content = template % {
      'app': json.dumps(app),
      'server_url': server_url,
    }

    xhr_content(content, "text/plain", self.response)


class InstanceHandler(BaseHandler):
  def get(self):
    instance = self.validate_instance()
    xhr_content(json.dumps({ 'value': json.loads(instance.data) }), 
                "text/plain;charset=UTF-8", self.response)
      
  def post(self):
    instance = self.validate_instance()
    cap_value = json.loads(self.request.body)
    instance.data = db.Text(json.dumps(cap_value['value']), 'UTF-8')
    instance.put()
    xhr_response(self.response)
  
  def delete(self):
    instance = self.validate_instance()
    instance.delete()
    xhr_response(self.response)


class InstancesHandler(BaseHandler):
  def get(self):
    station = self.validate_station()
    
    q = InstanceData.all(keys_only=True)
    q.ancestor(station)
    ids = []
    for instanceKey in q:
      template ='%(server_url)s/instance?s=%(station_id)s&i=%(instance_id)s'
      instance_url = template  % {
          'server_url': server_url,
          'station_id': station.key().name(),
          'instance_id': instanceKey.name(),
        }
      ids.append({ '@' : instance_url })
    
    xhr_content(json.dumps({ 'value': ids}), "text/plain;charset=UTF-8", self.response)


application = webapp.WSGIApplication(
  [('/',        LaunchHandler),
  ('/generate', GenerateHandler),
  ('/instance', InstanceHandler),
  ('/instances',InstancesHandler),
  ],
  debug=True)

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
