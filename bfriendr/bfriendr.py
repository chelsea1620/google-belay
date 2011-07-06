#!/usr/bin/env python

import datetime
import logging
import os

import lib.belay as CapServer

from django.utils import simplejson as json

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app



server_url = "http://" + os.environ['HTTP_HOST']
  # TODO(mzero): this should be safer

def delete_entity(entity):
  CapServer.revokeEntity(entity)
  entity.delete()


class CardData(db.Model):
  name = db.StringProperty(default='')
  email = db.StringProperty(default='')
  image = db.BlobProperty(default=None)
  imageType = db.StringProperty(default='')
  notes = db.StringProperty()
  # TODO(mzero): needs a refresh_cap property at some point
  
  def toJSON(self):
    cardJSON = {
      'name':       self.name,
      'email':      self.email,
      'notes':      self.notes,
    }
    if self.imageType:
      cardJSON['image'] = CapServer.regrant(ImageHandler, self)
    return cardJSON

  
  def deleteAll(self):
    delete_entity(self)
  
class FriendData(db.Model):
  card = db.ReferenceProperty(CardData, required=True)
  read_their_stream = db.StringProperty()

  def deleteAll(self):
    self.card.deleteAll()
    q = MessageData.all()
    q.ancestor(self)
    for message in q:
      message.deleteAll()
    delete_entity(self)

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

  def deleteAll(self):
    delete_entity(self)

  def toJSON(self):
    return {'message': self.message,
            'when': str(self.when),
            'capability': str(self.capability),
            'resource_class': str(self.resource_class)}

class AccountData(db.Model):
  my_card = db.ReferenceProperty(CardData, required=True)

  def deleteAll(self):
    self.my_card.deleteAll()
    q = FriendData.all()
    q.ancestor(self)
    for friend in q:
      friend.deleteAll()
    delete_entity(self)

def new_account():
  card = CardData()
  card.put()
  account = AccountData(my_card=card)
  account.put()
  return account

class GenerateHandler(CapServer.CapHandler): pass
class LaunchHandler(CapServer.CapHandler): pass
class AccountInfoHandler(CapServer.CapHandler): pass
class FriendsListHandler(CapServer.CapHandler): pass
class FriendInfoHandler(CapServer.CapHandler): pass
class StreamReadHandler(CapServer.CapHandler): pass
class StreamPostHandler(CapServer.CapHandler): pass
class MessageListHandler(CapServer.CapHandler): pass
class MessageInfoHandler(CapServer.CapHandler): pass
class MessagePostHandler(CapServer.CapHandler): pass
class IntroduceYourselfHandler(CapServer.CapHandler): pass

class GenerateHandler(CapServer.BcapHandler):
  def get(self):
    self.xhr_content(CapServer.grant(LaunchHandler, new_account()), 
        "text/plain")
        
class GenerateAccountHandler(CapServer.BcapHandler):
  def get(self):
    self.bcapResponse(CapServer.grant(AccountInfoHandler, new_account()))

