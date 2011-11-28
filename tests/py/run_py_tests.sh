#!/bin/sh

PY_TEST_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

if `which -s dev_appserver.py`
then
	APPSERV_PATH=`which dev_appserver.py`
	if [ -h $APPSERV_PATH ]
	then APPSERV_PATH=`readlink $APPSERV_PATH`
	fi
	GAE_PATH=`dirname $APPSERV_PATH`
	exec $PY_TEST_DIR/testrunner.py $GAE_PATH $PY_TEST_DIR
else echo "could not find google app engine - cannot run GAE related tests"
fi