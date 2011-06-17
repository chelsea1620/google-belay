#!/usr/bin/env python

from google.appengine.dist import use_library
use_library('django', '1.2')

import os
import sys

from google.appengine.api import users
from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

def djangoSetup():
  # for some reason this doesn't 'stick'
  os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'
djangoSetup()

from django.template.loader import render_to_string


class BelayAccount(db.Model):
  user_id = db.StringProperty()   # this is stable
  user = db.UserProperty()        # this is not - only for admin and debugging
  station_url = db.StringProperty()

class ConfigurationShouldHaveRequiredLogin(Exception):
  pass
  
def get_account():
  user = users.get_current_user()
  if not user:
    raise ConfigurationShouldHaveRequiredLogin

  q = BelayAccount.all()
  q.filter("user_id =", user.user_id())
  accts = q.fetch(1)

  if len(accts) == 1:
    acct = accts[0]
    return (user, acct)
  else:
    acct = BelayAccount()
    acct.user_id = user.user_id()
    acct.user = user
    acct.station_url = ''
    return (user, acct)

def template_vars(user, acct):
  return {
    'acct_exists':    acct.station_url != '',
    'user_email':     user.email(),
    'user_nickname':  user.nickname(),
    'station_url':    acct.station_url,
    }
  
def render_to_response(tmpl_filename, dictionary, response):
  djangoSetup()
  """Note that this is different than Django's similarly named function"""
  content = render_to_string(tmpl_filename, dictionary)
  # django is misguided here - it doesn't read the file as UTF-8
  response.out.write(content)

  response.headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")
  response.headers.add_header("Cache-Control", "no-cache")
  response.headers.add_header("Content-Type", "text/html;charset=UTF-8")


class MainPage(webapp.RequestHandler):
  def get(self):
    (user, acct) = get_account()
    
    if acct.station_url == '':
      self.redirect("/manage")
      return
    
    render_to_response('index.tmpl',
      template_vars(user, acct),
      self.response)


class ManagePage(webapp.RequestHandler):
  def get(self):
    (user, acct) = get_account()

    render_to_response('manage.tmpl',
      template_vars(user, acct),
      self.response)

  def post(self):
    (user, acct) = get_account()
    acct.station_url = self.request.get('provider_url')
    acct.put()
    self.redirect("/")

    
application = webapp.WSGIApplication(
  [('/', MainPage),
   ('/manage', ManagePage),
  ],
  debug=True)

def main():
    run_wsgi_app(application)

if __name__ == "__main__":
    main()
