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

package com.google.belay.server.appengine;

import static com.google.appengine.api.datastore.FetchOptions.Builder.withLimit;
import static com.google.appengine.api.datastore.Query.FilterOperator.EQUAL;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;
import com.google.appengine.api.datastore.PreparedQuery;
import com.google.appengine.api.datastore.Query;
import com.google.belay.server.AmbiguousRegrantException;
import com.google.belay.server.CapabilityMapBackend;
import com.google.belay.server.CapabilityMapping;

import java.util.List;
import java.util.UUID;

/**
 * A Google App Engine DataStore based persistent capability map. This class
 * provides the basic facilities required to grant, regrant and revoke
 * capabilities to services with optional bound entities (by key string). The
 * capabilities here are represented solely in terms of their UUID component,
 * the responsibility to turn these into usable URLs is elsewhere.
 * 
 * @author Iain McGinniss (iainmcgin@google.com)
 */
public class DatastoreCapabilityMapBackend implements CapabilityMapBackend {

  private static final String CAP_TYPE = "Capability";
  private static final String KEY = "entityKey";
  private static final String PATH = "path";
  private static final String UUID_HIGH = "uuidHighBits";
  private static final String UUID_LOW = "uuidLowBits";

  private final DatastoreService datastore = DatastoreServiceFactory
      .getDatastoreService();

  @Override
  public CapabilityMapping resolve(UUID capabilityId) {
    Query q = findById(capabilityId);
    PreparedQuery pq = datastore.prepare(q);
    Entity result = pq.asSingleEntity();

    if (result != null) {
      return new CapabilityMapping((String) result.getProperty(PATH),
          (String) result.getProperty(KEY));
    }

    return null;
  }

  @Override
  public UUID grant(String path) {
    return grant(path, (String) null);
  }

  @Override
  public UUID grant(String path, String boundEntity) {
    Entity capInfo = new Entity(CAP_TYPE);
    UUID capId = UUID.randomUUID();
    capInfo.setProperty(UUID_LOW, capId.getLeastSignificantBits());
    capInfo.setProperty(UUID_HIGH, capId.getMostSignificantBits());
    capInfo.setProperty(PATH, path);
    capInfo.setProperty(KEY, boundEntity);

    datastore.put(capInfo);

    return capId;
  }

  public UUID grant(String path, Entity boundEntity) {
    return grant(path, boundEntity.getKey());
  }

  public UUID grant(String path, Key boundEntityKey) {
    return grant(path, KeyFactory.keyToString(boundEntityKey));
  }

  @Override
  public UUID regrant(String service) throws AmbiguousRegrantException {
    return regrant(service, (String) null);
  }

  @Override
  public UUID regrant(String path, String boundEntity)
      throws AmbiguousRegrantException {

    Query q = find(null, path, boundEntity);
    PreparedQuery pq = datastore.prepare(q);
    List<Entity> matches = pq.asList(withLimit(2));

    switch (matches.size()) {
    case 2:
      throw new AmbiguousRegrantException(path, boundEntity);
    case 1:
      Entity match = matches.get(0);
      long uuidLow = (Long) match.getProperty(UUID_LOW);
      long uuidHigh = (Long) match.getProperty(UUID_HIGH);
      return new UUID(uuidHigh, uuidLow);
    default:
      return grant(path, boundEntity);
    }
  }

  public UUID regrant(String path, Key boundEntityKey)
      throws AmbiguousRegrantException {
    return regrant(path, KeyFactory.keyToString(boundEntityKey));
  }

  public UUID regrant(String path, Entity boundEntity)
      throws AmbiguousRegrantException {
    return regrant(path, boundEntity.getKey());
  }

  @Override
  public void revoke(UUID capId) {
    Query q = findById(capId).setKeysOnly();

    for (Entity e : datastore.prepare(q).asIterable()) {
      datastore.delete(e.getKey());
    }
  }

  private Query findById(UUID uuid) {
    return find(uuid, null, null);
  }

  private Query find(UUID uuid, String path, String key) {
    Query q = new Query(CAP_TYPE);
    if (uuid != null) {
      q.addFilter(UUID_LOW, EQUAL, uuid.getLeastSignificantBits());
      q.addFilter(UUID_HIGH, EQUAL, uuid.getMostSignificantBits());
    }

    if (path != null) {
      q.addFilter(PATH, EQUAL, path);
    }

    if (key != null) {
      q.addFilter(KEY, EQUAL, key);
    }

    return q;
  }
}
