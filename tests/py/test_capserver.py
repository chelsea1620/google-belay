import unittest
from google.appengine.api import memcache
from google.appengine.ext import db
from google.appengine.ext import testbed
import webtest
from belay import *
from google.appengine.ext.webapp import Request
from google.appengine.ext.webapp import Response

class TestModel(db.Model):
  """A model class used for testing."""
  number = db.IntegerProperty(default=42)
  text = db.StringProperty()

class TestEntityGroupRoot(db.Model):
  """Entity group root"""
  pass

def GetEntityViaMemcache(entity_key):
  """Get entity from memcache if available, from datastore if not."""
  entity = memcache.get(entity_key)
  if entity is not None:
    return entity
  entity = TestModel.get(entity_key)
  if entity is not None:
    memcache.set(entity_key, entity)
  return entity
  
  
class HelloHandler(webapp.RequestHandler):
  
  def get(self):
    self.response.out.write('hello')


class TestCapHandler(CapHandler):
  
  def get(self):
    self.bcapResponse({ 'success': True })
  

class DirectCapServerTestCase(unittest.TestCase):

  def setUp(self):
    
    # First, create an instance of the Testbed class.
    self.testbed = testbed.Testbed()
    # Then activate the testbed, which prepares the service stubs for use.
    self.testbed.activate()
    # Next, declare which service stubs you want to use.
    self.testbed.init_datastore_v3_stub()
    self.testbed.init_memcache_stub()

  def tearDown(self):
    self.testbed.deactivate()
    ProxyHandler.__url_mapping__ = None
      
  def testCreateGrant(self):
    entity = TestModel()
    entity.put()
    TestCapHandler.default_internal_url = 'internal_url'
    cap = grant(TestCapHandler, entity)
    self.assertEqual(1, len(Grant.all().fetch(2)))

  def testRegrant(self):
    entity = TestModel()
    entity.put()
    TestCapHandler.default_internal_url = 'internal_url'
    cap = grant(TestCapHandler, entity)
    cap2 = regrant(TestCapHandler, entity)
    self.assertEqual(cap, cap2)
    self.assertEqual(1, len(Grant.all().fetch(2)))


  def testInternalCapRequest(self):
    entity = TestModel()
    entity.put()
    TestCapHandler.default_internal_url = 'internal_url'
    
    req = Request.blank('/internal_url')
    resp = Response()
    handler = TestCapHandler()
    handler.set_entity(entity)
    handler.initialize(req, resp)
    handler.get()
    self.assertEqual(handler.response.out.getvalue(), \
      json.dumps({"value": {"success": True}}))

  def testCapRequest(self):
    set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])

    entity = TestModel()
    entity.put()
    
    extern_url = str(grant(TestCapHandler, entity).key())
    
    self.assertEqual(extern_url, str(Grant.all().fetch(1)[0].key()))

    req = Request.blank('/caps/' + extern_url)
    resp = Response()
    
    handler = ProxyHandler()
    handler.initialize(req, resp)
    handler.get()
    self.assertEqual(handler.response.out.getvalue(), \
      json.dumps({"value": {"success": True}}))
    
  def testWSGI(self):
    app = webapp.WSGIApplication(
      [('/', HelloHandler),
       (r'^/caps/.*', ProxyHandler),
      ], debug=True)
    set_handlers('/caps/', [ ('internal_url', TestCapHandler) ])

    entity = TestModel()
    entity.put()
    
    extern_url1 = str(grant(TestCapHandler, entity).key())
    
    wt = webtest.TestApp(app)
    
    self.assertEqual(wt.get('/').body, 'hello')
    
    resp1 = wt.get('/caps/' + extern_url1)
    self.assertEqual(resp1.body, \
      json.dumps({"value": {"success": True}}))
   
  def testGrantAsString(self): 
    app = webapp.WSGIApplication(
      [ (r'^/caps/.*', ProxyHandler) ], debug=True)
    set_handlers('/caps/', [ ('another_url', TestCapHandler) ])
    
    entity = TestModel()
    entity.put()

    extern_url2 = str(grant('another_url', entity).key())
    
    wt = webtest.TestApp(app)
    resp2 = wt.get('/caps/' + extern_url2)
    self.assertEqual(resp2.body, \
      json.dumps({"value": {"success": True}}))

