#!/bin/sh
BASE=$1
STATION=$2
sed -e "s,##BASE##,$BASE," -e "s,##STATION##,$STATION," \
  lib/js/include-belay.template.js > lib/js/include-belay.js
