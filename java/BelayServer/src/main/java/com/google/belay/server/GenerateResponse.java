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

import com.google.gson.annotations.SerializedName;

/**
 * Represents the standard response to an instance generation request, which
 * includes the properties required to display the instance within the user's
 * station and to launch the instance in the future.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class GenerateResponse {

  @SerializedName("launch")
  private final Capability launchCap;

  @SerializedName("icon")
  private final String iconUrl;

  @SerializedName("name")
  private final String instanceName;

  public GenerateResponse(Capability launchCap, String iconUrl,
      String instanceName) {
    this.launchCap = launchCap;
    this.iconUrl = iconUrl;
    this.instanceName = instanceName;
  }

  public String getIconUrl() {
    return iconUrl;
  }

  public String getInstanceName() {
    return instanceName;
  }

  public Capability getLaunchCap() {
    return launchCap;
  }
}
