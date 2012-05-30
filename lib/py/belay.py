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

"""Abstractions for writing Belay servers for AppEngine."""

import logging
import os
import uuid
import urlparse
import json
import re

from google.appengine.api import urlfetch
from google.appengine.ext import db
from google.appengine.ext import webapp


class BelayException(Exception):
  pass
  


#
# Capabilities
#
  
# NOTE(jpolitz): BcapHandlers and urlfetch.fetch() return different data
# structures.  invokeCapURL() needs to handle both, since it simulates a
# local HTTP cap invocation through ProxyHandler.
# If the invocation is of a normal capability, the value of the invocation
# is processed normally.  However, if the response is an image, the form of
# the response is that of a urlfetch.fetch() response object in both cases:
# http://code.google.com/appengine/docs/python/urlfetch/responseobjects.html

class Capability(object):
  """An abstraction of a Belay capability, which provides
  the facility to invoke other server-side capabilities which
  may be handled by the local server, or dispatched as an HTTP
  request to a remote server. Additionally, a serialization facility is
  provided to convert a Capability instance to its canonical URL form.

  """
  def __init__(self, cap_server, url=None, uuid=None):
    self.cap_server = cap_server
    
    if url:
      self.local = url.startswith(cap_server.public_prefix)
      self.url = url
    elif uuid:
      self.local = True
      self.url = cap_server.public_prefix + uuid
    else:
      raise TypeError('Capability needs either a url or a uuid parameter)')
    
  def serialize(self):
    return self.url

  def invoke(self, method, data = None):
    """Attempts to invoke the capability using the method specified
    (which should be one of GET, POST, PUT or DELETE). A data value
    can optionally be passed, which will be serialized on the
    caller's behalf. The invocation will be performed synchronously;
    if it fails a BcapException will be raised, otherwise the response
    value provided by the capability will be returned.

    """
    if data != None:
      data=self.cap_server.data_pre_process(data)

    if self.local:
      return self._invoke_local(method, data)
    else:
      return self._invoke_remote(method, data)

  def _invoke_local(self, method, data=""):
    handler = ProxyHandler()
    req = webapp.Request.blank(self.url)
    req.route = webapp.BaseRoute(None)
    req.route_args = ()
    req.route_kwargs = {}
    req.method = method
    if data != None:
      req.body = data
    handler.initialize(req, webapp.Response())
    handler.dispatch()

    result = handler.response
    
    if re.match('image/.*', result.headers['Content-Type']):
      # TODO(jpolitz): is this sufficient wrapping?
      class Wrapper(object):
        def __init__(self):
          self.content = result.body
          self.content_was_truncated = False
          self.status_code = 200 
          self.headers = result.headers
          self.final_url = capURL

      return Wrapper()
    else:
      return self.cap_server.data_post_process(result.body)

  def _invoke_remote(self, method, data=""):
    result = urlfetch.fetch(capURL, method=meth, payload=data) 
    if result.status_code >= 400 and request.status_code <= 600:
      raise BcapException('CapServer: remote invoke of ' + capURL + ' failed.')
    elif re.match('image/.*', result.headers['Content-Type']):
      return result 
    else:
      return self.cap_server.data_post_process(result.content)


class _Grant(db.Model):
  cap_id = db.StringProperty(required=True, indexed=True)
  # internal URL passed to the cap handler
  internal_path = db.StringProperty(required=True)
  # reference to DB item passed to cap handler
  db_entity = db.ReferenceProperty(required=True)


def _get_path(path_or_handler):
  if isinstance(path_or_handler, str):
    return path_or_handler
  elif issubclass(path_or_handler, CapHandler):
    return path_or_handler.default_internal_url
  else:
    raise BelayException('CapServer:_get_path::expected string or CapHandler')


