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
import time
import json
import logging
import os
import random
import sys
import uuid

from model import *
from lib.py.belay import *
from utils import *

from google.appengine.api import app_identity
from google.appengine.api import mail
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

import identities
import identities_openid



def allInstances(station, cap_server, handler):
  q = InstanceData.all()
  q.ancestor(station)
  allInstances = []
  for instance in q:
    allInstances.append({
      'data': cap_server.data_post_process(instance.data),
      'cap': cap(handler.server_url(instance_path(station.key(), instance.key())))
    })
  return allInstances

def allSections(station, cap_server):
  q = SectionData.all()
  q.ancestor(station)
  allSections = []
  for section in q:
    allSections.append({
      'name': section.name,
      'hidden': section.hidden,
      'attributes': json.loads(section.attributes or '{}'),
      'attributesCap': cap_server.regrant(AttributesHandler, section)
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
        station = StationData.create(station_id)
        
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
    self.bcapResponse(cap(self.server_url(launch_path(station_id))))


class EmailVerifyHandler(BaseHandler):
  def post(self):
    email_addr = self.request.POST['email']

    if not mail.is_email_valid(email_addr):
      self.error(400)
      return
    
    existing_codes = VerifyData.all().filter("email_address =", email_addr)
    existing_codes.order("-expiry_time")

    # we use a 15 minute expiry time on verification codes
    new_expiry = long(time.time() + 60 * 15)

    last_code = existing_codes.fetch(limit=1)
    if last_code and new_expiry - last_code[0].expiry_time < 60:
        # if we generated a verification code within the last minute, then
        # refuse to generate another
        self.error(403)
        return

    verify_code = '%06d' % random.randint(0, 999999)
    verify_data = VerifyData(email_address=email_addr, 
        verify_code=verify_code,
        expiry_time=new_expiry,
        tries_left=5)
    verify_data.put()

    from_addr = ("Google Web Station <no-reply@%s.appspotmail.com>"
        % app_identity.get_application_id())
    subject = "Verification code for your station"
    body = ("""To log in to your station, copy the following code in to the
    web station login page: %s

    This code will expire in 15 minutes, and may only be used once.""" 
      % verify_code)

    mail.send_mail(from_addr, email_addr, subject, body)

    self.bcapResponse(self.cap_server.grant(VerificationCheckHandler, verify_data))


class VerificationCheckHandler(CapHandler):
  def post(self):
    verify_data = self.get_entity()

    if verify_data.expiry_time < long(time.time()):
        self.cap_server.revoke_entity(verify_data)
        verify_data.delete()
        self.error(403)
        return

    params = self.bcapRequest()
    entered_code = params.get('code')

    if verify_data.verify_code != entered_code:
      verify_data.tries_left = verify_data.tries_left - 1
      if verify_data.tries_left <= 0:
        self.cap_server.revoke_entity(verify_data)
        verify_data.delete()
      else:
        verify_data.put()
      self.error(403)
      return

    # TODO(iainmcgin): if there are multiple stations that match the email 
    # address, we should warn the user and either allow them to select the 
    # station they want or bail out.
    station = identities.find_station_by_email(verify_data.email_address)
    if not station:
      station = StationData.create()
      identities.create_verified_email_id(station, verify_data.email_address)

    self.cap_server.revoke_entity(verify_data)
    verify_data.delete()
    
    self.bcapResponse(cap(self.server_url(launch_path(station.key()))))


class VerifyCleanup(BaseHandler):
    def get(self):
        q = VerifyData.all().filter('expiry_time <', time.time())
        db.delete(q)


class BelayLaunchHandler(BaseHandler):
  def get(self):
    return self.launch()
  
  def post(self):
    return self.launch()

  def launch(self):
    station = self.validate_station()

    html = "/your-sites.html"
      
    reply = {
      'page': { 'html': self.server_url(html) },
        'info': {
          'instances': cap(self.server_url(instances_path(station.key()))),
          'instanceBase': self.server_url(instance_path(station.key(), '')),
          'section': self.cap_server.regrant(SectionHandler, station),
          'allInstances': allInstances(station, self.cap_server, self),
          'allSections': allSections(station, self.cap_server),
          'identities': self.cap_server.regrant(identities.IdentitiesHandler, station),
          'allIdentities': identities.allIdentities(station),
          'addIdentityLaunchers': [
              { 'title': 'Add Gmail',
                'launch': self.cap_server.regrant(identities_openid.GoogleLaunchHandler, station),
                'image': '/res/images/gmail.png' },
              { 'title': 'Add Yahoo',
                'launch': self.cap_server.regrant(identities_openid.YahooLaunchHandler, station),
                'image': '/res/images/yahoo.png' },
              { 'title': 'Add AOL',
                'launch': self.cap_server.regrant(identities_openid.AolLaunchHandler, station),
                'image': '/res/images/aol.png' },
            ],
          'createProfile': self.cap_server.regrant(identities.ProfileAddHandler, station)
      }
    }

    self.bcapResponse(reply)


class InstanceHandler(BaseHandler):
  def get(self):
    instance = self.validate_instance()
    self.bcapResponse(self.cap_server.data_post_process(instance.data))
      
  def post(self):
    capValue = self.bcapRequest()
    instance = self.validate_instance()
    instance.data = db.Text(self.cap_server.data_pre_process(capValue), 'UTF-8')
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
      identities.append(cap(server_url(instance_path(station.key(), instanceKey))))
    
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
      'hidden': section.hidden,
      'attributes': self.cap_server.regrant(AttributesHandler, section),
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
   ('/verify/email', EmailVerifyHandler),
   ('/verify/cleanup', VerifyCleanup),
   ('/instance', InstanceHandler),
   ('/instances',InstancesHandler),
   ('/login/openid/google/launch', identities_openid.GoogleLoginLaunchHandler),
   ('/login/openid/yahoo/launch', identities_openid.YahooLoginLaunchHandler),
   ('/login/openid/aol/launch', identities_openid.AolLoginLaunchHandler),
   ('/login/openid/google/callback', identities_openid.GoogleLoginCallbackHandler),
   ('/login/openid/yahoo/callback', identities_openid.YahooLoginCallbackHandler),
   ('/login/openid/aol/callback', identities_openid.AolLoginCallbackHandler),
  ],
  debug=True)

set_handlers(
  '/cap',
  [('section', SectionHandler),
   ('section/attributes', AttributesHandler),
   ('identities', identities.IdentitiesHandler),
   ('ids/profile/add', identities.ProfileAddHandler),
   ('verify', VerificationCheckHandler),
   ('openid/google/launch', identities_openid.GoogleLaunchHandler),
   ('openid/yahoo/launch', identities_openid.YahooLaunchHandler),
   ('openid/aol/launch', identities_openid.AolLaunchHandler),
   ('openid/google/callback', identities_openid.GoogleCallbackHandler),
   ('openid/yahoo/callback', identities_openid.YahooCallbackHandler),
   ('openid/aol/callback', identities_openid.AolCallbackHandler),
  ])

