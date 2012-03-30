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
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import javax.servlet.RequestDispatcher;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * This servlet is responsible for routing capability requests to the
 * appropriate handler for that capability, if such a mapping exists. The
 * web.xml for your application must provide the name of a class which
 * implements the {@link CapabilityMapBackend} interface either as an init-param
 * for this servlet specifically, or as a context-param on the entire servlet
 * context. The name of this parameter is "CapabilityMapBackendImpl".
 * 
 * Additionally, a context-param named "DefaultCapPrefixPath" should be
 * specified that specifies the path prefix which the capability servlet is
 * mapped to (using a servlet-mapping), so that other servlets may grant
 * capabilities that reference the correct path.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
@SuppressWarnings("serial")
public class CapabilityServlet extends HttpServlet {

  private static final List<String> LEGAL_METHODS = Arrays.asList("GET",
      "POST", "PUT", "DELETE", "OPTIONS");
  private CapabilityMapBackend caps;

  @Override
  public void init() throws ServletException {
    // ensure we can instantiate a capability mapping from our
    // current configuration
    caps = CapabilityMapBackendLoader.load(this);
  }

  @Override
  public void service(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {
    if (req.getMethod() == "OPTIONS") {
      addXhrOptions(req, resp);
    } else {
      addXhrHeaders(resp);
    }

    if (!LEGAL_METHODS.contains(req.getMethod())) {
      resp.setStatus(HttpServletResponse.SC_METHOD_NOT_ALLOWED);
      return;
    }

    try {
      CapabilityMapping mapping = resolveMapping(req);

      if (mapping == null) {
        resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
        return;
      }

      if (mapping.getEntityKey() != null) {
        req.setAttribute("entityKey", mapping.getEntityKey());
      }

      req.setAttribute("originalPath", req.getContextPath());

      ServletContext sc = this.getServletContext();
      RequestDispatcher rd = sc.getNamedDispatcher(mapping.getService());

      if (rd == null) {
        // the capability maps to a service for which we can no longer
        // find a dispatcher
        resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        return;
      }

      CapabilityFactory capFactory = new UrlPrefixedCapabilityFactory(
          ContextUtil.getServletExternalURL(req) + '/', caps);
      req.setAttribute("caps", capFactory);

      rd.forward(req, resp);
    } catch (MalformedCapabilityURLException e) {
      resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
      resp.getWriter().write(e.getMessage());
    }
  }

  private CapabilityMapping resolveMapping(HttpServletRequest req)
      throws MalformedCapabilityURLException, ServletException {

    // we must strip the separating '/' between the servlet path
    // and the remainder of the URI
    String capPart = req.getPathInfo().substring(1);
    UUID capId = checkUUID(capPart);
    return caps.resolve(capId);
  }

  private UUID checkUUID(String uuidStr) throws MalformedCapabilityURLException {
    try {
      return UUID.fromString(uuidStr);
    } catch (IllegalArgumentException e) {
      throw new MalformedCapabilityURLException(
          "capability was not a valid UUID");
    }
  }

  private void addXhrHeaders(HttpServletResponse resp) {
    resp.setHeader("Access-Control-Allow-Origin", "*");
  }

  private void addXhrOptions(HttpServletRequest req, HttpServletResponse resp) {
    String method = req.getHeader("Access-Control-Request-Method");
    String headers = req.getHeader("Access-Control-Request-Headers");

    resp.setHeader("Access-Control-Allow-Origin", "*");
    resp.setHeader("Access-Control-Max-Age", "2592000");
    resp.setHeader("Access-Control-Allow-Methods", method);
    if (headers != null) {
      resp.setHeader("Access-Control-Allow-Headers", headers);
    }
  }
}
