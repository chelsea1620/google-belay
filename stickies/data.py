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


class DataHandler(webapp.RequestHandler):
  def get(self):
    note_id = validate_note(self.request.query_string)
    q = StickyData.all()
    q.filter('note_id =', note_id)
    sdata = q.fetch(1)
    
    content = u""
    if len(sdata) == 1:
      content = sdata[0].data
    
    headers = self.response.headers
    headers.add_header("Access-Control-Allow-Origin", "*")
    headers.add_header("Cache-Control", "no-cache")
    headers.add_header("Content-Type", "text/plain;charset=UTF-8")
    headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")
    self.response.out.write(content)
    
      
  def post(self):
    note_id = validate_note(self.request.query_string)
    q = StickyData.all()
    q.filter('note_id =', note_id)
    sdata = q.fetch(1)

    if len(sdata) == 1:
      sdata = sdata[0]
    else:
      sdata = StickyData(note_id=note_id)
      
    sdata.data = db.Text(self.request.body, 'UTF-8')
      # TODO: Should be fetching the encoding from the request headers
    sdata.put()

    self.response.headers.add_header("Access-Control-Allow-Origin", "*")


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
