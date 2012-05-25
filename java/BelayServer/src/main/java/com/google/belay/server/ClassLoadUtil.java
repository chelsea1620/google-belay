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

/**
 * Simple class loading tool which attempts to load subclasses of a known type
 * based on class names stored in the ServletContext.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class ClassLoadUtil {

  /*
   * type erasure forces this, manual assignability check is made to ensure
   * safety
   */
  @SuppressWarnings("unchecked")
  public static <T> Class<T> loadClass(ServletConfig cfg,
      Class<T> expectedParentType, String initParamName)
      throws ServletException {

    String impl = cfg.getInitParameter(initParamName);

    if (impl == null) {
      impl = cfg.getServletContext().getInitParameter(initParamName);
    }

    if (impl == null) {
      String errMsg = String.format("init parameter %s is not "
          + "specified in the servlet configuration for servlet %s",
          initParamName, cfg.getServletName());
      throw new ServletException(errMsg);
    }

    try {
      Class<?> implClass = Class.forName(impl);
      if (!expectedParentType.isAssignableFrom(implClass)) {
        String errMsg = String.format("The class %s specified by "
            + "init parameter %s of servlet %s is not an "
            + "implementation of %s", impl, initParamName,
            cfg.getServletName(), expectedParentType.getCanonicalName());
        throw new ServletException(errMsg);
      }

      return (Class<T>) implClass;

    } catch (ClassNotFoundException e) {
      String errorStr = String.format("Could not load the "
          + "implementation class %s", impl);
      throw new ServletException(errorStr, e);
    }
  }

  public static <T> T instantiateClass(ServletConfig cfg,
      Class<T> expectedParentType, String initParamName)
      throws ServletException {

    Class<T> implClass = loadClass(cfg, expectedParentType, initParamName);
    try {
      return implClass.newInstance();
    } catch (InstantiationException e) {
      String errorStr = String.format("Could not instantiate the "
          + "class %s specified by init parameter %s of servlet %s",
          implClass.getCanonicalName(), initParamName, cfg.getServletName());
      throw new ServletException(errorStr, e);

    } catch (IllegalAccessException e) {
      String errorStr = String.format("The class %s specified by init "
          + "parameter %s of servlet %s must have a public, "
          + "no-argument constructor");
      throw new ServletException(errorStr, e);
    }
  }
}
