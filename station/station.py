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
#import json # TODO(mzero): add back for Python27
import logging
import os
import sys
import uuid

from model import *
from lib.py.belay import *

from django.utils import simplejson as json # TODO(mzero): remove for Python27

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

import ids


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
    { 'name': 'Emote',
      'icon': tool_url(9005, '/tool-emote.png'),
      'generate': cap(tool_url(9005, '/belay/generate'))
    }
  ]
 


def allInstances(station):
  q = InstanceData.all()
  q.ancestor(station)
  allInstances = []
  for instance in q:
    allInstances.append({
      'data': dataPostProcess(instance.data),
      'cap': cap(instance_url(station.key(), instance.key()))
    })
  return allInstances

def allSections(station):
  q = SectionData.all()
  q.ancestor(station)
  allSections = []
  for section in q:
    allSections.append({
      'name': section.name,
      'attributes': json.loads(section.attributes or '{}'),
      'attributesCap': regrant(AttributesHandler, section)
    })
  return allSections




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
        for n in ['Uncategorized', 'Personal', 'Work', 'Games', 'Trash']:
          SectionData(parent=station, name=n).put()
        
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
    return self.launch('new')
  
  def post(self):
    params = self.bcapRequest()
    return self.launch(params.get('version', 'new'))

  def launch(self, type):
    station = self.validate_station()
    if not station.is_saved():
      station.put()

    html = "/your-sites.html"
    if (type == "old"):
      html = "/your-stuff.html"
      
    reply = {
      'page': { 'html': server_url(html) },
        'info': {
          'instances': cap(instances_url(station.key())),
          'instanceBase': instance_url(station.key(), ''),
          'defaultTools': defaultTools(),
          'section': regrant(SectionHandler, station),
          'allInstances': allInstances(station),
          'allSections': allSections(station),
          'identities': regrant(ids.IdentitiesHandler, station),
          'allIdentities': ids.allIdentities(station),
          'addIdentityLaunchers': [
              { 'title': 'Add Profile',
                'launch': regrant(ids.ProfileLaunchHandler, station) }
            ]
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



class SectionHandler(CapHandler):
  def post(self):
    station = self.get_entity()
    sectionName = self.bcapRequest()
    q = SectionData.all()
    q.ancestor(station)
    q.filter('name =', sectionName)
    section = q.get()
    if section is None:
      section = SectionData(parent=station, name=sectionName)
      section.put()
    
    self.bcapResponse({
      'name': section.name,
      'attributes': regrant(AttributesHandler, section),
    })

  
class AttributesHandler(CapHandler):
  def get(self):
    section = self.get_entity()
    self.bcapResponse(json.loads(section.attributes or '{}'))
  
  def put(self):
    section = self.get_entity()
    section.attributes = json.dumps(self.bcapRequest())
    section.put()
  



application = webapp.WSGIApplication(
  [(r'/cap/.*', ProxyHandler),
   ('/belay/generate', BelayGenerateHandler),
   ('/belay/launch',   BelayLaunchHandler),
   ('/instance', InstanceHandler),
   ('/instances',InstancesHandler),
  ],
  debug=True)

set_handlers(
  '/cap',
  [('section', SectionHandler),
   ('attributes', AttributesHandler),
   ('identities', ids.IdentitiesHandler),
   ('ids/profile/launch', ids.ProfileLaunchHandler),
   ('ids/profile/add', ids.ProfileAddHandler),
  ])

def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
