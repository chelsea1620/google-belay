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
from pylib.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


server_url = "http://" + os.environ['HTTP_HOST']
  # TODO(mzero): this should be safer
  

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

class BelayGenerateHandler(webapp.RequestHandler):
  def get(self):
    feed_uuid = uuid.uuid4()
    feed_id = str(feed_uuid)
    content = server_url + "/belay/launch?s=" + feed_id
    xhr_content(content, "text/plain", self.response)


class BaseHandler(BcapHandler):
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

    content = template % {
      'app': json.dumps(app),
      'server_url': server_url,
    }
  
    xhr_content(content, "text/plain", self.response)


class BelayLaunchHandler(BaseHandler):
  def get(self):
    station = self.validate_station()
    if not station.is_saved():
      station.put()

    reply = {
      'page': "%s/your-stuff.html" % server_url,
  	  'info': {
  	    'instances': "%s/instances?s=%s" % (server_url, station.key().name()),
  	    'instanceBase': '%s/instance?s=%s&i=' % (server_url, station.key().name())
  	  }
	  }

    xhr_content(json.dumps(reply), "text/plain;charset=UTF-8", self.response)


class InstanceHandler(BaseHandler):
  def get(self):
    instance = self.validate_instance()
    self.bcapResponse(json.loads(instance.data))
      
  def post(self):
    capValue = self.bcapRequest()
    instance = self.validate_instance()
    instance.data = db.Text(json.dumps(capValue), 'UTF-8')
    instance.put()
    self.bcapResponse(True)
  
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
    
    self.bcapResponse(ids)


application = webapp.WSGIApplication(
  [('/',        LaunchHandler),
  ('/generate', GenerateHandler),
  ('/instance', InstanceHandler),
  ('/belay/generate', BelayGenerateHandler),
  ('/belay/launch',   BelayLaunchHandler),
  ('/instances',InstancesHandler),
  ],
  debug=True)

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
