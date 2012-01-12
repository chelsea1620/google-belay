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

import java.io.IOException;

import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Provides a simple facility to extract the common attributes that are passed
 * to a user defined servlet which is hidden behind the
 * {@link CapabilityServlet}.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
@SuppressWarnings("serial")
public abstract class BelayServlet extends HttpServlet {

  protected CapabilityFactory caps;
  protected String entityKey;
  protected String originalPath;

  @Override
  protected void service(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {

    caps = (CapabilityFactory) req.getAttribute("caps");
    if (caps == null) {
      CapabilityMapBackend backend = CapabilityMapBackendLoader.load(this);
      String capPrefixUrl = buildCapPrefixUrl(req);
      caps = new UrlPrefixedCapabilityFactory(capPrefixUrl, backend);
    }
    entityKey = (String) req.getAttribute("entityKey");
    originalPath = (String) req.getAttribute("originalPath");

    super.service(req, resp);
  }

  private String buildCapPrefixUrl(HttpServletRequest req) {
    ServletContext ctx = this.getServletContext();
    String capPrefixPath = ctx.getInitParameter("DefaultCapPrefixPath");
    return ContextUtil.buildExternalUrl(req, capPrefixPath);
  }
}
