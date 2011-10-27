#!/bin/sh

./run.sh restart

if `which -s py.test`
then py.test tests/test_all.py
else exec tests/test_all.py
fi

if `which -s dev_appserver.py`
then
	APPSERV_PATH=`which dev_appserver.py`
	if [ -h $APPSERV_PATH ]
	then APPSERV_PATH=`readlink $APPSERV_PATH`
	fi
	GAE_PATH=`dirname $APPSERV_PATH`
	exec tests/py/testrunner.py $GAE_PATH tests/py
else echo "could not find google app engine - cannot run GAE related tests"
fi
