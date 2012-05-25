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

from lib.py.belay import *


def keyName(key):
  if isinstance(key, str):
    return key
  return key.name()
  
def launch_path(stationKey):
  return '/belay/launch?s=' + keyName(stationKey)
  
def instances_path(stationKey):
  return '/instances?s=' + keyName(stationKey)

def instance_path(stationKey, instanceKey):
  return '/instance?s=' + keyName(stationKey) + '&i=' + keyName(instanceKey)

def cap(url):
  return { '@': url }
