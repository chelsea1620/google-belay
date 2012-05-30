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

import com.google.gson.ExclusionStrategy;
import com.google.gson.FieldAttributes;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonIOException;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Utility class to help with JSON serialization/deserialization using the Gson
 * library, with special serializers and deserializers installed for Belay
 * specific types.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 * 
 */
public class GsonUtil {

  public static GsonBuilder getGsonBuilder() {
    GsonBuilder gb = new GsonBuilder();
    gb.registerTypeAdapter(Capability.class, new CapabilityAdapter());
    gb.setExclusionStrategies(new ExclusionStrategy() {

      @Override
      public boolean shouldSkipField(FieldAttributes attrs) {
        return attrs.getAnnotation(HideFromClient.class) != null;
      }

      @Override
      public boolean shouldSkipClass(Class<?> cls) {
        return false;
      }
    });

    return gb;
  }

  public static Gson getGson() {
    return getGsonBuilder().create();
  }

  public static <T> String serialize(T o) {
    return getGson().toJson(new BCapDataWrapper<T>(o));
  }

  public static <T> T deserialize(String s, Class<T> classOfT) {
    JsonParser parser = new JsonParser();
    JsonObject obj = parser.parse(s).getAsJsonObject();
    return getGson().fromJson(obj.get("value"), classOfT);
  }

  public static <T> T read(HttpServletRequest req, Class<T> classOfT)
      throws JsonIOException, JsonSyntaxException, IOException {
    JsonParser parser = new JsonParser();
    JsonObject obj = parser.parse(req.getReader()).getAsJsonObject();
    return getGson().fromJson(obj.get("value"), classOfT);
  }

  public static void write(Object o, HttpServletResponse resp)
      throws IOException {
    // TODO(iainmcgin): this trips up dataPostProcess on the client
    // as jQuery has already deserialized into an object
    // resp.setContentType("application/json");
    resp.getWriter().write(serialize(o));
  }

  static class BCapDataWrapper<T> {
    public T value;

    public BCapDataWrapper(T value) {
      this.value = value;
    }

    public BCapDataWrapper() {
      // no-arg constructor for Gson
    }
  }
}
