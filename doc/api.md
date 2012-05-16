Belay Client API
================

This documents the API available on browser clients. It is the interface that
web pages use to Belay.



Loading the Library
===================

A page needs to include the API with:

    <sript src="https://apis.google.com/js/belayclient.js"></script>

This will both load the client library and initialize the page with the Belay
system. The later involves inserting an invisible iframe into the page, from the
domain `belay-belay.appspot.com`


Routing
=======

belay.route
-----------

    belay.route(instIdPreImage) -> a_capServer

Given a pre-image (a UUID) of an instance ID, this binds the page to that ID.
BCAP invocations targeting that instnace ID will be delivered to the returned
CapServer instnace. The return returned CapServer can be used to grant new
BCAPs with that instance ID.

A pre-image is the value that, when MD5 hashed, yields the instance ID. While
the page is free to choose any pre-image it wants, which in turn determines the
instance ID, it is important that it keep that value secret. Any page that has
the pre-image can masqerade as the instance, and receive invocations for it.

belay.routeWellKnown
--------------------

    belay.routeWellKnown(origin, pageUrl) -> a_capServer

Register this page as the receiver for invactions to the supplied origin. The
system will refuse to register it unless the page itself is within that origin.

The pageUrl arugment is used to validate the origin: It should be the URL of
the page making the call. Belay will validate that the origin is the origin of
the pageUrl, and that the calling page really has that URL. This later check
is made by forcing the location of the page to be that URL before registering.
If the passed URL is the URL of the page, no navigation will occur. If it isn't
the page will navigate to pageURL, and abort the registration.

The returned CapServer instance will both take deliver of invocations to BCAPs
in that origin, and can be used to grant BCAPs for it.


CapServer
=========

capServer.grant
---------------

    capServer.grant(item, key) -> a_bcap

Grant creates a new BCAP that when invoked, will call the `item`. There are
several kinds of item:

* Synchronous Function

    `f(request) -> response`

  The function is called when the BCAP is invoked. PUT and POST invocations
  will supply a request value. GET and POST invocations will return the
  function's result as the response.

* Aysnchronous Function
    `
        f(successCallback(response), failureCallback(error))
        f(request, successCallback(response), failureCallback(error))`

  The first form supports GET and DELETE, the second form supports PUT and POST.
  When the function finally has a result to respond with, it should call the
  `successCallback` with the result. If there is an error, then it should call
  the `failureCallback` with an error structure:
  
    `{ stauts: _someInteger_, message: _someStirng_ }`

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

  An item that is a URL will create a BCAP that invokes via HTTP.

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
  After this call, no futher invocations of the BCAP will succeed. Note that
  invocations in progress may continue to be processed, or may fail.
  
  If the BCAP wasn't issued by this CapServer, then this call silently does
  nothing.

capServer.revokeAll
-------------------

    capServer.revokeAll()

  Revokes all BCAPs ever issued by this CapServer. Note that invocations in
  progress may continue to be processed, or may fail.
 
capServer.