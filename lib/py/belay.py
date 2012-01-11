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
#import json # TODO(mzero): add back for Python27
import re

from django.utils import simplejson as json # TODO(mzero): remove for Python27

from google.appengine.api import urlfetch
from google.appengine.ext import db
from google.appengine.ext import webapp


def this_server_url_prefix():
  """Returns the detected URL prefix of the currently running server, 
  which is composed of the protocol (http or https), the domain name
  and the port (if non-standard for the protocol in use).

  Example return values: 
   * ``https://www.example.com:8443``
   * ``http://www.example.com``

  """
  server_name = os.environ['SERVER_NAME']
  server_port = int(os.environ['SERVER_PORT'])
  
  prefix = 'http://'
  default_port = 80
  if os.environ.get('HTTPS', 'off') == 'on':
    prefix = 'https://'
    default_port = 443
    
  prefix += server_name
  if server_port != default_port:
    prefix += ":%d" % server_port
    
  return prefix

def server_url(path):
  """Prefixes the provided, root-relative path with the detected
  origin of the currently running server.

  If the current origin were ``http://www.example.com:8080``, then

   * ``server_url("/favicon.ico") == "http://www.example.com:8080/favicon.ico"``
   * ``server_url("bad") == "http://www.example.com:8080bad"``

  """
  return this_server_url_prefix() + path
  
  
class BelayException(Exception):
  pass
  


#
# Capabilities
#
def _invokeLocalCap(capURL, method, data=""):
  handler = ProxyHandler()
  req = webapp.Request.blank(capURL)
  req.body = data
  handler.initialize(req, webapp.Response())

  if method == 'GET':
    handler.get()
  elif method == 'PUT':
    handler.put()
  elif method == 'POST':
    handler.post()
  elif method == 'DELETE':
    handler.delete()
  else:
    raise BcapException("invokeLocalCap: Bad method: " + method)

  return handler.response
  
# NOTE(jpolitz): BcapHandlers and urlfetch.fetch() return different data
# structures.  invokeCapURL() needs to handle both, since it simulates a
# local HTTP cap invocation through ProxyHandler.
# If the invocation is of a normal capability, the value of the invocation
# is processed normally.  However, if the response is an image, the form of
# the response is that of a urlfetch.fetch() response object in both cases:
# http://code.google.com/appengine/docs/python/urlfetch/responseobjects.html
def _invokeCapURL(capURL, meth, data=""):
  parsed = urlparse.urlparse(capURL)
  prefix = this_server_url_prefix()

  parsed_prefix = parsed.scheme + "://" + parsed.netloc

  if parsed_prefix == prefix:
    result = _invokeLocalCap(parsed.path, meth, data)
    # TODO(jpolitz): other Content-Types
    if re.match('image/.*', result.headers['Content-Type']):
      # TODO(jpolitz): is this sufficient wrapping?
      class Wrapper(object):
        def __init__(self):
          self.content = result.out.getvalue()
          self.content_was_truncated = False
          self.status_code = 200 
          self.headers = result.headers
          self.final_url = capURL

      return Wrapper()
    else:
      return dataPostProcess(result.out.getvalue())
  else:
    result = urlfetch.fetch(capURL, method=meth, payload=data) 
    if result.status_code >= 400 and request.status_code <= 600:
      raise BcapException('CapServer: remote invoke of ' + capURL + ' failed.')
    elif re.match('image/.*', result.headers['Content-Type']):
      return result 
    else:
      return dataPostProcess(result.content)

class Capability(object):
  """An abstraction of a Belay capability, which provides
  the facility to invoke other server-side capabilities which
  may be handled by the local server, or dispatched as an HTTP
  request to a remote server. Additionally, a serialization facility is
  provided to convert a Capability instance to its canonical URL form.

  """
  def __init__(self, ser):
    self.ser = ser

  def invoke(self, method, data = None):
    """Attempts to invoke the capability using the method specified
    (which should be one of GET, POST, PUT or DELETE). A data value
    can optionally be passed, which will be serialized on the
    caller's behalf. The invocation will be performed synchronously;
    if it fails a BcapException will be raised, otherwise the response
    value provided by the capability will be returned.

    """
    #TODO(jpolitz): separate impls in python---all are essentially implURLSync
    if data != None:
      response = _invokeCapURL(self.ser, method, data=dataPreProcess(data))
    else:
      response = _invokeCapURL(self.ser, method)

    return response
     
  def serialize(self):
    """Returns the serialized, URL form of the capability as a string"""
    return self.ser

def dataPreProcess(data):
  """Transforms a python object into a JSON string, ensuring that
  fields in the object which are Capability instances are encoded
  using a convention that allows such values to be detected
  and decoded correctly be the receiver.

  """
  class Decapitator(json.JSONEncoder):
    def default(self, obj):
      if isinstance(obj, Capability):
        return {'@': obj.serialize()}
      else:
        return obj

  try:
    return json.dumps({'value': data}, cls=Decapitator)
  # TODO(mzero): use better exception handler when on Python 2.7
  #  except TypeError as exn:
  #    logging.debug(str(exn))
  except TypeError:
    logging.debug("Unserializable: " + str(data))