class CapServer(object):
  def __init__(self, public_prefix):
    self.public_prefix = public_prefix

  def restore(self, url):
    return Capability(self, url=url)

  def data_pre_process(self, data):
    """Transforms a python object into a JSON string, ensuring that
    fields in the object which are Capability instances are encoded
    using a convention that allows such values to be detected
    and decoded correctly be the receiver.

    """
    def cap_encoder(obj):
      if isinstance(obj, Capability):
        return {'@': obj.serialize()}
      else:
        raise TypeError()

    try:
      return json.dumps({'value': data}, default=cap_encoder)
    except TypeError as exn:
      logging.debug(str(exn))
      raise

  def data_post_process(self, serialized):
    """Transforms a JSON string into a Python object, detecting any
    capability values in the structure and deserializing them as
    Capability instances.

    """
    def cap_decoder(obj):
      if '@' in obj:
        return self.restore(obj['@'])
      else:
        return obj
        
    try:
      return json.loads(serialized, object_hook=cap_decoder)['value']
    except ValueError as exn:
      logging.debug(str(exn))
      raise

  def grant(self, path_or_handler, entity):
    """Grants a new, unique capability to invoke the specified handler,
    with the specified entity bound. The handler must be a subclass of 
    CapHandler, and the entity must have already been persisted prior
    to requesting the grant of a capability.

    """
    path = _get_path(path_or_handler)
    cap_id = str(uuid.uuid4())
    item = _Grant(cap_id=cap_id, internal_path=path, db_entity=entity)
    item.put()
    return Capability(self, uuid=cap_id)

  def regrant(self, path_or_handler, entity):
    """Grants either a new, unique capability to invoke the specified
    handler, or returns a capability which was made by a previous
    call to either grant or regrant where the handler and entity are
    the same.

    """
    path = _get_path(path_or_handler)
    items = _Grant.all().filter("internal_path = ", path) \
                       .filter("db_entity = ", entity) \
                       .fetch(2)
    if(len(items) > 1):
      raise BelayException('CapServer:regrant::ambiguous internal_path in regrant')

    if len(items) == 1:
      return Capability(self, uuid=items[0].cap_id)
    else:
      return self.grant(path_or_handler, entity)

  @staticmethod
  def revoke(path_or_handler, entity):
    """Revokes all capabilities which have been issued to the specified
    handler, with the specified entity bound.

    """
    path = _get_path(path_or_handler)
    items = _Grant.all().filter("internal_path = ", path) \
                       .filter("db_entity = ", entity)
    db.delete(items)

  @staticmethod
  def revoke_entity(entity):
    """Revokes all capabilities which have been issued that have the
    specified entity bound.

    """
    q = _Grant.all(keys_only=True).filter("db_entity = ", entity)
    db.delete(q)


    
class BcapHandler(webapp.RequestHandler):
  """A base class which implements the details of the BCAP protocol binding 
  for HTTP. Handlers for well-known capabilities which have no bound entity may 
  extend directly from this class. 

  This class will respond to HTTP OPTIONS requests
  indicating that the handler can be invoked from any origin, using
  the method indicated in the request (effectively allowing any method).
  Utility methods are provided for responding to requests with
  similarly configured CORS headers.

  """
  def initialize(self, request, response):
    super(BcapHandler, self).initialize(request, response)
    if request:
      self.cap_server = CapServer(self.server_url(ProxyHandler.cap_prefix))
  
  def _this_server_url_prefix(self):
    """Returns the detected URL prefix of the currently running server, 
    which is composed of the protocol (http or https), the domain name
    and the port (if non-standard for the protocol in use).

    Example return values: 
     * ``https://www.example.com:8443``
     * ``http://www.example.com``

    """
    prefix = 'http://'
    default_port = 80
    if os.environ.get('HTTPS', 'off') == 'on':
      prefix = 'https://'
      default_port = 443

    prefix += self.request.server_name
    if self.request.server_port and self.request.server_port != default_port:
      prefix += ":%d" % self.request.server_port

    return prefix

  def server_url(self, path):
    """Prefixes the provided, root-relative path with the detected
    origin of the currently running server.

    If the current origin were ``http://www.example.com:8080``, then

     * ``server_url("/favicon.ico") == "http://www.example.com:8080/favicon.ico"``
     * ``server_url("bad") == "http://www.example.com:8080bad"``

    """
    return self._this_server_url_prefix() + path

  def xhr_response(self):
    self.response.headers["Access-Control-Allow-Origin"] = "*"

  def xhr_content(self, content, content_type):
    """Responds to the request with the provided content and content_type,
    includes the necessary headers to allow cross origin requests
    to this handler, and indicates to the client that no caching should be
    utilised on the response.

    """
    self.xhr_response()
    self.response.headers["Cache-Control"] = "no-cache"
    self.response.headers["Expires"] = "Fri, 01 Jan 1990 00:00:00 GMT"
    self.response.content_type = content_type
    self.response.unicode_body = unicode(content)

  def bcapRequest(self):
    """Convenience method which can be used to decode a JSON request
    body which is expected to contain capabilities.

    """
    return self.cap_server.data_post_process(self.request.body)
      
  def bcapResponse(self, jsonResp):
    """Convenience method which can be used to respond to a request
    with a JSON encodable value that may contain capabilities, and
    also set the necessary headers to allow cross origin
    requests.

    """
    resp = self.cap_server.data_pre_process(jsonResp)
    self.xhr_content(resp, "text/plain;charset=UTF-8")

  def bcapNullResponse(self):
    """Convenience method which can be used to provide an empty
    response to a request, with the necessary headers set to allow
    cross origin requests.

    """
    self.xhr_response()
    
  # allows cross-domain requests  
  def options(self):
    m = self.request.headers["Access-Control-Request-Method"]
    h = self.request.headers.get("Access-Control-Request-Headers", None)

    self.response.headers["Access-Control-Allow-Origin"] = "*"
    self.response.headers["Access-Control-Max-Age"] = "2592000"
    self.response.headers["Access-Control-Allow-Methods"] = m      
    if h:
      self.response.headers["Access-Control-Allow-Headers"] = h
    else:
      pass


