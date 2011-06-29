from lib.belay import BcapHandler

from google.appengine.ext import db
from google.appengine.ext import webapp

capPrefix = "error://broken/cap/"
privateMap = []

def setHandlers(app, map):
  
  privateMap = map

  
class Handler(BcapHandler):
  def __init__(self, path, entity):
    self.private = {
      'path': path,
      'entity': entity
      }
  
class ProxyHandler(webapp.RequestHandler):
  

def grant(path, item):

def regrant(path, item):
  return grant(path, item)

def revoke(path, item):
  pass
  
def revokeEntity(item):
  pass
