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
 * Represents the standard bundle of properties that are handed back to a belay
 * instance when it is launched. This includes a description of the client side
 * URL which will represent the launched instance, some application specific
 * information, and optionally a capability URL which can handle updates to user
 * attributes provided by the station.
 * 
 * Application specific information can be of any type which can be serialized
 * by GSON.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class LaunchInfo {

  private final PageInfo page;

  // only used by the client, write-only field
  @SuppressWarnings("unused")
  @SerializedName("info")
  private final Object applicationInfo;

  private AttributeInfo attributes;

  public LaunchInfo(String pageUrl, Object applicationInfo) {
    this.page = new PageInfo();
    this.page.html = pageUrl;
    this.applicationInfo = applicationInfo;
  }

  public LaunchInfo(String pageUrl, Object applicationInfo,
      String attributeUpdateHandler) {
    this(pageUrl, applicationInfo);

  }

  public void setAttributeUpdateHandler(String attributeUpdateHandler) {
    if (attributeUpdateHandler != null) {
      this.attributes = new AttributeInfo();
      this.attributes.set = attributeUpdateHandler;
    } else {
      attributes = null;
    }
  }

  static class PageInfo {
    public String html;
  }

  static class AttributeInfo {
    public String set;
  }
}
