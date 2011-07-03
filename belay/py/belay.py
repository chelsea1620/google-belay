"""Abstractions for writing Belay servers for AppEngine."""

from google.appengine.ext import webapp
from django.utils import simplejson as json
import logging

def xhr_response(response):
  response.headers.add_header("Access-Control-Allow-Origin", "*")

def xhr_content(content, content_type, response):
  xhr_response(response)
  response.out.write(content)
  response.headers.add_header("Cache-Control", "no-cache")
  response.headers.add_header("Content-Type", content_type)
  response.headers.add_header("Expires", "Fri, 01 Jan 1990 00:00:00 GMT")

class BcapHandler(webapp.RequestHandler):  
  
  def bcapRequest(self):
      return json.loads(self.request.body)['value']
      
  def bcapResponse(self, jsonResp):
    resp = json.dumps({ 'value': jsonResp })
    xhr_content(resp, "text/plain;charset=UTF-8", self.response)

  # allows cross-domain requests  
  def options(self):
    m = self.request.headers["Access-Control-Request-Method"]
    h = self.request.headers["Access-Control-Request-Headers"]

    self.response.headers["Access-Control-Allow-Origin"] = "*"
    self.response.headers["Access-Control-Max-Age"] = "2592000"
    self.response.headers["Access-Control-Allow-Methods"] = m      
    if h:
      self.response.headers["Access-Control-Allow-Headers"] = h
