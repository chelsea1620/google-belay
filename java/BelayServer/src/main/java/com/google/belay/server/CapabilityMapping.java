/* Copyright 2011 Google Inc. All Rights Reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.google.belay.server;

/**
 * The definition of what a capability url is bound to - the service to be
 * invoked, and an optional bound entity as represented by its key.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class CapabilityMapping {

  private final String service;
  private final String entityKey;

  public CapabilityMapping(String service, String entityKey) {
    this.service = service;
    this.entityKey = entityKey;
  }

  public String getService() {
    return service;
  }

  public String getEntityKey() {
    return entityKey;
  }
}
