#!/usr/bin/env python

import datetime
import logging
import os

from django.utils import simplejson as json
from belay.belay import *

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app

import capnull as CapServer


server_url = "http://" + os.environ['HTTP_HOST']
  # TODO(mzero): this should be safer



class AccountData(db.Model):
  friend_view = db.ReferenceProprty(Card, required=True)
  
class CardData(db.Model):
  name = db.StringProperty(required=True)
  email = db.EmailProperty()
  image = blobstore.BlobReferenceProperty()
  notes = db.StringProperty()
  # TODO(mzero): needs a refresh_cap property at some point
  
class FriendData(dbModel):
  card = db.ReferenceProperty(Card, required=True)
  in_progress = db.BooleanProperty(default=False)
  new_messages = db.BooleanProperty(default=False)
  remote_box = db.TextProperty()  # cap
  
class MessageData(db.Model):
  when = db.DateTimeProperty(auto_now_add=True)
  message = db.TextProperty()
  capability = db.StringProperty()
  resource_class = db.StringProperty()
  
  def nicedate(self):
    date = self.when
    today = datetime.datetime.now()
    date_ordinal = date.toordinal()
    today_ordinal = today.toordinal()
    format = ""
    if date_ordinal == today_ordinal:
      format = "today"
    elif date_ordinal == today_ordinal - 1:
      format = "yesterday"
    elif date_ordinal > today_ordinal - 7:
      format = '%a'
    elif date.year == today.year:
      format = '%a, %b %d'
    else:
      format = '%a, %b %d %Y'
    format += ' - %I:%M %p'
    return date.strftime(format)

class GenerateHandler(webapp.RequestHandler):
  def get(self):
    account = Account()
    account.put()
    self.xhr_content(CapServer.grant(LaunchHandler, account), "text/plain")


class LaunchHandler(CapServer.Handler):
  def get(self):
    account = self.private.entity
    app = {
	  'caps': {
      'friends':  CapServer.regrant(FriendsListHandler, account),
      'addInvite':  CapServer.regrant(AddInviteHandler, account),
      # TODO(mzero): or should this be just the following?
      'account':  CapServer.regrant(AccountInfoHandler, account),
	    }
	  }
    
    template = """
    var $ = os.jQuery;

    var app = %(app)s;

    $.ajax({
      url: "%(server_url)s/bfriendr.js",
      dataType: "text",
      success: function(data, status, xhr) {
        cajaVM.compileModule(data)({os: os, app: app});
      },
      error: function(xhr, status, error) {
        alert("Failed to load bfriendr: " + status);
      }
    });
    """

    content = template % {
      'app': json.dumps(app),
      'server_url': server_url,
    }
  
    self.xhr_content(content, "text/plain")


class AccountInfoHandler(CapServer.Handler):
  def get(self):
    account = self.private.entity;
    self.bcapResponse({
      'friends':  CapServer.regrant(FriendsListHandler, account),
      'addInvite':  CapServer.regrant(AddInviteHandler, account)
    })
    
  
class FriendsListHandler(CapServer.Handler):
  def get(self):
    account = self.private.entity;

    q = FriendData.all(keys_only=True)
    q.ancestor(account)
    friends = []
    for friendKey in q:
      friends.append(CapServer.regrant(FriendInfoHandler, friendKey))
        # NOTE(mzero): regrant should re-use any existing granted cap
        # NOTE(mzero): 2nd arg should accept a key as well as an entity
    self.bcapResponse(friends)


class FriendInfoHandler(CapSerer.Handler):
  def get(self):
    friend = self.private.entity;
    self.bcapResponse({
      'name':       friend.card.name,
      'email':      friend.card.email,
      'image':      CapServer.regrant(ImageHandler, friend.card),
      'notes':      friend.card.notes,
      'inProgress': friend.in_progress,
      'newMessages': friend.new_mssages, # TODO(mzero): logic doesn't work
      'remoteBox':  friend.remote_box,
      'messageList':  CapServer.regrant(MessageListHandler, friend)
    })
  
  def put(self):
    # TODO(mzero)
    pass
  
  def delete(self):
    friend = self.private.entity
    card = friend.card
    CapServer.revokeEntity(friend)
    CapServer.revokeEntity(card)
      # NOTE(mzero): revocation by entity (or key)
    friend.delete()
    card.delete()
    self.bcapNullResponse()
      # NOTE(mzero)


