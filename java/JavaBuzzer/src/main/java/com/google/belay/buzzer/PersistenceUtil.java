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

import javax.jdo.JDOHelper;
import javax.jdo.PersistenceManager;
import javax.jdo.PersistenceManagerFactory;

/**
 * Singleton for accessing the JDO persistence manager factory. It is
 * recommended in the Google App Engine documentation for JDO that a singleton
 * be used to access the factory as it takes time to initialise. In fact,
 * attempting to instantiate it more than once within the same context throws an
 * exception.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class PersistenceUtil {

  private static final PersistenceManagerFactory pmfInstance = JDOHelper
      .getPersistenceManagerFactory("transactions-optional");

  private PersistenceUtil() {
    // class is purely static
  }

  public static PersistenceManager getPM() {
    return pmfInstance.getPersistenceManager();
  }

}
