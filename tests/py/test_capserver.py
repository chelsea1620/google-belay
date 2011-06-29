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

if not (__name__ == '__main__'):
  import webtest
else:
  pass

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
    self.assertEqual(cap.key(), cap2.key())
    self.assertEqual(1, len(Grant.all().fetch(2)))

  def testRegrantStr(self):
    cap = grant('internal', self.entity)
    cap2 = regrant('internal', self.entity)
    self.assertEqual(str(cap.key()), str(cap2.key()))
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

    extern_url = str(grant(TestCapHandler, self.entity).key())
    
    self.assertEqual(extern_url, str(Grant.all().fetch(1)[0].key()))

    req = Request.blank('/caps/' + extern_url)
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
    
    
class WSGITestCases(Defaults):

  def setUp(self):
    super(WSGITestCases, self).setUp()
    self.app = webapp.WSGIApplication(
      [('/ping', PingHandler),
       (r'^/caps/.*', ProxyHandler),
      ], debug=True)

  def testWSGI(self):
    set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])

    extern_url1 = str(grant(TestCapHandler, self.entity).key())
    
    wt = webtest.TestApp(self.app)
    self.assertEqual(wt.get('/').body, 'hello')
    resp1 = wt.get('/caps/' + extern_url1)
    self.assertEqual(resp1.body, \
      json.dumps({"value": {"success": True}}))
   
  def testWSGIWithString(self): 
    set_handlers('/caps/', [ ('another_url', TestCapHandler) ])
    
    extern_url2 = str(grant('another_url', self.entity).key())
    
    wt = webtest.TestApp(self.app)
    resp2 = wt.get('/caps/' + extern_url2)
    self.assertEqual(resp2.body, \
      json.dumps({"value": {"success": True}}))



def main():
  logging.getLogger().setLevel(logging.DEBUG)
  
  application = webapp.WSGIApplication(
    [('/ping', PingHandler),
     ('/wellknowncaps/grant', GrantHandler),
     (r'^/caps/.*', ProxyHandler),
    ], debug=True)
  
  set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])
  
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
