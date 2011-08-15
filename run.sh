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

LOGS="/tmp/belay/logs"
PIDS="/tmp/belay/pids"

mkdir -p $LOGS
mkdir -p $PIDS

CLEAR=""

usage() {
  echo "Usage:"
  echo ""
  echo "  ./run.sh <appengine-path> start|stop|restart|cleanstart|cleanrestart"
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
  echo "  start:"
  echo "    Default if no options given.  Starts all of the Belay servers"
  echo ""
  echo "  stop:"
  echo "    Stop Belay servers"
  echo ""
  echo "  restart:"
  echo "    Same as ./run.sh stop followed by ./run.sh start"
  echo ""
  echo "  cleanstart:"
  echo "    Same as start, but clears appengine datastores"
  echo ""
  echo "  cleanrestart:"
  echo "    Same as ./run.sh stop followed by ./run.sh cleanstart"
  echo ""
  exit 0
}

checkargs() {
  if [[ $1 == "" ]]; then
    usage
  elif [[ ! (-e $1) ]]; then
    echo "ERROR: Can't find AppEngine at the given path: $1"
    echo ""
    usage
    exit 1
  fi

  if [[   $2 == ""
       || $2 == "start"
       || $2 == "restart"
       || $2 == "stop"
       || $2 == "cleanstart"
       || $2 == "cleanrestart" ]]; then
    :
  else
    usage
    exit 1
  fi
}

startapp() {
  local port=$1
  local app=$2

  local cmd="python $APPE --skip_sdk_update_check -p $port $CLEAR $app"

  mkdir -p $PIDS/$app

  if [[ -e $PIDS/$app/pid ]]; then
    echo "PID exists for $app in $PIDS/$app, refusing to start"
    echo "try stop first, or use restart"
    exit 1
  fi

  $cmd 2> $LOGS/$app &

  echo $! > $PIDS/$app/pid
  echo "Started $app, pid in $PIDS/$app/pid, log in $LOGS/$app"
}

stopapp() {
  local app=$1

  if [[ ! (-e $PIDS/$app/pid) ]]; then
    echo "WARNING: No pid file for $app in $PIDS/$app"
  else 
    echo "Stopping $app..."
    kill `cat $PIDS/$app/pid`
    rm $PIDS/$app/pid
  fi 
}

startall() {
  startapp 9000 belay
  startapp 9001 station
  startapp 9002 hello
  startapp 9003 stickies
  startapp 9004 buzzer
  startapp 9005 emote
  startapp 9009 bfriendr
}

stopall() {
  stopapp belay
  stopapp station
  stopapp hello
  stopapp stickies
  stopapp buzzer
  stopapp emote
  stopapp bfriendr
}

checkargs $1 $2

APPE=$1
OP=$2
if [[ $OP == "" ]]; then
  OP="start"
fi

if [[ $OP == "cleanstart" || $OP == "cleanrestart" ]]; then
  CLEAR="--clear_datastore"
fi

if [[ $OP == "stop" || $OP == "restart" || $OP == "cleanrestart" ]]; then
  stopall
fi

if [[ $OP == "start" || $OP == "restart"
   || $OP == "cleanstart" || $OP == "cleanrestart" ]]; then
  startall
fi

