import unittest
import logging
from google.appengine.api import memcache
from google.appengine.ext import db
from google.appengine.ext import testbed
from google.appengine.ext import webapp
from lib.belay import *

from google.appengine.ext.webapp import Request
from google.appengine.ext.webapp import Response
from google.appengine.ext.webapp.util import run_wsgi_app


class TestModel(db.Model):
  """A model class used for testing."""
  number = db.IntegerProperty(default=42)
  text = db.StringProperty()

class PingHandler(webapp.RequestHandler):
  
  def get(self):
    self.response.out.write('{ "value": "pong" }')


class TestCapHandler(CapHandler):
  
  def get(self):
    self.bcapResponse({ 'success': True })
  

class Defaults(unittest.TestCase):

  def setUp(self):
    self.testbed = testbed.Testbed()
    self.testbed.activate()
    self.testbed.init_datastore_v3_stub()
    self.entity = TestModel()
    self.entity.put()

  def tearDown(self):
    self.testbed.deactivate()
    ProxyHandler.__url_mapping__ = None


class DirectCapServerTestCase(Defaults):

  def setUp(self):
    super(DirectCapServerTestCase, self).setUp()
    self.entity = TestModel()
    self.entity.put()

  def testCreateGrant(self):
    TestCapHandler.default_internal_url = 'internal_url'
    cap = grant(TestCapHandler, self.entity)
    self.assertEqual(1, len(Grant.all().fetch(2)))

  def testRegrant(self):
    TestCapHandler.default_internal_url = 'internal_url'
    cap = grant(TestCapHandler, self.entity)
    cap2 = regrant(TestCapHandler, self.entity)
    self.assertEqual(cap, cap2)
    self.assertEqual(1, len(Grant.all().fetch(2)))

  def testRegrantStr(self):
    cap = grant('internal', self.entity)
    cap2 = regrant('internal', self.entity)
    self.assertEqual(cap, cap2)
    self.assertEqual(1, len(Grant.all().fetch(2)))

  def testInternalCapRequest(self):
    TestCapHandler.default_internal_url = 'internal_url'
    
    req = Request.blank('/internal_url')
    resp = Response()
    handler = TestCapHandler()
    handler.set_entity(self.entity)
    handler.initialize(req, resp)
    handler.get()
    self.assertEqual(handler.response.out.getvalue(), \
      json.dumps({"value": {"success": True}}))

  def testCapRequest(self):
    set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])

    extern_url = grant(TestCapHandler, self.entity)
     
    req = Request.blank(extern_url)
    resp = Response()
    
    handler = ProxyHandler()
    handler.initialize(req, resp)
    handler.get()
    self.assertEqual(handler.response.out.getvalue(), \
      json.dumps({"value": {"success": True}}))
      

class GrantHandler(BcapHandler):
  
  def get(self):
    test_entity = TestModel()
    test_entity.put()
    
    ser_cap = grant(TestCapHandler, test_entity)
    self.bcapResponse(ser_cap)

class GrantStringHandler(BcapHandler):

  def get(self):
    test_entity = TestModel()
    test_entity.put()

    ser_cap = grant('internal_url', test_entity)
    self.bcapResponse(ser_cap)


def main():
  logging.getLogger().setLevel(logging.DEBUG)
  
  application = webapp.WSGIApplication(
    [('/ping', PingHandler),
     ('/test_entry/grant', GrantHandler),
     ('/test_entry/grantWithString', GrantStringHandler),
     (r'^/caps/.*', ProxyHandler),
    ], debug=True)
  
  set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])

  run_wsgi_app(application)

if __name__ == "__main__":
  main()
