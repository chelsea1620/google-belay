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

import static com.google.belay.server.ClassLoadUtil.instantiateClass;
import static com.google.belay.server.ClassLoadUtil.loadClass;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.fail;

import org.jmock.Expectations;
import org.jmock.Mockery;
import org.jmock.integration.junit4.JMock;
import org.jmock.integration.junit4.JUnit4Mockery;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

import javax.servlet.ServletConfig;
import javax.servlet.ServletContext;
import javax.servlet.ServletException;

@RunWith(JMock.class)
public class ClassLoadUtilTest {

  private ServletConfig cfg;
  private ServletContext ctx;

  private final Mockery mockContext = new JUnit4Mockery();

  @Before
  public void setUp() {
    cfg = mockContext.mock(ServletConfig.class);
    ctx = mockContext.mock(ServletContext.class);

    mockContext.checking(new Expectations() {
      {
        ignoring(cfg).getServletContext();
        will(returnValue(ctx));

        ignoring(cfg).getServletName();
        will(returnValue("test-servlet"));
      }
    });
  }

  private void specifyConfigParam(final String key, final String value) {
    mockContext.checking(new Expectations() {
      {
        atLeast(1).of(cfg).getInitParameter(key);
        will(returnValue(value));
      }
    });
  }

  private void specifyContextParam(final String key, final String value) {
    mockContext.checking(new Expectations() {
      {
        atLeast(1).of(ctx).getInitParameter(key);
        will(returnValue(value));
      }
    });
  }

  @Test
  public void testLoadClass_missingInitParam() throws Exception {
    specifyConfigParam("aMissingParam", null);
    specifyContextParam("aMissingParam", null);
    try {
      loadClass(cfg, Object.class, "aMissingParam");
      fail("ServletException was expected and not thrown");
    } catch (ServletException e) {
      assertEquals("init parameter aMissingParam is not specified in the "
          + "servlet configuration for servlet test-servlet", e.getMessage());
    }
  }

  @Test
  public void testLoadClass_doesNotExist() throws Exception {
    specifyConfigParam("x", "a.fake.class");
    try {
      loadClass(cfg, Object.class, "x");
      fail("ServletException was expected and not thrown");
    } catch (ServletException e) {
      assertEquals("Could not load the implementation class a.fake.class",
          e.getMessage());
    }
  }

  @Test
  public void testLoadClass_wrongType() throws Exception {
    specifyConfigParam("x", "java.lang.Integer");
    try {
      loadClass(cfg, String.class, "x");
      fail("ServletException was expected and not thrown");
    } catch (ServletException e) {
      assertEquals("The class java.lang.Integer specified by "
          + "init parameter x of servlet test-servlet is not an "
          + "implementation of java.lang.String", e.getMessage());
    }
  }

  @Test
  public void testLoadClass() throws Exception {
    specifyConfigParam("x", "java.lang.String");
    Class<String> cls = loadClass(cfg, String.class, "x");
    assertSame(String.class, cls);
  }

  @Test
  public void testLoadClass_paramOnContext() throws Exception {
    specifyConfigParam("x", null);
    specifyContextParam("x", "java.lang.Integer");
    Class<Object> cls = loadClass(cfg, Object.class, "x");
    assertSame(Integer.class, cls);
  }

  @Test(expected = ServletException.class)
  public void testInstantiateClass_missingNoArgConstructor() throws Exception {
    // java.lang.Boolean does not have a no-arg constructor
    specifyConfigParam("x", "java.lang.Boolean");
    instantiateClass(cfg, Boolean.class, "x");
  }

  @Test
  public void testInstantiateClass() throws Exception {
    specifyConfigParam("x", "java.lang.String");
    String s = instantiateClass(cfg, String.class, "x");
    assertEquals("", s);
  }
}
