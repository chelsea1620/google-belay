Belay Client API
================

This documents the API available on browser clients. It is the interface that
web pages use to Belay.



Loading the Library
===================

A page includes the API with:

    <script src="https://apis.google.com/js/belayclient.js"></script>

This will both load the client library and initialize the page with the Belay
system. The latter involves inserting an invisible iframe into the page, from
the domain `belay-belay.appspot.com`.

Data Types
==========

We use some canonical terms for the data types that Belay uses.

CapServer
---------

An object that creates BCAPs and handles their invocation.  Defined in detail below.  CapServers are seldom instantiated directly, since Belay's convenience methods provide preconfigured CapServers.

BCAP
----

A BCAP is an object with `invoke`, `get`, `put`, `post`, and `remove` methods (as defined below), that is associated with some CapServer.

bcapJson
--------

Any JSON structure that can also contain BCAPs.

*Example.* The following are all valid bcapJson:

* `{x: 5}`
* ``"foo"``
* `[true, null, {'target': "https://www.google.com"}]`
* `var someCap = capServer.grant(...); // see below for grant's definition
var someBcapJson = {theCap: someCap}`

*Example.* The following are not valid bcapJson:

* `{someFunc: function() { return 2; }}`
* `/regexp/`
* `{ domNode: document.createElement('div') }`
* `undefined`
* `var o = {link: cyclicStructure};
var cyclicStructure = {link: o};`


UUID
----

