#!/usr/bin/env python

import os
import os.path
import sys

print "Content-Type: text/plain"
print ""
print "os.getcwd() = ",os.getcwd()

print "os.environ ="
ek = os.environ.keys()
ek.sort()
for k in ek:
	print "  ",k,"=",repr(os.environ[k])
	