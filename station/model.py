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
from lib.py.belay import *

from google.appengine.ext import db


class StationData(db.Model):  
  pass
  # TODO(mzero): if we ever delete a station, need to delete stuff under it


class InstanceData(db.Model):
  data = db.TextProperty()


class SectionData(db.Model):
  name = db.StringProperty(required=True)
  hidden = db.BooleanProperty(default=False)
  attributes = db.TextProperty(default='{}')
    # JSON encoded map of attribute names to single values
    # missing 


class IdentityData(db.Model):
  id_type = db.StringProperty(required=True,
    choices=['profile', 'email', 'openid', 'browserid'])
  id_provider = db.StringProperty()
  account_name = db.StringProperty(required=True)
  display_name = db.StringProperty()
  attributes = db.TextProperty(default='{}')
    # JSON encoded map of attribute names to arrays of values
    # first value in the list is "primary"

  def toJson(self):
    j = {
      'id_type': self.id_type,
      'account_name': self.account_name,
    }
    if self.id_provider: j['id_provider'] = self.id_provider
    if self.display_name: j['display_name'] = self.display_name
    j['attributes'] = json.loads(self.attributes)
    return j

  @classmethod
  def fromJson(cls, station, j):
    i = IdentityData(station=station,
          id_type=j['id_type'],
          account_name=j['account_name'])
    if 'id_provider' in j: i.id_provider = j['id_provider']
    if 'display_name' in j: i.display_name = j['display_name']
    i.attributes = json.dumps(j['attributes'])
    return i
