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

import cgi

from model import *
from lib.py.belay import *
from utils import *

from openid import fetchers
from openid.consumer import consumer
from openid.extensions import ax
from gae_openid_store import AppEngineOpenIDStore

import datetime
import logging

import identities

from google.appengine.api import urlfetch


class UrlfetchFetcher(fetchers.HTTPFetcher):
    """An C{L{HTTPFetcher}} that uses AppEngine's urlfetch.
    """
    def fetch(self, url, body=None, headers=None):
        if headers is None:
            headers = {}
        headers.setdefault(
            'User-Agent',
            "%s Python-urlfetch" % (fetchers.USER_AGENT))

        f = urlfetch.fetch(url, 
                method=(urlfetch.POST if body else urlfetch.GET),
                headers=headers,
                payload=body,
                validate_certificate=True)

        resp = fetchers.HTTPResponse()
        resp.body = f.content
        resp.final_url = f.final_url or url
        resp.headers = f.headers
        resp.status = f.status_code
        
        return resp

fetchers.setDefaultFetcher(UrlfetchFetcher())


EMAIL_ATTR = 'http://axschema.org/contact/email'
VERIFIED_EMAIL_ATTR = 'http://axschema.org/contact/verifiedemail'
NAME_ATTR = 'http://axschema.org/namePerson'
FIRST_NAME_ATTR = 'http://axschema.org/namePerson/first'
LAST_NAME_ATTR = 'http://axschema.org/namePerson/last'
FRIENDLY_NAME_ATTR = 'http://axschema.org/namePerson/friendly'
GENDER_ATTR = 'http://axschema.org/person/gender'
BIRTH_DATE_ATTR = 'http://axschema.org/birthDate'
AVATAR_ATTR = 'http://axschema.org/media/image/default'

class LaunchHandler(CapHandler):
  def get(self):
    c = consumer.Consumer({}, AppEngineOpenIDStore())
    auth_request = c.begin(self.discoveryUrl())

    auth_request.addExtension(self.buildAttributeRequest())
    
    callback = self.callbackUrl()
    realm = server_url('')

    form = auth_request.formMarkup(realm, callback, False, {})

    reply = {
      'page': { 'html': server_url('/addOpenId.html') },
      'info': {
        'formContent': form
      }
    }
    self.bcapResponse(reply)

  def callbackUrl(self):
    station = self.get_entity()
    return regrant(self.callbackClass(), station).serialize()

  def buildAttributeRequest(self):
    ax_request = ax.FetchRequest()
    
    attributes = [
      EMAIL_ATTR,
      VERIFIED_EMAIL_ATTR,
      NAME_ATTR,
      FIRST_NAME_ATTR,
      LAST_NAME_ATTR,
      FRIENDLY_NAME_ATTR,
      GENDER_ATTR,
      BIRTH_DATE_ATTR,
      AVATAR_ATTR,
    ]
    for attr in attributes:
        ax_request.add(ax.AttrInfo(attr, required=True))
    
    return ax_request


# TODO(mzero): These should be doing discovery to find the endpoint URLs

class GoogleLaunchHandler(LaunchHandler):
  def discoveryUrl(self):
    return 'https://www.google.com/accounts/o8/id'
  
  def callbackClass(self):
    return GoogleCallbackHandler


class YahooLaunchHandler(LaunchHandler):
  def discoveryUrl(self):
    return 'https://yahoo.com/'
  
  def callbackClass(self):
    return YahooCallbackHandler


class AolLaunchHandler(LaunchHandler):
  def discoveryUrl(self):
    return 'http://aol.com/'
  
  def callbackClass(self):
    return AolCallbackHandler


def stripPrefix(prefix, s):
  if s.startswith(prefix):
    return s[len(prefix):]
  else:
    return None
    
def extractAliases(prefix, args):
  r = dict()
  for (k, v) in args.iteritems():
    a = stripPrefix(prefix, k)
    if a:
      r[v] = a
  return r

def permuteAttributes(ax):
  # reform attributes from AX names and format to our names and format
  attrs = dict()

  v = []
  v.extend(ax.data.get(NAME_ATTR, []))
  v.extend(ax.data.get(FRIENDLY_NAME_ATTR, []))
  fns = ax.data.get(FIRST_NAME_ATTR, [])
  lns = ax.data.get(LAST_NAME_ATTR, [])
  v.extend([f + ' ' + l for (f, l) in zip(fns,lns)])
    # not clear if the first and last name values sets are 'aligned' like this
  if v:
    attrs['name'] = v
  
  v = []
  v.extend(ax.data.get(VERIFIED_EMAIL_ATTR, []))
  v.extend(ax.data.get(EMAIL_ATTR, []))
  if v:
    attrs['email'] = v
  
  v = []
  v.extend(ax.data.get(AVATAR_ATTR, []))
  if v:
    attrs['image'] = v

  if GENDER_ATTR in ax.data:
    gender = ax.data.get(GENDER_ATTR)[0]
    if gender == 'M':
        attrs['gender'] = ['male']
    elif gender == 'F':
        attrs['gender'] = ['female']
    else:
        attrs['gender'] = ['other']

  if BIRTH_DATE_ATTR in ax.data:
    bdate = datetime.date(BIRTH_DATE_ATTR)
    now = datetime.today()

    age = now.year - bdate.year
    if (now.month < bdate.month or 
        (now.month == bdate.month and now.day < bdate.day)):
      age -= 1
    
    attrs['age'] = [str(age)]
  
  return attrs


