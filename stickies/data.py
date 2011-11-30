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

import os
import sys
import uuid

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

from lib.py import belay


class StickyData(db.Model):
  note_id = db.StringProperty(required=True);
  data = db.TextProperty();


class InvalidNote(Exception):
  pass

def validate_note(note_id):
  try:
    note_uuid = uuid.UUID(note_id)
    return str(note_uuid)
  except:
    raise InvalidNote()


class DataHandler(belay.BcapHandler):
  def get(self):
    note_id = validate_note(self.request.query_string)
    q = StickyData.all()
    q.filter('note_id =', note_id)
    sdata = q.fetch(1)
    
    text = u""
    if len(sdata) == 1:
      text = sdata[0].data
    
    self.bcapResponse(text)
    
      
  def put(self):
    note_id = validate_note(self.request.query_string)
    q = StickyData.all()
    q.filter('note_id =', note_id)
    sdata = q.fetch(1)

    if len(sdata) == 1:
      sdata = sdata[0]
    else:
      sdata = StickyData(note_id=note_id)
      
    sdata.data = db.Text(self.bcapRequest())
    sdata.put()

    self.bcapNullResponse()


  def handle_exception(self, exc, debug_mode):
    if isinstance(exc,InvalidNote):
      self.error(404)
    else:
      super(DataHandler, self).handle_exception(exc, debug_mode)

application = webapp.WSGIApplication(
  [('/data', DataHandler),
  ],
  debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
