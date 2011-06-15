#!/usr/bin/env python

import datetime
import logging
import os
import sys
import uuid

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
  data = db.TextProperty()

#class InstanceData(db.Model):



class GenerateHandler(webapp.RequestHandler):
  def get(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)
    content = server_url + "/?s=" + feed_id
    xhr_content(content, "text/plain", self.response)


class BaseHandler(webapp.RequestHandler):
  class InvalidStation(Exception):
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

  def handle_exception(self, exc, debug_mode):
    if isinstance(exc,BaseHandler.InvalidStation):
      self.error(404)
    else:
      super(BaseHandler, self).handle_exception(exc, debug_mode)
    

class LaunchHandler(BaseHandler):
  def get(self):
    station = self.validate_station();

    template = """
    var $ = os.jQuery;

    var app = {
      caps: {
        data: "%(server_url)s/data?s=%(station_id)s",
      }
    };

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
      'server_url': server_url,
      'station_id': station.key().name(),
    }

    xhr_content(content, "text/plain", self.response)


class DataHandler(BaseHandler):
  def get(self):
    station = self.validate_station();    
    xhr_content(station.data, "text/plain;charset=UTF-8", self.response)
    
      
  def post(self):
    station = self.validate_station();      
    station.data = db.Text(self.request.body, 'UTF-8')
    station.put()
    xhr_response(self.response)



application = webapp.WSGIApplication(
  [('/',        LaunchHandler),
  ('/generate', GenerateHandler),
  ('/data',     DataHandler),
#  ('/instance', InstanceHandler),
#  ('/instances',InstancesHandler),
  ],
  debug=True)

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
