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

import javax.servlet.ServletConfig;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;

/**
 * Simple utility class which can load a {@link CapabilityMapBackend} based on
 * the property "CapabilityMapBackendImpl", either specified as an init-param to
 * the servlet in question or as a context-param in the servlet context.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class CapabilityMapBackendLoader {

  private CapabilityMapBackendLoader() {
    // purely static class
  }

  public static CapabilityMapBackend load(HttpServlet servlet)
      throws ServletException {
    ServletConfig cfg = servlet.getServletConfig();
    return ClassLoadUtil.instantiateClass(cfg, CapabilityMapBackend.class,
        "CapabilityMapBackendImpl");
  }

}
