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

import java.util.UUID;

/**
 * An interface to a store which can create, persist and resolve UUID-based
 * capabilities.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public interface CapabilityMapBackend {

  CapabilityMapping resolve(UUID capId);

  UUID grant(String service);

  UUID grant(String service, String boundEntity);

  UUID regrant(String service) throws AmbiguousRegrantException;

  UUID regrant(String service, String boundEntity)
      throws AmbiguousRegrantException;

  void revoke(UUID cap);
}
