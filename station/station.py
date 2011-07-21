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
from lib.py.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app


def server_url(path):
  return this_server_url_prefix() + path

def keyName(key):
  if isinstance(key, str):
    return key
  return key.name()
  
def launch_url(stationKey):
  return server_url('/belay/launch?s=' + keyName(stationKey))
  
def instances_url(stationKey):
  return server_url('/instances?s=' + keyName(stationKey))

def instance_url(stationKey, instanceKey):
  return server_url('/instance?s=' + keyName(stationKey)
    + '&i=' + keyName(instanceKey))

def tool_url(port, path):
  return "http://%s:%d%s" % (os.environ['SERVER_NAME'], port, path)

def cap(url):
  return { '@': url }

def defaultTools():
  return [
    { 'name': 'Hello',
      'icon': tool_url(9002, '/tool-hello.png'),
      'generate': cap(tool_url(9002, '/belay/generate'))
    },
    { 'name': 'Sticky',
      'icon': tool_url(9003, '/tool-stickies.png'),
      'generate': cap(tool_url(9003, '/belay/generate'))
    },
    { 'name': 'Buzzer',
      'icon': tool_url(9004, '/tool-buzzer.png'),
      'generate': cap(tool_url(9004, '/belay/generate'))
    },
    { 'name': 'Emote',
      'icon': tool_url(9005, '/tool-emote.png'),
      'generate': cap(tool_url(9005, '/belay/generate'))
    }
  ]
 


class StationData(db.Model):
  pass

class InstanceData(db.Model):
  data = db.TextProperty()



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
    

class BelayGenerateHandler(BaseHandler):
  def get(self):
    station_uuid = uuid.uuid4()
    station_id = str(station_uuid)
    self.bcapResponse(cap(launch_url(station_id)))


class BelayLaunchHandler(BaseHandler):
  def get(self):
    station = self.validate_station()
    if not station.is_saved():
      station.put()

    reply = {
      'page': { 'html': server_url("/your-stuff.html") },
        'info': {
          'instances': cap(instances_url(station.key())),
          'instanceBase': instance_url(station.key(), ''),
          'defaultTools': defaultTools()
      }
    }

    self.bcapResponse(reply)    


class InstanceHandler(BaseHandler):
  def get(self):
    instance = self.validate_instance()
    self.bcapResponse(dataPostProcess(instance.data))
      
  def post(self):
    capValue = self.bcapRequest()
    instance = self.validate_instance()
    instance.data = db.Text(dataPreProcess(capValue), 'UTF-8')
    instance.put()
    self.bcapResponse(True)
  
  def delete(self):
    instance = self.validate_instance()
    instance.delete()
    self.bcapNullResponse()


class InstancesHandler(BaseHandler):
  def get(self):
    station = self.validate_station()
    
    q = InstanceData.all(keys_only=True)
    q.ancestor(station)
    ids = []
    for instanceKey in q:
      ids.append(cap(instance_url(station.key(), instanceKey)))
    
    self.bcapResponse(ids)


application = webapp.WSGIApplication(
  [('/belay/generate', BelayGenerateHandler),
  ('/belay/launch',   BelayLaunchHandler),
  ('/instance', InstanceHandler),
  ('/instances',InstancesHandler),
  ],
  debug=True)

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
