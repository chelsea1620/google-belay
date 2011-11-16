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

class InstanceData(db.Model):
  data = db.TextProperty()


class SectionData(db.Model):
  name = db.StringProperty(required=True)
  attributes = db.TextProperty()


class IdentityData(db.Model):
  station = db.ReferenceProperty(required=True, reference_class=StationData)
  id_type = db.StringProperty(required=True)
  id_provider = db.StringProperty()
  account_name = db.StringProperty(required=True)
  display_name = db.StringProperty()

  def toJson(self):
    j = {
      'id_type': self.id_type,
      'account_name': self.account_name,      
    }
    if self.id_provider: j['id_provider'] = self.id_provider
    if self.display_name: j['display_name'] = self.display_name
    return j

  @classmethod
  def fromJson(cls, station, j):
    i = IdentityData(station=station,
          id_type=j['id_type'],
          account_name=j['account_name'])
    if 'id_provider' in j: i.id_provider = j['id_provider']
    if 'display_name' in j: i.display_name = j['display_name']
    return i
