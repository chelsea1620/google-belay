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

#!/usr/bin/env python

import datetime
import logging
import os

import lib.py.belay as CapServer

from django.utils import simplejson as json

from google.appengine.ext import db
from google.appengine.ext import webapp
from google.appengine.ext.webapp.util import run_wsgi_app



def server_url(path):
  return CapServer.this_server_url_prefix() + path
  
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
      cardJSON['image'] = CapServer.regrant(ImageHandler, self).serialize()
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
    if self.capability is None or self.resource_class is None:
      return {'message': self.message,
              'when': str(self.when) }
    else:
      return {'message': self.message,
              'when': str(self.when),
              'capability': CapServer.Capability(self.capability),
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
class MessageInfoHandler(CapServer.CapHandler): pass
class IntroduceYourselfHandler(CapServer.CapHandler): pass

class GenerateHandler(CapServer.BcapHandler):
  def get(self):
    self.bcapResponse(CapServer.grant(LaunchHandler, new_account()))

class GenerateAccountHandler(CapServer.BcapHandler):
  def get(self):
    self.bcapResponse(CapServer.grant(AccountInfoHandler, new_account()))

class LaunchHandler(CapServer.CapHandler):
  def get(self):
    account = self.get_entity()
    response = {
    'page': {
      'html': server_url('/bfriendr-belay.html'),
      'window': {'height': 800, 'width': 350}
    },
    'gadget': {
      'html': server_url('/bfriendr.html'),
      'scripts': [ server_url('/bfriendr.js') ]
    },
	  'info': {
      'friends':  CapServer.regrant(FriendsListHandler, account),
      'myCard':  CapServer.regrant(CardInfoHandler, account.my_card),
      'introduceYourself': CapServer.regrant(IntroduceYourselfHandler, account),
      'introduceMeTo': CapServer.regrant(IntroduceMeToHandler, account),
      # TODO(mzero): or should this be just the following?
      'account':  CapServer.regrant(AccountInfoHandler, account),
	    }
	  }
      
    self.bcapResponse(response)


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
    cardJSON['uploadImage'] = CapServer.regrant(ImageUploadHandler, card).serialize()
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
    # TODO(mzero): Revoking the cap is a hack, and will break some clients for
    # no good reason. Really ImageHandler should do ETags on the image data.
    CapServer.revoke(ImageHandler, card)
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
    read_conversation = CapServer.regrant(ConversationReadHandler, friend)

    self.bcapResponse({
      'card': friend.card.toJSON(),
      'readTheirStream': CapServer.Capability(friend.read_their_stream),
      'readMyStream': read_my_stream,
      'postToMyStream': write_my_stream,
      'readConversation': read_conversation
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
    if 'capability' in request and 'resource_class' in request:
      message_data = \
        MessageData(message = msg, parent = friend_info,
                    capability = request['capability'].serialize(),
                    resource_class = request['resource_class'])
    else:
      message_data = MessageData(message = msg, parent = friend_info)
    message_data.put()
    # TODO(jpolitz): handle capabilities in messages
    self.bcapResponse({'success': True})

class ConversationReadHandler(CapServer.CapHandler):
  def get(self):
    friend_info = self.get_entity()

    readMine = CapServer.regrant(StreamReadHandler, friend_info)
    readTheirs = CapServer.Capability(friend_info.read_their_stream)

    mine = readMine.invoke('GET')['items']
    theirs = readTheirs.invoke('GET')['items']

    combined = mine
    combined.extend(theirs)
    sorted_combined = sorted(combined, key = lambda(m): m['when'], reverse = True)

    self.bcapResponse({'items': sorted_combined})
        
        

class StreamReadHandler(CapServer.CapHandler):
  def get(self):
    friend_info = self.get_entity()
    q = MessageData.all().ancestor(friend_info)
    # TODO(jpolitz): more than 10 messages
    json_messages = []
    for m in q:
      json_messages.append(m.toJSON())

    self.bcapResponse({'items': json_messages})


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
    # TODO(jpolitz): should images be modeled as caps or no?
    if 'image' in card_data:
      response = CapServer.Capability(card_data['image']).invoke('GET')
      their_card.image = db.Blob(response.content)
      their_card.imageType = response.headers['Content-Type']
    their_card.put()

    them = FriendData(card=their_card, parent=account)
    if stream: 
      them.read_their_stream = stream.serialize()
    them.put()

    stream_for_them = CapServer.regrant(StreamReadHandler, them)

    self.bcapResponse({'card': account.my_card.toJSON(),
                       'streamForYou': stream_for_them })

class IntroduceMeToHandler(CapServer.CapHandler):
  def post(self):
    account = self.get_entity()
    request = self.bcapRequest()
    card = account.my_card

    blank_card = CardData(name="Pending", email="Pending", notes="Pending")
    blank_card.put()
    new_friend = FriendData(parent=account, card=blank_card)
    new_friend.put()

    stream = CapServer.regrant(StreamReadHandler, new_friend)

    cap = request['introductionCap']

    # TODO(jpolitz): useful abstraction so card.toJSON is unnecessary
    intro_info = cap.invoke('POST',
                            {'card': card.toJSON(),
                             'streamForYou': stream})

    card_data = intro_info['card']
    friend_card = CardData(name=card_data['name'],
                           email=card_data['email'],
                           notes=card_data['notes'])
    # TODO(jpolitz): should images be modeled as caps or no?
    if 'image' in card_data:
      response = CapServer.Capability(card_data['image']).invoke('GET')
      friend_card.image = db.Blob(response.content)
      friend_card.imageType = response.headers['Content-Type']
    friend_card.put()

    new_friend.card=friend_card
    blank_card.delete()

    if('streamForYou' in intro_info):
      new_friend.read_their_stream = intro_info['streamForYou'].serialize()

    new_friend.put()
    self.bcapResponse({
        'friend': CapServer.regrant(FriendInfoHandler, new_friend)
    })


# Externally Visible URL Paths
application = webapp.WSGIApplication(
  [(r'/cap/.*', CapServer.ProxyHandler),
   ('/belay/generate', GenerateHandler),
   ('/generate-account', GenerateAccountHandler),
  ],
  debug=True)

# Internal Cap Paths
CapServer.set_handlers(
  '/cap',
  [('station/launch',           LaunchHandler),
   ('friend/account',           AccountInfoHandler),
  
   ('friend/card',              CardInfoHandler),
   ('friend/image',             ImageHandler),
   ('friend/imageUpload',       ImageUploadHandler),
   
   ('friend/list',              FriendsListHandler),
   ('friend/friend',            FriendInfoHandler),
   
   ('friend/message',           MessageInfoHandler),
   ('friend/read',              StreamReadHandler),
   ('friend/post',              StreamPostHandler),
   ('friend/convo',             ConversationReadHandler),
   
   ('friend/introduceMeTo',     IntroduceMeToHandler),
   ('friend/introduceYourself', IntroduceYourselfHandler),
  ])



def main():
  logging.getLogger().setLevel(logging.DEBUG)
  run_wsgi_app(application)

if __name__ == "__main__":
  main()
