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

import java.net.URL;

/**
 * Simple class which represents belay capabilities, which are in fact specified
 * simply to be URLs. A distinct type is used however to ensure they can be JSON
 * serialized/deserialized differently from normal URLs.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class Capability {

  private URL capUrl;

  public Capability(URL capUrl) {
    this.capUrl = capUrl;
  }

  protected Capability() {
    // used only by CapabilityAdapter as part of serialization/deserialization
  }

  public void setCapUrl(URL capUrl) {
    this.capUrl = capUrl;
  }

  public URL getCapUrl() {
    return capUrl;
  }

  @Override
  public boolean equals(Object o) {
    if (o instanceof Capability) {
      return this.capUrl.equals(((Capability) o).capUrl);
    }

    return false;
  }

  @Override
  public int hashCode() {
    return capUrl.hashCode();
  }
}