class CallbackHandler(CapHandler):
  def get(self):
    self.handleOpenIdResponse(self.request.GET)
  
  def post(self):
    self.handleOpenIdResponse(self.request.POST)

  def handleOpenIdResponse(self, args):
    c = consumer.Consumer({}, AppEngineOpenIDStore())
    result = c.complete(args, server_url(self.requestPath()))

    if result.status == consumer.SUCCESS:
        ax_response = ax.FetchResponse.fromSuccessResponse(result)
        self.handleSuccess(result.identity_url, ax_response)
    else: # NOTE(mzero): generally result.status == consumer.FAILURE
        self.handleFailure(result.message)
  
  def handleSuccess(self, identity_url, ax_response):
    self.addIdentity(identity_url, ax_response)
    page = self.buildClosePage()
    #page = self.buildDebuggingPage(args, attrs)
    self.writeOutPage(page);

  def handleFailure(self, message):
    logging.getLogger().info('openid request failed: %s' % message)
    page = self.buildFailPage()
    self.writeOutPage(page);

  def writeOutPage(self, page):
    self.response.headers["Cache-Control"] = "no-cache"
    self.response.headers["Expires"] = "Fri, 01 Jan 1990 00:00:00 GMT"
    self.response.content_type = "text/html;charset=UTF-8"
    self.response.body = page

  def addIdentity(self, identity_url, ax_response):
    station = self.get_entity()
    if ax_response:
      attrs = permuteAttributes(ax_response)
    else:
      attrs = {}
    
    IdentityData(
        parent=station,
        id_type='openid',
        id_provider=self.provider(),
        account_name=identity_url,
        display_name=attrs.get('name', [None])[0],
        attributes=json.dumps(attrs)
    ).put()
    
  def buildDebuggingPage(self, args, attrs):
    page = "<html><body>"
    page += "<h1>results</h1><dl>"
    for (k, v) in args.iteritems():
      page += "<dt>" + cgi.escape(k) + "</dt><dd>" + cgi.escape(v) + "</dd>"
    page += "</dl>"
    page += "<h1>attributes</h1><dl>"
    for (k, v) in attrs.iteritems():
      page += "<dt>" + cgi.escape(k) + "</dt><dd>" + cgi.escape(' -- '.join(v)) + "</dd>"
    page += "</dl>"
    page += "</body></html>"
    return page
  
  def buildClosePage(self):
    return '''<html>
    <body><h1>Done!</h1>
    <script>
      window.opener.postMessage('done', '*');
      setTimeout(function() { window.close(); }, 50);
    </script></body>
    </html>'''

  def buildFailPage(self):
    return '''<html>
    <body><h1>Failed!</h1>
    <p>The request to authenticate with your identity provider failed. You
    may close this window when ready.</p>
    <script>
      window.opener.postMessage('done', '*');
    </script></body>
    </html>'''
  
  def requestPath(self):
    return self.request.path_info_cap

class GoogleCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.GOOGLE_PROVIDER


class YahooCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.YAHOO_PROVIDER


class AolCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.AOL_PROVIDER


class LoginCallbackHandler(CallbackHandler):
  def handleSuccess(self, identity_url, ax_response):
    q = IdentityData.all()
    q.filter('id_type =', 'openid')
    q.filter('id_provider =', self.provider())
    q.filter('account_name =', identity_url)
    results = [ r for r in q.fetch(2) ]
    page = ''
    if len(results) == 0:
      logging.getLogger().debug('new station for: %s' % identity_url)
      station = StationData.create()
      self.set_entity(station)
      self.addIdentity(identity_url, ax_response)
      page = self.buildStationPage(
        "New Station",
        """A new station has been created for you.
        Use this same identity to get back to it.""",
        station.key())
    elif len(results) == 1:
      logging.getLogger().debug('login for: %s' % identity_url)
      identity = results[0]
      if ax_response:
          attrs = permuteAttributes(ax_response)
          identity.attributes = json.dumps(attrs)
          identity.put()
      station = identity.parent()
      self.set_entity(station)
      page = self.buildStationPage(
        "Station Login",
        """We have your station.""",
        station.key())
    else:
      logging.getLogger().debug('multiple stations for: %s' % identity_url)
      self.writeOutPage(page);
      page = self.buildMultipleStationPage()
    self.writeOutPage(page);

  def requestPath(self):
    return self.request.path_info

  def buildStationPage(self, header, message, stationKey):
    return '''<html>
    <head>
      <title>{header}</title>
      <script src="/lib/js/include-belay.js"></script>
    </head>
    <body><h1>{header}</h1>
    <p>{message}</p>
    <script>
      localStorage.setItem('launchCap', '{url}');
      localStorage.setItem('launchCap-authenticated-time', Date.now());
      window.close();
    </script></body>
    </html>'''.format(
      header=header, message=message, url=launch_url(stationKey))

  def buildMultipleStationPage(self):
    return '''<html>
    <body><h1>Multiple Stations</h1>
    <p>That identity is associated with multiple stations.</p>
    <script>
      window.opener.postMessage('done', '*');
    </script></body>
    </html>'''

# TODO(mzero): these callbackUrl() calls must match the map in station.py
class GoogleLoginLaunchHandler(GoogleLaunchHandler):
  def callbackUrl(self):
    return server_url("/login/openid/google/callback")


class YahooLoginLaunchHandler(YahooLaunchHandler):
  def callbackUrl(self):
    return server_url("/login/openid/yahoo/callback")


class AolLoginLaunchHandler(AolLaunchHandler):
  def callbackUrl(self):
    return server_url("/login/openid/aol/callback")


class GoogleLoginCallbackHandler(LoginCallbackHandler):
  def provider(self):
    return identities.GOOGLE_PROVIDER


class YahooLoginCallbackHandler(LoginCallbackHandler):
  def provider(self):
    return identities.YAHOO_PROVIDER


class AolLoginCallbackHandler(LoginCallbackHandler):
  def provider(self):
    return identities.AOL_PROVIDER


def loginIdentityHandlers():
  return 
  




