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

from model import *
from lib.py.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp



def allIdentities(station):
  return [ x.toJson() for x in station.identitydata_set ]


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
    name = idinfo['display_name']
    IdentityData(station=station,
      id_type='profile',
      id_provider='user added profile',
      account_name=name,
      display_name=name).put()
    self.bcapNullResponse()

