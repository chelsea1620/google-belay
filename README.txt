To start up the demo do this:

1) Get and install the AppEngine Python SDK:
  http://code.google.com/appengine/downloads.html

2) Start the GoogleAppEngineLauncher application

3) Drag each of these five directories to the GoogleAppEngineLauncher window:
  belay (the directory named belay inside the top level belay directory)
  station
  hello
  stickies
  buzzer

4) Assign these five apps the ports as follows:
  belay    9000
  station  9001
  hello    9002
  stickies 9003
  buzzer   9004
  emote    9005

5) Select all five of them in GoogleAppEngineLauncher and click the Run button.

6) Select the belay-belay application and click the Browse button.

7) Log into AppEngine with any e-mail address you like
  (test@example.com is fine)
  
... And away you go!



CODING CONVENTIONS
==================

This code strives to follow the Google style conventions:
  JavaScript: http://google-styleguide.googlecode.com/svn/trunk/javascriptguide.xml
  Python:     http://google-styleguide.googlecode.com/svn/trunk/pyguide.html

For JavaScript, we use Google's closure-linter (gjslint): 
  http://code.google.com/p/closure-linter/
Installation instructions:
  http://code.google.com/closure/utilities/docs/linter_howto.html

The command to run to lint the code is:
  gjslint --nojsdoc */*.js
  (this avoids checking the .js files in libraries we use)

UNIT TESTING
============

Unit testing Python server code:

  cd ./tests/py
  ./testrunner.py <PATH-TO-SDK> .

On a Mac, PATH-TO-SDK is the full path to GoogleAppEngineLauncher.app.
On Ubuntu, PATH-TO-SDK is the path to the directory you unzipped appengine to
  (e.g. the directory that contains dev_appserver.py).

