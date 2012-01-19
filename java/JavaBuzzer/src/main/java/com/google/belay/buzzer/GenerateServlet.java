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

package com.google.belay.buzzer;

import com.google.belay.server.BelayServlet;
import com.google.belay.server.Capability;
import com.google.belay.server.ContextUtil;
import com.google.belay.server.GenerateResponse;
import com.google.belay.server.GsonUtil;

import java.io.IOException;

import javax.jdo.PersistenceManager;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Servlet which can generate a new buzzer instance, and is mapped to a
 * well-known URL for this purpose.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
@SuppressWarnings("serial")
public class GenerateServlet extends BelayServlet {

  @Override
  protected void doPost(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {

    String name = req.getParameter("name");
    if (name == null) {
      resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
      resp.getWriter().write("missing \"name\" parameter");
      return;
    }

    Buzzer b = new Buzzer(name);

    PersistenceManager pm = PersistenceUtil.getPM();
    try {
      pm.makePersistent(b);
    } finally {
      pm.close();
    }

    Capability launchCap = caps.grant("launch", b.getKey());
    String iconPath = "/res/images/tool-buzzer.png";
    String iconUrl = ContextUtil.buildExternalUrl(req, iconPath);

    GenerateResponse gr = new GenerateResponse(launchCap, iconUrl, name);
    GsonUtil.write(gr, resp);
  }
}
