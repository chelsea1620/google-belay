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
 * Implementations of this interface provide the basic facilities required to
 * grant, regrant and revoke capabilities to services with optional bound
 * parameters. How a "service" is invoked is not the responsibility of this
 * class, it simply stores a string which must uniquely identify the service for
 * some other component which resolves and invokes the service.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public interface CapabilityFactory {

  /**
   * Creates a unique capability URL to invoke the provided service, with no
   * bound entity.
   * 
   * @param service
   *          the unique id of the service that should be invoked if a request
   *          is received for the generated UUID.
   */
  Capability grant(String service);

  /**
   * Creates a unique capability URL to invoke the provided service, with a
   * bound entity which can be uniquely identified by the provided key.
   * 
   * @param service
   *          the unique id of the service that should be invoked if a request
   *          is received for the generated UUID.
   * @param boundEntityKey
   *          the unique id of the entity which should be passed to the service
   *          as part of any request to the generated UUID.
   * @return
   */
  Capability grant(String service, String boundEntityKey);

  /**
   * Creates or reuses a capability URL to invoke the provided service, with no
   * bound entity.
   * 
   * @param service
   *          the unique id of the service that should be invoked if a request
   *          is received for the generated UUID.
   * @throws AmbiguousRegrantException
   *          if more than one grant() call has been made against the service,
   *          meaning that there is more than one possible UUID which could be
   *          reused.
   */
  Capability regrant(String service) throws AmbiguousRegrantException;

  /**
   * Creates or reuses a capability URL to invoke the provided service, with a
   * bound entity which can be uniquely identified by the provided key.
   * 
   * @param service
   *          the unique id of the service that should be invoked if a request
   *          is received for the generated UUID.
   * @param boundEntityKey
   *          the unique id of the entity which should be passed to the service
   *          as part of any request to the generated UUID.
   * @throws AmbiguousRegrantException
   *          if more than one grant() call has been made against the service,
   *          meaning that there is more than one possible UUID which could be
   *          reused.
   */
  Capability regrant(String service, String boundEntityKey)
      throws AmbiguousRegrantException;

  /**
   * Revokes the capability to invoke the service mapped to the provided URL.
   * 
   * @param cap
   *          the capability id to revoke
   */
  void revoke(Capability cap);
}