class LaunchHandler(CapServer.CapHandler):
  def get(self):
    account = self.get_entity()
    app = {
	  'caps': {
      'friends':  CapServer.regrant(FriendsListHandler, account),
      'myCard':  CapServer.regrant(CardInfoHandler, account.my_card),
      'introduceYourself': CapServer.regrant(IntroduceYourselfHandler, account),
      'introduceMeTo': CapServer.regrant(IntroduceMeToHandler, account),
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


class AccountInfoHandler(CapServer.CapHandler):
  def get(self):
    account = self.get_entity()
    introduceYS = CapServer.regrant(IntroduceYourselfHandler, account)
    introduceMT = CapServer.regrant(IntroduceMeToHandler, account)
    self.bcapResponse({
      'friends':  CapServer.regrant(FriendsListHandler, account),
      'introduceYourself': introduceYS,
      'introduceMeTo': introduceMT,
      'myCard':  CapServer.regrant(CardInfoHandler, account.my_card),
    })

  def delete(self):
    account = self.get_entity()
    account.deleteAll()
    self.bcapNullResponse()
    
    
class CardInfoHandler(CapServer.CapHandler):
  def get(self):
    card = self.get_entity()
    cardJSON = card.toJSON()
    cardJSON['uploadImage'] = CapServer.regrant(ImageUploadHandler, card)
    self.bcapResponse(cardJSON)
  
  def put(self):
    card = self.get_entity()
    request = self.bcapRequest()
    # TODO(mzero): never trust what they send you!
    card.name = request['name']
    card.email = request['email']
    card.notes = request['notes']
    card.put()
    self.bcapNullResponse()
  
  def delete(self):
    card = self.get_entity()
    card.deleteAll()
    self.bcapNullResponse()

class ImageHandler(CapServer.CapHandler):
  def get(self):
    card = self.get_entity()
    self.xhr_response()
    if card.imageType:
      self.response.headers['Content-Type'] = card.imageType
      self.response.out.write(card.image)
    else:
      self.response.set_status(404)

class ImageUploadHandler(CapServer.CapHandler):
  def post(self):
    card = self.get_entity()
    image = self.request.POST['imageFile']
    card.image = image.value
    card.imageType = image.type
    card.put()
    self.xhr_response()



class FriendsListHandler(CapServer.CapHandler):
  def get(self):
    account = self.get_entity()

    q = FriendData.all(keys_only=True)
    q.ancestor(account)
    friends = []
    for friendKey in q:
      friends.append(CapServer.regrant(FriendInfoHandler, friendKey))
        # NOTE(mzero): regrant should re-use any existing granted cap
        # NOTE(mzero): 2nd arg should accept a key as well as an entity
    self.bcapResponse(friends)


class FriendInfoHandler(CapServer.CapHandler):
  def get(self):
    friend = self.get_entity()

    read_my_stream = CapServer.regrant(StreamReadHandler, friend)
    write_my_stream = CapServer.regrant(StreamPostHandler, friend)

    self.bcapResponse({
      'card': friend.card.toJSON(),
      'readTheirStream': friend.read_their_stream,
      'readMyStream': read_my_stream,
      'postToMyStream': write_my_stream
    })
  
  def put(self):
    # TODO(mzero)
    pass
  
  def delete(self):
    friend = self.get_entity()
    friend.deleteAll()
    self.bcapNullResponse()
      # NOTE(mzero)

class StreamPostHandler(CapServer.CapHandler):
  def post(self):
    friend_info = self.get_entity()
    request = self.bcapRequest()
    msg = request['message'] 
    message_data = MessageData(message = msg, parent = friend_info)
    message_data.put()
    # TODO(jpolitz): handle capabilities in messages
    self.bcapResponse({'success': True})

class StreamReadHandler(CapServer.CapHandler):
  def get(self):
    friend_info = self.get_entity()
    q = MessageData.all().ancestor(friend_info)
    # TODO(jpolitz): more than 10 messages
    json_messages = []
    for m in q:
      json_messages.append(m.toJSON())

    self.bcapResponse({'items': json_messages})

class MessageListHandler(CapServer.CapHandler):
  def get(self):
    friend = self.get_entity()

    # TODO(jpolitz): why does this handler have all this authority!
    q = MessageData.all(keys_only=True)
    q.ancestor(friend)
    messages = []
    for messageKey in q:
      messages.append(CapServer.regrant(MessageInfoHandler, messageKey))
    self.bcapResponse({'messages': messages})


class MessageInfoHandler(CapServer.CapHandler):
  def get(self):
    message = self.get_entity();
    self.bcapResponse({
      'when':       message.nicedate(),
      'message':    message.message,
      'capability': message.capability,
      'resourceClass':      message.resource_class
    })
  
  def delete(self):
    message = self.get_entity()
    message.deleteAll()
    self.bcapNullResponse()


class MessagePostHandler(CapServer.CapHandler):
  def post(self):
    friend = self.get_entity()
    request = self.bcapRequest()
    message = MessageData(parent=friend)
    message.message = db.Text(request.message)
    if 'capability' in request:
      message.capability = request.capability
      message.resource_class = request.resourceClass
    message.put()
    self.bcapNullResponse()
    
class IntroduceYourselfHandler(CapServer.CapHandler):
  def get(self):
    account = self.get_entity()
    self.bcapResponse(account.my_card.toJSON())

  def post(self):
    account = self.get_entity()
    request = self.bcapRequest()
    card_data = request['card']
    stream = None
    if 'streamForYou' in request:
      stream = request['streamForYou']
    
    their_card = CardData(name=card_data['name'],
                          email=card_data['email'],
                          notes=card_data['notes'],
                          parent=account)
    their_card.put()

    them = FriendData(card=their_card, parent=account) # TODO(jpolitz): just this for now
    if stream: 
      them.read_their_stream = stream
    them.put()

    self.bcapResponse({'card': account.my_card.toJSON()})

class IntroduceMeToHandler(CapServer.CapHandler):
  def post(self):
    account = self.get_entity()
    request = self.bcapRequest()
    card = account.my_card

    blank_card = CardData(name="Pending", email="Pending", notes="Pending")
    blank_card.put()
    new_friend = FriendData(parent=account, card=blank_card)
    new_friend.put()
    q = FriendData.all().ancestor(account)

    stream = CapServer.regrant(StreamReadHandler, new_friend)

    cap = request['introductionCap']

    response = CapServer.invokeCapURL(cap, 'POST',
                                      {'card': card.toJSON(),
                                       'streamForYou': stream})

    cap_response = json.loads(response.out.getvalue())['value']
    card_data = cap_response['card']
    friend_card = CardData(name=card_data['name'],
                           email=card_data['email'],
                           notes=card_data['notes'])
    friend_card.put()

    new_friend.card=friend_card
    blank_card.delete()

    if('streamForYou' in cap_response):
      new_friend.read_their_stream = cap_response['streamForYou']

    new_friend.put()
    self.bcapResponse({
        'friend': CapServer.regrant(FriendInfoHandler, new_friend)
    })


# Externally Visible URL Paths
application = webapp.WSGIApplication(
  [(r'/cap/.*', CapServer.ProxyHandler),
   ('/generate', GenerateHandler),
   ('/generate-account', GenerateAccountHandler),
  ],
  debug=True)

# Internal Cap Paths
CapServer.set_handlers(
  '/cap',
  [('station/launch',LaunchHandler),
   ('friend/account',AccountInfoHandler),
  
   ('friend/card',   CardInfoHandler),
   ('friend/image',  ImageHandler),
   ('friend/imageUpload', ImageUploadHandler),
   
   ('friend/list',   FriendsListHandler),
   ('friend/friend', FriendInfoHandler),
   
   ('friend/messages', MessageListHandler),
   ('friend/message', MessageInfoHandler),
   ('friend/read', StreamReadHandler),
   ('friend/post', StreamPostHandler),
   
   ('friend/introduceMeTo', IntroduceMeToHandler),
   ('friend/introduceYourself', IntroduceYourselfHandler),
  ])



def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
