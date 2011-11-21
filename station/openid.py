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

class LaunchHandler(CapHandler):
  def get(self):
    args = {}

    reply = {
      'page': { 'html': server_url('/addOpenId.html') },
      'info': {
        'url': self.endpointUrl(),
        'args': self.buildOpenIdArgs()
      }
    }
    self.bcapResponse(reply)

  def buildOpenIdArgs(self):
    station = self.get_entity()
    returnCap = regrant(self.callbackClass(), station)
    realm = server_url('')
    attributes = [
      'http://axschema.org/contact/email',
      'http://axschema.org/contact/verifiedemail',
      'http://axschema.org/namePerson',
      'http://axschema.org/namePerson/first',
      'http://axschema.org/namePerson/last',
      'http://axschema.org/namePerson/friendly',
      'http://axschema.org/media/image/default',
    ]

    args = { }
    args['openid.ns'] = 'http://specs.openid.net/auth/2.0'
    args['openid.mode'] = 'checkid_setup'
    args['openid.claimed_id'] = 'http://specs.openid.net/auth/2.0/identifier_select'
    args['openid.identity'] = 'http://specs.openid.net/auth/2.0/identifier_select'
    args['openid.realm'] = realm
    args['openid.ns.ax'] = 'http://openid.net/srv/ax/1.0'
    args['openid.return_to'] = returnCap.serialize()

    args['openid.ax.mode'] = 'fetch_request'
    aliases = [ ]
    for i in xrange(0,len(attributes)):
      k = 'a%d' % i
      args['openid.ax.type.' + k] = attributes[i]
      aliases.append(k)
    args['openid.ax.required'] = ','.join(aliases)
    
    return args

# TODO(mzero): These should be doing discovery to find the endpoint URLs

class GmailLaunchHandler(LaunchHandler):
  def endpointUrl(self):
    return 'https://www.google.com/accounts/o8/ud'
  
  def callbackClass(self):
    return GmailCallbackHandler


class YahooLaunchHandler(LaunchHandler):
  def endpointUrl(self):
    return 'https://open.login.yahooapis.com/openid/op/auth'
  
  def callbackClass(self):
    return YahooCallbackHandler


class AolLaunchHandler(LaunchHandler):
  def endpointUrl(self):
    return 'https://api.screenname.aol.com/auth/openidServer'
  
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
  
def decodeAttributes(args):
  attrs = dict()
  ns = extractAliases('openid.ns.', args)
  ax_prefix = ns.get('http://openid.net/srv/ax/1.0', None)
  if ax_prefix != None:
    types = extractAliases('openid.' + ax_prefix + '.type.', args)
    for (type, alias) in types.iteritems():
      count = args.get('openid.' + ax_prefix + '.count.' + alias, -1)
      values = []
      if count < 0:
        values.append(args.get('openid.' + ax_prefix + '.value.' + alias, ''))
      else:
        k = 'openid.' + ax_prefix + '.value.' + alias + '.'
        for i in xrange(1, count+1):
          values.append(args.get(k + str(i), ''))
      attrs[type] = values
  return attrs

def permuteAttributes(ax):
  # reform attributes from AX names and format to our names and format
  attrs = dict()

  v = []
  v.extend(ax.get('http://axschema.org/namePerson', []))
  v.extend(ax.get('http://axschema.org/namePerson/friendly', []))
  fns = ax.get('http://axschema.org/namePerson/first', [])
  lns = ax.get('http://axschema.org/namePerson/last', [])
  v.extend([f + ' ' + l for (f, l) in zip(fns,lns)])
    # not clear if the first and last name values sets are 'aligned' like this
  if v:
    attrs['name'] = v
  
  v = []
  v.extend(ax.get('http://axschema.org/contact/verifiedemail', []))
  v.extend(ax.get('http://axschema.org/contact/email', []))
  if v:
    attrs['email'] = v
  
  v = []
  v.extend(ax.get('http://axschema.org/media/image/default', []))
  if v:
    attrs['image'] = v
  
  return attrs


class CallbackHandler(CapHandler):
  def get(self):
    self.handleOpenIdResponse(self.request.GET)
  
  def post(self):
    self.handleOpenIdResponse(self.request.POST)

  def handleOpenIdResponse(self, args):
    # TODO(mzero): check that the response is a postiive assertion:
      # opendid.mode == 'id_res'
      
    # TODO(mzero): check signature
    # 1) check that openid.return_to == current URL of current request
    #     check that scheme, authority and path match
    #     check that all query args in openid.return_to are in current URL
    # 2) do discovery on openid.claimed_id and make sure it points back at
    #     the opendid.idenity, openid.op_endpoint, and openid.ns
    # 3) check that the openid.response_nonce hasn't been used before by this OP
    # 4) resend the query to the OP w/openid.mode = check_authentication
    
    station = self.get_entity()
    ax = decodeAttributes(args)
    attrs = permuteAttributes(ax)
        
    IdentityData(parent=station,
      id_type='openid',
      id_provider=self.provider(),
      account_name=args['openid.claimed_id'],
      display_name=attrs.get('name', [None])[0],
      attributes=json.dumps(attrs)
      ).put()
    
    page = self.buildClosePage()
    #page = self.buildDebuggingPage(args, ax)
    
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


class GmailCallbackHandler(CallbackHandler):
  def provider(self):
    return 'Gmail'


class YahooCallbackHandler(CallbackHandler):
  def provider(self):
    return 'Yahoo'


class AolCallbackHandler(CallbackHandler):
  def provider(self):
    return 'AOL'
