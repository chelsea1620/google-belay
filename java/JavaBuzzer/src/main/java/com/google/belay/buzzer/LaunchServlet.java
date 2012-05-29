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
import com.google.belay.server.ContextUtil;
import com.google.belay.server.GsonUtil;
import com.google.belay.server.LaunchInfo;

import java.io.IOException;

import javax.jdo.PersistenceManager;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * The capability servlet invoked to acquire the necessary launch information to
 * start a buzzer instance.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
@SuppressWarnings("serial")
public class LaunchServlet extends BelayServlet {

  @Override
  protected void doGet(HttpServletRequest req, HttpServletResponse resp)
      throws ServletException, IOException {

    PersistenceManager pm = PersistenceUtil.getPM();
    Buzzer buzzer = pm.getObjectById(Buzzer.class, entityKey);

    if (buzzer == null) {
      // TODO(iainmcgin): perhaps this is actually an internal server error,
      // as a valid cap existed pointing to a deleted buzzer instance.
      resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
      return;
    }

    BuzzerLaunchInfo buzzerInfo = new BuzzerLaunchInfo();
    buzzerInfo.setBuzzer(buzzer);
    buzzerInfo.setPostCap(caps.grant("post", entityKey));
    buzzerInfo.setRefreshAllCap(caps.grant("refresh-all", entityKey));

    String buzzerPage = ContextUtil.buildExternalUrl(req, "/buzzer.html");
    LaunchInfo li = new LaunchInfo(buzzerPage, buzzerInfo);

    GsonUtil.write(li, resp);
  }
}