# Base class for handlers that process capability invocations.
class CapHandler(BcapHandler):
  """The base class for all capability handlers.
  Provides utility methods to retrieve the datastore entity
  which was bound to the capability when it was granted, in
  addition to the utilities provided by BcapHandler.

  """

  def set_entity(self, entity):
    self.entity = entity

  def get_entity(self):
    return self.entity




# A WSGIApplication handler that invokes granted capabilities.
class ProxyHandler(BcapHandler):
  """The capability proxy handler, which is used to service
  capability requests and forward them to the correct handler,
  if the capability exists and has not been revoked.

  """

  cap_prefix = '/caps/'
  __prefix_strip_length__ = len(cap_prefix)
  __url_mapping__ = None
  
  @classmethod
  def _set_cap_prefix(klass, cap_prefix):
    if not cap_prefix.startswith('/'):
      cap_prefix = '/' + cap_prefix
    if not cap_prefix.endswith('/'):
      cap_prefix += '/'

    klass.cap_prefix = cap_prefix
    klass.__prefix_strip_length__ = len(cap_prefix)

  @classmethod
  def _set_url_map(klass, url_mapping):
    if klass.__url_mapping__ is not None: # do not reinit (FastCGI)
      return
    
    klass.__url_mapping__ = { }
    for (url, handler_class) in url_mapping:
      if hasattr(handler_class, 'default_internal_url'):
        pass
      else:
        handler_class.default_internal_url = url
      klass.__url_mapping__[url] = handler_class

  def dispatch(self):
    # Strip the '/caps/' prefix off self.request.path
    cap_id = self.request.path_info[self.__class__.__prefix_strip_length__:]

    grants = _Grant.all().filter('cap_id =', cap_id).fetch(2)

    if len(grants) == 0:
      self.bcapNullResponse()
      self.response.status = 404
      self.response.body = "ProxyHandler.init_cap_handler: " + \
                              "Cap not found: %s\n" % cap_id
      return
    if len(grants) > 1:
      raise BelayException('Multiple grants found for %s' % cap_id)

    grant = grants[0]

    self.request.path_info_cap = self.request.path_info
      # retain the original cap request path
    self.request.path_info = grant.internal_path # handler sees private path

    item = grant.db_entity 

    handler_class = self.__url_mapping__[grant.internal_path]
    handler = handler_class(self.request, self.response)
    handler.set_entity(item)
    handler.dispatch()

  

def set_handlers(cap_prefix, path_map):
  """Initialises the ProxyHandler with a set of 
  (string -> CapHandler) mappings. The string "names" assigned to
  the CapHandlers are used in place of their fully qualified class
  names when capabilities are issued in order to make long lived 
  capabilities resilient to changes in the handler's class name 
  (allowing for refactoring to occur at a later date without
  reissuing capabilities).

  This method should be called as part of initialising the WSGI
  application descriptor for your application.

  """
  ProxyHandler._set_cap_prefix(cap_prefix)
  ProxyHandler._set_url_map(path_map)

