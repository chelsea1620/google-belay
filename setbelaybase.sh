#!/bin/sh
ESCAPER='s/\//\\\//g'
BASE=`sed -e $ESCAPER <<< $1`
sed "s/##BASE##/$BASE/" lib/js/include-belay.template.js > lib/js/include-belay.js