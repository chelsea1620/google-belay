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

import javax.servlet.http.HttpServletRequest;

/**
 * Utility for the manipulation of URLs related to the current servlet context.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class ContextUtil {

  public static String getServletExternalURL(HttpServletRequest req) {
    return buildExternalUrl(req, req.getServletPath());
  }

  /**
   * Builds the external, absolute version of a relative path.
   */
  public static String buildExternalUrl(HttpServletRequest req, String path) {
    String host = req.getServerName();
    int port = req.getServerPort();
    String scheme = req.getScheme();

    if ("http".equals(scheme) && port == 80 || "https".equals(scheme)
        && port == 443) {
      // default port for the protocol, don't include it in the url
      return String.format("%s://%s%s", scheme, host, path);
    } else {
      return String.format("%s://%s:%d%s", scheme, host, port, path);
    }
  }

}
