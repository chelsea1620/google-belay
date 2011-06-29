#!/usr/bin/env python

import datetime
import logging
import os
import sys
import uuid

from django.utils import simplejson as json
from belay.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
from django.template.loader import render_to_string


server_url = "http://" + os.environ['HTTP_HOST']
  # TODO(mzero): this should be safer


def render_to_response(tmpl_filename, dictionary, response):
  """Note that this is different than Django's similarly named function"""
  content = render_to_string(tmpl_filename, dictionary)
  # django is misguided here - it doesn't read the file as UTF-8
  xhr_content(content, "text/html;charset=UTF-8", response)


class AccountData(db.Model):
  friend_view = db.ReferenceProprty(Card, required=True)
  
class CardData(db.Model):
  name = db.StringProperty(required=True)
  email = db.EmailProperty()
  image = blobstore.BlobReferenceProperty()
  notes = db.StringProperty()
  # TODO(mzero): needs a refresh_cap property at some point
  
class FriendData(dbModel):
  card = db.ReferenceProperty(Card, required=True)
  in_progress = db.BooleanProperty(default=False)
  remote_box = db.TextProperty()  # cap
  
class MessageData(db.Model):
  when = db.DateTimeProperty(auto_now_add=True)
  message = db.TextProperty()
  capability = db.StringProperty()
  resource_class = db.StringProperty()
  
  def nicedate(self):
    date = self.when
    today = datetime.datetime.now()
    date_ordinal = date.toordinal()
    today_ordinal = today.toordinal()
    format = ""
    if date_ordinal == today_ordinal:
      format = "today"
    elif date_ordinal == today_ordinal - 1:
      format = "yesterday"
    elif date_ordinal > today_ordinal - 7:
      format = '%a'
    elif date.year == today.year:
      format = '%a, %b %d'
    else:
      format = '%a, %b %d %Y'
    format += ' - %I:%M %p'
    return date.strftime(format)


class InviteHandler(CapServer.Handler):
  def get(self):
    friend = self.private.entity;
    # get the account from the parent of the friend entity
    # get the friend_view card from the acccount
    result = {
      'name': fv_card.name,
      'email': fv_card.email,
      # blah
      'accept': CapServer.grant(AcceptHandler, friend),
      'reject': CapServer.grant('friend/list', friend)
    }
    self.setJSONresult(result)



# Externally Visible URL Paths
application = webapp.WSGIApplication(
  [('/cap', CapServer.ProxyHandler),
   ('/generate', GenerateHandler),
  ],
  debug=True)

# Internal Cap Paths
CapServer.setHandlers(
  application,
  [('friend/invite', InviteHandler),
   ('friend/accept', AcceptHandler),
   ('friend/list', ListHandler)
  ])



def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