When we use the term UUID, we mean string representation of a UUID version 4 as
per the [RFC](http://www.ietf.org/rfc/rfc4122.txt). Belay uses UUIDs as random
nonces and identifiers pervasively.

Initialization
==============

Belay supports several methods of initialization.

belay.start
-----------

    belay.start(
	  handler(capServer, util, [launchInfo]),
	  [failure(startError)]
	)

Registers `handler` as a callback to invoke when Belay has successfully finished
initialization. If Belay has already loaded, `handler` is called immediately. If
Belay fails to initialize, and the `failure` argument is provided, a description
of the error is passed to `failure` as `startError`. `belay.start` is
appropriate for pages with short-lived client interactions, like landing pages
and introductions between windows.

* `capServer` - a CapServer with a freshly-created identity, in the form of a
  UUID. When `capServer` grants BCAPs, it will use this identity for their
  instance ID, so invocations of those BCAPs will route back to this window.
  This identity is *temporary*, so `capServer` should not be used to grant BCAPs
  for long-lived, multi-session interactions. This `capServer` should be used
  for granting BCAPs that are used transiently, for introductions to other
  windows, for example.

* `util` - A collection of Belay utility methods, described below.

* `launchInfo` - If the page was loaded via a station launching a web
  membership, the `launchInfo` of the membership is included here.

*Example*:

`
    belay.start(function(capServer, utils) {
	  var acap = capServer.grant(...);
	  var ser = acap.serialize();
	  // ser === "urn:x-cap:926c0c63-b02a-40a9-a19f-edb19190c143:d859f7a0-4008-4c35-a99a-b7a23a5fc35d"
    });
`

belay.startForOrigin
----------------------

    belay.startForOrigin(
	  {origin: url, pageUrl: url},
	  handler(capServer, util, [launchInfo]),
	  [failure(startError)]
	)


Like `belay.start`, but uses `origin` and `pageUrl` as arguments to
`belay.routeOrigin` to create `capServer`.

*Example*:

`
   belay.startForOrigin(
      {origin: 'https://myserv.com', pageUrl: 'https://myserv.com/app/page'},
      function(capServer, utils) {
	    var acap = capServer.grant(...);
	    var ser = acap.serialize();
	    // ser === "urn:x-cap:https://myserv.com:b4b7d2f5-26a3-4eb9-8f1b-bb8b269bfa14"
      }
    );
`

This will set the location of the page making the call to
`https://myserv.com/app/page`, and the created `capServer` will handle all
invocations of BCAPs of the form `urn:x-cap:https://myserv.com:<capid>`. If the
current page isn't at `https://myserv.com/app/page`, it will be navigated there
and the registration will fail.

*Example*:

`
    belay.startForOrigin(
      'https://myserv.com',
      window.location.href,
      function(capServer, utils) {
	    // ...
      }
    );
`

As above, but the whatever the `href` of the current window is will be used, so
the registration won't fail because of a navigation.


belay.startForLaunch
--------------------------

    belay.startForLaunch(
	  key,
	  handler(capServer, utils, launchInfo),
	  [failure(startError)]
	)

Like `belay.start`, but expects that the page was loaded from a station
membership launch. Further, it expects that the `launchInfo` from that launch
contained a secret for use with `belay.route`, stored at `key`. The instance ID
of the provided `capServer` will be the SHA1 hash of the secret stored at the
given `key` in the `launchInfo`.

*Example.* Suppose a membership's `launchInfo` was:

`
    {instanceSecret: "eba68eea-75f2-4b05-b87a-08365cc58043"}`

Then, the following invocation would set up the page:

`
    belay.startForLaunch(
      'instanceSecret',
      function(capServer, util, launchInfo) {
	    var acap = capServer.grant(...)
	    var ser = acap.serialize();
	    // ser === "urn-x-cap:66c6bd1f4cda24069debe0efa2193f64baeae867:066401a1-00f3-4941-89df-5d74500654e4"
	    // 66c6b[...] is the SHA1 hash of eba68[...], the instanceSecret above
      }
    );
`

startError
----------

A `startError` is one of:

* `{type: 'NoSuchKey', key: string}` - Given when a `startForLaunch` provides a
  key that doesn't exist in the provided `launchInfo`.  Echoes the missed key.
* `{type: 'NoLaunchInfo', key: string}` - Given when 'startForLaunch` was
  called, but the page wasn't opened via a station launch.  Echoes the key.
* `{type: 'CommunicationError'}` - Given when the Belay page library fails to
  receive a startup message from the Belay iframe.
* `{type: 'OriginError', origin: url, pageUrl, url}` - Given when the Belay
  iframe doesn't agree with the origin claimed in a `request for
  `startForOrigin` call. Echoes back the failed parameters.

UUID Generation
===============

The `belayclient.js` library introduces some global convenience functions.

belay.newUUIDv4
---------------

    belay.newUUIDv4() -> UUID

Creates a UUID version 4 (as a string), using built-in browser randomization
primitives. Several functions in `belay` and `capServer` expect random nonces or
identifiers as arguments, and `newUUIDv4` is recommended for all of these cases.

*Example*:

`
    newUUIDv4();
    // returns '926c0c63-b02a-40a9-a19f-edb19190c143'
`


Routing
=======

belay.route
-----------

    belay.route(instIdPreImage) -> a_capServer

Given a pre-image (a UUID) of an instance ID, this binds the page to that ID.
BCAP invocations targeting that instance ID will be delivered to the returned
CapServer instance. The return returned CapServer can be used to grant new
BCAPs with that instance ID.

A pre-image is the value that, when SHA1 hashed, yields the instance ID. While
the page is free to choose any pre-image it wants, which in turn determines the
instance ID, it is important that it keep that value secret. Any page that has
the pre-image can masquerade as the instance, and receive invocations for it.

*Example*:

`
    var newInstanceId = newUUIDv4();
    var capServer = belay.route(newInstanceId);
`

*Example*:

`
    var capServer;
    getExistingInstanceIdFromMyServer(function(instanceUUID) {
	  capServer = belay.route(instanceUUID);
    });
`

belay.routeOrigin
-----------------

    belay.routeOrigin(origin, pageUrl) -> a_capServer

Register this page as the receiver for invocations to the supplied origin. The
system will refuse to register it unless the page itself is within that origin.

The pageUrl argument is used to validate the origin: It should be the URL of
the page making the call. Belay will validate that the origin is the origin of
the pageUrl, and that the calling page really has that URL. This latter check
is made by forcing the location of the page to be that URL before registering.
If the passed URL is the URL of the page, no navigation will occur. If it isn't
the page will navigate to pageURL, and abort the registration.

The returned CapServer instance will both take deliver of invocations to BCAPs
in that origin, and can be used to grant BCAPs for it.

*Example*:

`
    var capServer = belay.routeOrigin(
      'https://myserv.com',
      'https://myserv.com/app/page'
    );
`

This will set the location of the page making the call to
`https://myserv.com/app/page`, and the created `capServer` will handle all
invocations of BCAPs of the form `urn:x-cap:https://myserv.com:<capid>`. If the
current page isn't at `https://myserv.com/app/page`, it will be navigated there
and the registration will fail.

*Example*:

`
    var capServer = belay.routeOrigin(
      'https://myserv.com',
      window.location.href
    );
`

As above, but the whatever the `href` of the current window is will be used, so
the registration won't fail because of a navigation.

CapServer
=========

capServer.grant
---------------

    capServer.grant(item) -> a_bcap

Grant creates a new BCAP that when invoked, will call the `item`. There are
several kinds of item:

* Synchronous Function

    `f(request) -> response`

  The function is called when the BCAP is invoked. PUT and POST invocations
  will supply a request value. GET and POST invocations will return the
  function's result as the response.

* Asynchronous Function
    `
        f(successCallback(response), failureCallback(error))
        f(request, successCallback(response), failureCallback(error))`

  The first form supports GET and DELETE, the second form supports PUT and POST.
  When the function finally has a result to respond with, it should call the
  `successCallback` with the result. If there is an error, then it should call
  the `failureCallback` with an error structure:
  
    `{ status: _someInteger_, message: _someString_ }`

* Synchronous Handler

    `{
        get: f() -> response,
        put: f(request),
        post: f(request) -> response,
        remove: f()
    }`

  A handler object can implement one or more of the four invocation methods.
  The function at each method is treated as a synchronous function and called
  as appropriate.

* Asynchronous Handler

    `{
        get: f(successCallback(response), failureCallback(error)),
        put: f(request, successCallback(response), failureCallback(error)),
        post: f(request, successCallback(response), failureCallback(error)),
        remove: f(, successCallback(response), failureCallback(error))
    }`

  These handlers also can provide one or more functions for each of the four
  invocations, but they are called as the in the asynchronous case.

* BCAP

  An item that is just a BCAP will cause a new BCAP to be issued that "wraps"
  the BCAP: Invocations to the new BCAP will simply be proxied to the original
  BCAP. The primary reason for doing this is to hide the original BCAP, and
  allow access to the new BCAP to be revoked.

* URL

  An item that is a URL starting with `http` or `https` will create a BCAP that
  invokes via HTTP(S) using `XMLHttpRequest`.

* Invoke Handler

    `{
        invoke: f(method, request,
                    successCallback(response), failureCallback(error))
    }`

  An object with an invoke method can be an item. The `invoke` method will be
  called when the BCAP is invoked.

capServer.wrap
--------------

    capServer.wrap(bcap) -> bcap

  Creates wraps a new bcap around an existing bcap. The new bcap can be revoked
  independently of the original bcap. This call also arranges for the new bcap
  to be automatically restored based on the serialization of the original bcap.
 
capServer.revoke
----------------

    capServer.revoke(bcap)
    capServer.revoke(ser)

  A BCAP can be revoked based either on the BCAP, or its serialization.
  After this call, no further invocations of the BCAP will succeed. Note that
  invocations in progress may continue to be processed, or may fail.
  
  If the BCAP wasn't issued by this CapServer, then this call silently does
  nothing.

capServer.revokeAll
-------------------

    capServer.revokeAll()

  Revokes all BCAPs ever issued by this CapServer. Note that invocations in
  progress may continue to be processed, or may fail.
 
capServer.grantNamed
--------------------

    capServer.grantNamed(name, [a0, a1, ...])

  Grant a persistable BCAP. The function of the BCAP is described by the name
  parameter and the optional, variable arguments. The arguments must all be
  BCAP-JSON, as they may be serailized and persisted.

capServer.setNamedHandler
-------------------------

    capServer.setNamedHandler(name, handler([a0, a1, ...]) -> item)

  Associates an item with a given name used for persistable BCAPs. The function
  is passed any optional arguments from the named grant, and should return an
  item (see grant()) to implement the BCAP. In this way, a persistent BCAP can
  close over those aruements, and this handler is used to return an item that
  uses them.
  
  The capServer will call this function at least once before such a cap is
  invoked. It may continue to reuse the resulting item for subsequent invokes,
  or it may request the item anew each time.

capServer.revokeNamed
---------------------

    capServer.revokeNamed(name, validator([a0, a1, ...]) -> boolean)

  Revokes named caps for a given name, where the function over the optional
  arguments returns true.

capServer.restore
-----------------

    capServer.restore(serialization)

capServer.serialize
-------------------

    capServer.serialize() -> string

capServer.setPersistifier
-------------------------

    capServer.setPersistifier(saver(), [maxInterval])
    

capServer.dataPreProcessor
--------------------------

capServer.dataPostProcessor
---------------------------


Capability
==========

capability.invoke
-----------------

capability.get
--------------

capability.put
--------------

capability.post
---------------

capability.remove
-----------------

capability.serialize
--------------------


Utilities: Exchange
===================

util.exchange.offer
-------------------

util.exchange.accept
--------------------

Utilities: Station
==================

util.station.becomeInstance
---------------------------

util.station.activateLocalCap
-----------------------------


Utilities: Launch
=================


util.belay.exepctLaunch
-----------------------

util.belay.selfLaunch
---------------------