class MessageListHandler(CapServer.Handler):
  def get(self):
    friend = self.private.entity;

    q = MessageData.all(keys_only=True)
    q.ancestor(friend)
    messages = []
    for messageKey in q:
      messages.append(CapServer.regrant(MessageInfoHandler, messageKey))
    self.bcapResponse({'messages': messages})


class MessageInfoHandler(CapSerer.Handler):
  def get(self):
    message = self.private.entity;
    self.bcapResponse({
      'when':       message.nicedate(),
      'message':    message.message,
      'capability': message.capability,
      'resourceClass':      message.resource_class
    })
  
  def delete(self):
    message = self.private.entity
    CapServer.revokeEntity(message)
    message.delete()
    self.bcapNullResponse()


class MessagePostHandler(CapSerer.Handler):
  def post(self):
    friend = self.private.entity
    request = self.bcapRequest()
    message = MessageData(parent=friend)
    message.message = db.Text(request.message)
    if 'capability' in request:
      message.capability = request.capability
      message.resource_class = request.resourceClass
    message.put()
    self.bcapNullResponse()
  

class AddInviteHandler(CapServer.Handler):
  def post(self):
    account = self.private.entity
    request = self.bcapRequest()

    card = Card(parent=account)
    card.name = request.name
    card.email = request.email
    card.notes = request.notes
    card.put()
    
    friend = Friend(parent=account)
    friend.in_progress = True
    friend.card = card
    friend.put()

    self.bcapResponse({
      'invite': CapServer.grant(InviteInfoHandler, friend)
    })


class InviteHandler(CapServer.Handler):
  def get(self):
    friend = self.private.entity
    account = friend.parent # TODO(mzero): check if you can do this
    fv_card = account.friend_view
    
    self.bcapResponse({
      'name': fv_card.name,
      'email': fv_card.email,
      'image': CapServer.regrant(ImageHandler, fv_card),
      'notes': fv_card.notes,

      'accept': CapServer.grant(InviteAcceptHandler, friend),
    })

class InviteAcceptHandler(CapServer.Handler):
  def post(self):
    friend = self.private.entity
    request = self.bcapRequest()
    
    CapServer.revoke(InviteAcceptHandler, friend);
    CapServer.revokeCurrent(this)
      # NOTE(mzero): revocation ideas
    
    # TODO(mzero): these operations should merge info, not over-write it
    friend.card.name = request.name
    friend.card.email = request.email
    # TODO(mzero): should handle image here
    friend.card.notes = request.notes
    friend.card.put()
    
    friend.remote_box = request.postbox
    friend.in_progress = False
    friend.put()

    self.bcapResponse({
      'postbox': CapServer.grant(MessagePostHandler, friend)
    })


# Externally Visible URL Paths
application = webapp.WSGIApplication(
  [('/cap', CapServer.ProxyHandler),
   ('/generate', GenerateHandler),
  ],
  debug=True)

# Internal Cap Paths
CapServer.setHandlers(
  '/cap',
  [('station/launch',LaunchHandler),
   ('friend/account',AccountInfoHandler),
  
   ('friend/list',   FriendsListHandler),
   ('friend/friend', FriendInfoHandler),
   
   ('friend/messages', MessageListHandler),
   ('friend/message',MessageInfoHandler),
   ('friend/post',   MessagePostHandler),
   
   ('friend/addInvite', AddInviteHandler),
   ('friend/invite', InviteInfoHandler),
   ('friend/accept', InviteAcceptHandler),
  ])



def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
