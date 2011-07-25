# Copyright 2011 Google Inc. All Rights Reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#!/bin/bash

APPE=$1
RUN="gnome-terminal -x python"

CLEAR=""

CL=$2
if [[ $CL == "clean" || $CL == "-clean" || $CL == "--clean" ]]; then
  echo "Clearing datastores"
  CLEAR="--clear_datastore"
elif [[ $2 != "" || $1 == "" ]]; then
  echo "Usage:"
  echo ""
  echo "  ./run.sh <appengine-path> [clean]"
  echo ""
  echo "Runs all 7 Belay demo applications, with the following port mappings:"
  echo ""
  echo "    belay:    9000"
  echo "    station:  9001"
  echo "    hello:    9002"
  echo "    stickies: 9003"
  echo "    buzzer:   9004"
  echo "    emote:    9005"
  echo "    bfriendr: 9009"
  echo ""
  echo "Arguments:"
  echo "  <appengine-path>:"
  echo "    The path to the development executable for Python AppEngine, e.g.:"
  echo "    /home/bob/src/google_appengine/dev_appserver.py"
  echo ""
  echo "  clean: Optional.  Clears all AppEngine datastores, then launches as usual."
  echo ""
  exit 0
fi

$RUN $APPE -p 9000 $CLEAR belay
$RUN $APPE -p 9001 $CLEAR station
$RUN $APPE -p 9002 $CLEAR hello
$RUN $APPE -p 9003 $CLEAR stickies
$RUN $APPE -p 9004 $CLEAR buzzer
$RUN $APPE -p 9005 $CLEAR emote
$RUN $APPE -p 9009 $CLEAR bfriendr
