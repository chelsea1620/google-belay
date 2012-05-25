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

from openid.store.interface import OpenIDStore
from openid.association import Association
from openid.store import nonce

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

from datetime import datetime
import calendar


class OpenIDAssociationData(db.Model):
    idp_server_url = db.StringProperty(required=True)
    handle = db.StringProperty(required=True)
    secret = db.BlobProperty(required=True)
    issued = db.IntegerProperty(required=True)
    lifetime = db.IntegerProperty(required=True)
    expiry = db.IntegerProperty(required=True)
    assoc_type = db.StringProperty(required=True)


class OpenIDNonceData(db.Model):
    server_url = db.StringProperty(required=True)
    expiry = db.IntegerProperty(required=True)
    salt = db.StringProperty(required=True)


class AppEngineOpenIDStore(OpenIDStore):

    def storeAssociation(self, server_url, association):
        OpenIDAssociationData(
            idp_server_url = server_url,
            handle = association.handle,
            secret = association.secret,
            issued = association.issued,
            lifetime = association.lifetime,
            expiry = (association.issued + association.lifetime),
            assoc_type = association.assoc_type
        ).put()
    
    def getAssociation(self, server_url, handle=None):
        q = (OpenIDAssociationData
            .all()
            .filter('idp_server_url =', server_url)
            .order('-issued'))
        
        if handle:
            q.filter('handle', handle)
        
        results = q.fetch(1)
        if not results:
            return None
        
        r = results[0]

        association = Association(r.handle, 
                                  r.secret, 
                                  r.issued, 
                                  r.lifetime, 
                                  r.assoc_type)
    
        if association.getExpiresIn(self.current_timestamp()) > 0:
            return association
        else:
            return None
    
    def removeAssociation(self, server_url, handle):
        q = (OpenIDAssociationData
            .all()
            .filter('idp_server_url =', server_url)
            .filter('handle =', handle))
        
        for result in q.fetch(1):
            result.delete()
    
    def useNonce(self, server_url, timestamp, salt):
        q = (OpenIDNonceData
            .all()
            .filter('server_url =', server_url)
            .filter('salt =', salt)
            .filter('expiry >=', self.current_timestamp()))
        
        if q.fetch(1):
            return False
        
        data = OpenIDNonceData(
            server_url = server_url,
            expiry = (timestamp + nonce.SKEW),
            salt = salt
        ).put()

        return True
    
    def cleanupNonces(self):
        q = (OpenIDNonceData
            .all()
            .filter('expiry <', self.current_timestamp()))
        db.delete(q)
    
    def cleanupAssociations(self):
        q = (OpenIDAssociationData
            .all()
            .filter('expiry <', self.current_timestamp()))
        db.delete(q)

    def current_timestamp(self):
        current_time = datetime.utcnow()
        return calendar.timegm(current_time.utctimetuple())


class CleanupHandler(webapp.RequestHandler):
    '''
    Task to be invoked by app engine cron to perform cleanup
    of expired associations and nonces.
    '''
    def get(self):
        AppEngineOpenIDStore().cleanup()


application = webapp.WSGIApplication([(r'/cleanup', CleanupHandler)])
