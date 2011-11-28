#!/bin/sh

echo "--- (Re)starting belay app-engine instances"

./run.sh restart

echo "--- Giving appengine time to start"

ready=0
while [ `curl -sL -w '%{http_code}' 'http://localhost:9000' -o /dev/null` != 200 ]
do 
	echo '.\c'
   	sleep 1s
done

if `which -s py.test`
then py.test tests/test_all.py
else exec tests/test_all.py
fi

exec tests/py/run_py_tests.sh