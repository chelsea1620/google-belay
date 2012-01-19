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

import com.google.gson.InstanceCreator;
import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParseException;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

import java.lang.reflect.Type;
import java.net.MalformedURLException;
import java.net.URL;

/**
 * Gson adapter which can serialize and deserialize {@link Capability} objects
 * to and from the expected format in the bcap protocol.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class CapabilityAdapter implements JsonSerializer<Capability>,
    JsonDeserializer<Capability>, InstanceCreator<Capability> {

  @Override
  public Capability createInstance(Type t) {
    return new Capability();
  }

  @Override
  public Capability deserialize(JsonElement elem, Type typeOfSrc,
      JsonDeserializationContext context) throws JsonParseException {
    JsonObject obj = elem.getAsJsonObject();
    JsonElement capElem = obj.get("@");
    if (capElem == null) {
      throw new JsonParseException("capability object missing '@' field");
    }

    String capUrlStr = capElem.getAsString();
    if (capUrlStr == null) {
      throw new JsonParseException("'@' field is not a string");
    }

    try {
      URL capUrl = new URL(capUrlStr);
      return new Capability(capUrl);
    } catch (MalformedURLException e) {
      throw new JsonParseException("'@' field does not map to a valid url");
    }
  }

  @Override
  public JsonElement serialize(Capability cap, Type typeOfT,
      JsonSerializationContext context) {
    JsonObject obj = new JsonObject();
    obj.add("@", new JsonPrimitive(cap.getCapUrl().toString()));
    return obj;
  }
}