def dataPostProcess(serialized):
  """Transforms a JSON string into a Python object, detecting any
  capability values in the structure and deserializing them as
  Capability instances.

  """
  def capitate(obj):
    if '@' in obj:
      return Capability(obj['@'])
    else:
      return obj
  try:
    return json.loads(serialized, object_hook=capitate)['value']
  # TODO(mzero): use better exception handler when on Python 2.7
  #  except ValueError as exn:
  #    logging.debug(str(exn))
  except ValueError:
    logging.debug("Unloadable: " + str(serialized))
      
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
  
  def xhr_response(self):
    self.response.headers.add_header("Access-Control-Allow-Origin", "*")

  def xhr_content(self, content, content_type):
    """Responds to the request with the provided content and content_type,
    includes the necessary headers to allow cross origin requests
    to this handler, and indicates to the client that no caching should be
    utilised on the response.

    """
    self.xhr_response()
    self.response.out.write(content)
    self.response.headers.add_header("Cache-Control", "no-cache")
    self.response.headers.add_header("Content-Type", content_type)
    self.response.headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")

  def bcapRequest(self):
    """Convenience method which can be used to decode a JSON request
    body which is expected to contain capabilities.

    """
    return dataPostProcess(self.request.body)
      
  def bcapResponse(self, jsonResp):
    """Convenience method which can be used to respond to a request
    with a JSON encodable value that may contain capabilities, and
    also set the necessary headers to allow cross origin
    requests.

    """
    resp = dataPreProcess(jsonResp)
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
    self.__entity__ = entity

  def get_entity(self):
    return self.__entity__


class _Grant(db.Model):
  cap_id = db.StringProperty(required=True, indexed=True)
  # internal URL passed to the cap handler
  internal_path = db.StringProperty(required=True)
  # reference to DB item passed to cap handler
  db_entity = db.ReferenceProperty(required=True)


# A WSGIApplication handler that invokes granted capabilities.
class ProxyHandler(BcapHandler):
  """The capability proxy handler, which is used to service
  capability requests and forward them to the correct handler,
  if the capability exists and has not been revoked.

  """

  default_prefix = '/caps/'
  prefix_strip_length = len(default_prefix)
  
  __url_mapping__ = None
  
  @classmethod
  def setUrlMap(klass, url_mapping):
    if klass.__url_mapping__ is not None: # do not reinit (FastCGI)
      return
    
    klass.__url_mapping__ = { }
    for (url, handler_class) in url_mapping:
      if hasattr(handler_class, 'default_internal_url'):
        pass
      else:
        handler_class.default_internal_url = url
      klass.__url_mapping__[url] = handler_class

  def __init__(self):
    pass

  def init_cap_handler(self):
    # Strip the '/caps/' prefix off self.request.path
    cap_id = self.request.path_info[self.__class__.prefix_strip_length:]

    grants = _Grant.all().filter('cap_id =', cap_id).fetch(2)

    if len(grants) == 0:
      self.bcapNullResponse()
      self.response.set_status(404)
      self.response.out.write("ProxyHandler.init_cap_handler: " + \
                              "Cap not found: %s\n" % cap_id)
      return
    if len(grants) > 1:
      # TODO(arjun): appropriate error in response
      raise BelayException('%s, %s' % (self.request.path_info, cap_id))

    grant = grants[0]
    handler_class = self.__url_mapping__[grant.internal_path]
    # instantiates appropriate subclass of db.Model
    item = grant.db_entity 

    handler = handler_class()
    handler.set_entity(item)

    self.request.path_info_cap = self.request.path_info
      # retain the original cap request path
    self.request.path_info = grant.internal_path # handler sees private path
    handler.initialize(self.request, self.response)
    return handler

  def get(self):
    handler = self.init_cap_handler()
    if handler is None:
      pass
    else:
      handler.get()

  def post(self):
    handler = self.init_cap_handler()
    if handler is None:
      pass
    else:
      handler.post()

  def put(self):
    handler = self.init_cap_handler()
    if handler is None:
      pass
    else:
      handler.put()

  def delete(self):
    handler = self.init_cap_handler()
    if handler is None:
      pass
    else:
      handler.delete()



def _get_path(path_or_handler):
  if isinstance(path_or_handler, str):
    return path_or_handler
  elif issubclass(path_or_handler, CapHandler):
    return path_or_handler.default_internal_url
  else:
    raise BelayException('CapServer:_get_path::expected string or CapHandler')
     

def grant(path_or_handler, entity):
  """Grants a new, unique capability to invoke the specified handler,
  with the specified entity bound. The handler must be a subclass of 
  CapHandler, and the entity must have already been persisted prior
  to requesting the grant of a capability.

  """
  path = _get_path(path_or_handler)
  cap_id = str(uuid.uuid4())
  item = _Grant(cap_id=cap_id, internal_path=path, db_entity=entity)
  item.put()
  return Capability(ProxyHandler.default_prefix + cap_id)

def regrant(path_or_handler, entity):
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
    return Capability(ProxyHandler.default_prefix + items[0].cap_id)
  else:
    return grant(path_or_handler, entity)

def revoke(path_or_handler, entity):
  """Revokes all capabilities which have been issued to the specified
  handler, with the specified entity bound.

  """
  path = _get_path(path_or_handler)
  items = _Grant.all().filter("internal_path = ", path) \
                     .filter("db_entity = ", entity)
  db.delete(items)

def revokeEntity(entity):
  """Revokes all capabilities which have been issued that have the
  specified entity bound.

  """
  q = _Grant.all(keys_only=True).filter("db_entity = ", entity)
  db.delete(q)
  

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
  if not cap_prefix.startswith('/'):
    cap_prefix = '/' + cap_prefix
  if not cap_prefix.endswith('/'):
    cap_prefix += '/'
  
  ProxyHandler.prefix_strip_length = len(cap_prefix)
  ProxyHandler.default_prefix = this_server_url_prefix() + cap_prefix
  ProxyHandler.setUrlMap(path_map)
