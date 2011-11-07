DEMO
====

Check out README.html for instructions on getting the demo set up.

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

We use unittest2 and webtest for the Python backend.  You will need to:

  easy_install unittest2 webtest selenium

You'll need the Chrome driver for selenium:
  http://code.google.com/p/chromium/downloads/list

Unit testing Python server code:

  cd ./tests/py
  ./testrunner.py <PATH-TO-SDK> .

On a Mac, PATH-TO-SDK is the full path to GoogleAppEngineLauncher.app.
On Ubuntu, PATH-TO-SDK is the path to the directory you unzipped appengine to
  (e.g. the directory that contains dev_appserver.py).

For JavaScript, we use Jasmine.  Run the tests by opening SpecRunner files in a
browser.  SpecRunner contains unit tests for the JavaScript CapServer.
WebSpecRunner contains more tests, but can't be run from file:/// urls, and
must be accessed through a web server.  AppSpecRunner requires that the
bfriendr app be running on localhost:9009.
