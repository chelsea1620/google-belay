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


GOOGLE_PROVIDER = 'Google'
YAHOO_PROVIDER = 'Yahoo'
AOL_PROVIDER = 'AOL'


# a map from id_type -> provider_id -> icon path
# defaults are provided if a matching provider_id cannot be found by using the
# key 'other'
# all icons should render well at a size of 16x16
id_icon_map = {
    'openid': {
        GOOGLE_PROVIDER: 'google.ico',
        YAHOO_PROVIDER: 'yahoo.ico',
        AOL_PROVIDER: 'aol.ico',
        'other': 'openid.ico'
    },
    'browserid': {
        'other': 'browserid.ico'
    },
    'email': {
        # TODO(iainmcgin): need an icon to distinguish verified from unverified
        'other': 'unverified.png',
    },
    'profile': {
        'other': 'profile.png'
    }
}


def icon_for_id(id):
  icon_map = id_icon_map[id.id_type]
  if id.id_provider in icon_map:
    return '/res/images/%s' % icon_map[id.id_provider]
  else:
    return '/res/images/%s' % icon_map['other']


def id_to_json(id):
  j = {
    'id_type': id.id_type,
    'id_icon': icon_for_id(id),
    'account_name': id.account_name,
  }
  if id.id_provider: j['id_provider'] = id.id_provider
  if id.display_name: j['display_name'] = id.display_name
  j['attributes'] = json.loads(id.attributes)
  return j


def json_to_id(j, station):
  i = IdentityData(station=station,
        id_type=j['id_type'],
        account_name=j['account_name'])
  if 'id_provider' in j: i.id_provider = j['id_provider']
  if 'display_name' in j: i.display_name = j['display_name']
  i.attributes = json.dumps(j['attributes'])
  return i


def allIdentities(station):
  q = IdentityData.all()
  q.ancestor(station)
  return [ id_to_json(x) for x in q]


class IdentitiesHandler(CapHandler):
  def get(self):
    station = self.get_entity()
    self.bcapResponse(allIdentities(station))

  def put(self):
    station = self.get_entity()
    q = IdentityData.all()
    q.ancestor(station)
    for i in q:
      i.delete()
    idinfo = self.bcapRequest()
    for j in idinfo:
      json_to_id(j, station).put()
    self.bcapNullResponse()


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

