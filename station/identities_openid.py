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

from openid.consumer import consumer
from openid.extensions import ax
from gae_openid_store import AppEngineOpenIDStore

import datetime
import logging

import identities

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
    
    station = self.get_entity()
    returnCap = regrant(self.callbackClass(), station)
    realm = server_url('')

    form = auth_request.formMarkup(realm, returnCap.serialize(), False, {})

    reply = {
      'page': { 'html': server_url('/addOpenId.html') },
      'info': {
        'formContent': form
      }
    }
    self.bcapResponse(reply)

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
    if ax.data.get(GENDER_ATTR) == 'M':
        attrs['gender'] = ['male']
    elif ax.data.get(GENDER_ATTR) == 'F':
        attrs['gender'] = ['female']
    else:
        attrs['gender'] = ['other']

  logging.info(ax.data.keys())

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
    result = c.complete(args, server_url(self.request.path_info_cap))

    if result.status == consumer.SUCCESS:
        ax_response = ax.FetchResponse.fromSuccessResponse(result)
        if ax_response:
            station = self.get_entity()
            attrs = permuteAttributes(ax_response)

            IdentityData(
                parent=station,
                id_type='openid',
                id_provider=self.provider(),
                account_name=result.identity_url,
                display_name=attrs.get('name', [None])[0],
                attributes=json.dumps(attrs)
            ).put()

        # TODO(iainmcgin): we're not handling missing attributes
        page = self.buildClosePage()
        #page = self.buildDebuggingPage(args, attrs)
    elif result.status == consumer.FAILURE:
        logging.getLogger().info('openid request failed: %s' % result.message)
        page = self.buildFailPage()
    
    self.response.out.write(page)
    self.response.headers.add_header("Cache-Control", "no-cache")
    self.response.headers.add_header("Content-Type", "text/html;charset=UTF-8")
    self.response.headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")

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

class GoogleCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.GOOGLE_PROVIDER


class YahooCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.YAHOO_PROVIDER


class AolCallbackHandler(CallbackHandler):
  def provider(self):
    return identities.AOL_PROVIDER
