import lib.belay as Belay

from google.appengine.ext import db
from google.appengine.ext import webapp

capPrefix = "error://broken/cap/"
privateMap = []

def setHandlers(prefix, map):
  global capPrefix, privateMap
  capPrefix = prefix
  privateMap = map

  
class Handler(Belay.CapHandler):
  def __init__(self, path, entity):
    self.private = {
      'path': path,
      'entity': entity
      }
  
class ProxyHandler(webapp.RequestHandler):
  pass

def grant(path_or_handler, item):
  path = Belay.get_path(path_or_handler)
  return "%s?path=%s&item=%s" % (capPrefix, path, str(item.key()))

def regrant(path, item):
  return grant(path, item)

def revoke(path, item):
  pass
  
def revokeEntity(item):
  pass
