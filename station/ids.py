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

#import json # TODO(mzero): add back for Python27
from django.utils import simplejson as json # TODO(mzero): remove for Python27

from model import *
from lib.py.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp



def allIdentities(station):
  q = IdentityData.all()
  q.ancestor(station)
  return [ x.toJson() for x in q]


class IdentitiesHandler(CapHandler):
  def get(self):
    station = self.get_entity()
    self.bcapResponse(allIdentities(station))

  def put(self):
    station = self.get_entity()
    for i in station.identitydata_set:
      i.delete()
    idinfo = self.bcapRequest()
    for j in idinfo:
      IdentityData.fromJson(station, j).put()
    self.bcapNullResponse()


class ProfileLaunchHandler(CapHandler):
  def get(self):
    station = self.get_entity()
    reply = {
      'page': { 'html': server_url('/addProfile.html') },
      'info': {
        'add': regrant(ProfileAddHandler, station)
      }
    }
    self.bcapResponse(reply)


class ProfileAddHandler(CapHandler):
  def post(self):
    station = self.get_entity()
    idinfo = self.bcapRequest()
    name = idinfo.get('name', None)
    if not name:
      return

    attributes = dict()
    for t in ['name', 'location', 'email']:
      v = idinfo.get(t, None)
      if v:
          attributes[t] = [v]

    IdentityData(parent=station,
      id_type='profile',
      id_provider='user added profile',
      account_name=name,
      display_name=name,
      attributes=json.dumps(attributes)
      ).put()
    
    self.bcapNullResponse()

