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

from station.gae_openid_store import *
import unittest

from openid.association import Association
from openid.store import nonce

from google.appengine.ext import db
from google.appengine.ext import testbed

from datetime import datetime
import calendar

class AppEngineOpenIDStoreTest(unittest.TestCase):

    test_time = 0

    def setUp(self):
        self.test_time = 0
        self.testbed = testbed.Testbed()
        self.testbed.activate()
        self.testbed.init_datastore_v3_stub()
        self.store = AppEngineOpenIDStore()

        # monkey patch the timestamp facility in the store to
        # make testing easier
        self.store.current_timestamp = lambda: self.test_time
    
    def tearDown(self):
        self.testbed.deactivate()
    
    def test_store_retrieve_association(self):
        assoc = Association(
            'handle', 
            'secret',
            0,
            10000,
            'HMAC-SHA1')
        
        self.store.storeAssociation('http://provider.com', assoc)
        retrieved = self.store.getAssociation('http://provider.com', 'handle')
        self.assertTrue(retrieved is not None)
        self.assertEqual(assoc.handle, retrieved.handle)
        self.assertEqual(assoc.secret, retrieved.secret)
        self.assertEqual(assoc.issued, retrieved.issued)
        self.assertEqual(assoc.lifetime, retrieved.lifetime)
        self.assertEqual(assoc.assoc_type, retrieved.assoc_type)
    
    def test_store_retrieve_expired_association(self):
        assoc = Association(
            'handle', 
            'secret',
            0,
            10,
            'HMAC-SHA1')
        
        self.store.storeAssociation('http://provider.com', assoc)

        self.test_time = 9
        retrieved = self.store.getAssociation('http://provider.com', 'handle')
        self.assertTrue(retrieved is not None)

        self.test_time = 11
        retrieved = self.store.getAssociation('http://provider.com', 'handle')
        # the association has now expired, so we should not get anything back
        self.assertTrue(retrieved is None)
    
    def test_use_nonce(self):
        useNonce = self.store.useNonce
        url = 'http://provider.com'
        self.assertTrue(useNonce(url, 0, 'salt'))
        self.assertTrue(useNonce(url, 100, 'pepper'))
        
        # reuse before expiry will fail
        self.assertFalse(useNonce(url, 100, 'salt'))

        # simulate time passing to after the expiry for 'salt', 
        # but before 'pepper'
        self.test_time = nonce.SKEW + 1
        self.assertTrue(useNonce(url, self.test_time, 'salt'))
        self.assertFalse(useNonce(url, self.test_time, 'pepper'))

if __name__ == "__main__":
  unittest.main()
