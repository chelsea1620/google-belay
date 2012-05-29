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

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;

import java.util.Random;
import java.util.UUID;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.Key;
import com.google.appengine.api.datastore.KeyFactory;
import com.google.appengine.tools.development.testing.LocalDatastoreServiceTestConfig;
import com.google.appengine.tools.development.testing.LocalServiceTestHelper;
import com.google.belay.server.AmbiguousRegrantException;
import com.google.belay.server.CapabilityMapping;

public class DatastoreCapabilityMapBackendTest {

    private final DatastoreService datastore = DatastoreServiceFactory
            .getDatastoreService();
    private final LocalServiceTestHelper helper = new LocalServiceTestHelper(
            new LocalDatastoreServiceTestConfig());

    private DatastoreCapabilityMapBackend map;
    private Entity testEntity;
    private Key key;
    private String keyAsStr;

    @Before
    public void setUp() throws Exception {
        helper.setUp();
        map = new DatastoreCapabilityMapBackend();
        testEntity = new Entity("TestEntity");
        testEntity.setProperty("hello", "world");
        datastore.put(testEntity);
        key = testEntity.getKey();
        keyAsStr = KeyFactory.keyToString(key);
    }

    @After
    public void tearDown() throws Exception {
        helper.tearDown();
    }

    private Key makeKey() {
        return KeyFactory.createKey("TestKey", new Random().nextLong());
    }

    @Test
    public void testGrant_withNoEntity() {
        UUID cap = map.grant("test-servlet");
        CapabilityMapping result = map.resolve(cap);
        assertNotNull(result);
        assertEquals("test-servlet", result.getService());
        assertNull(result.getEntityKey());
    }

    @Test
    public void testGrant_withEntityKey() {
        UUID cap = map.grant("test-servlet", key);
        CapabilityMapping result = map.resolve(cap);
        assertNotNull(result);
        assertEquals("test-servlet", result.getService());
        assertEquals(keyAsStr, result.getEntityKey());
    }

    @Test
    public void testGrant_withDifferentKeys() {
        Key key2 = makeKey();
        String key2AsStr = KeyFactory.keyToString(key2);
        UUID cap = map.grant("test-servlet", key);
        UUID cap2 = map.grant("test-servlet", key2);

        assertFalse(cap.equals(cap2));
        assertEquals(keyAsStr, map.resolve(cap).getEntityKey());
        assertEquals(key2AsStr, map.resolve(cap2).getEntityKey());
    }

    @Test
    public void testGrant_withDifferentUrls() {
        UUID cap = map.grant("test-servlet", key);
        UUID cap2 = map.grant("another-servlet", key);

        assertFalse(cap.equals(cap2));
        assertEquals("test-servlet", map.resolve(cap).getService());
        assertEquals("another-servlet", map.resolve(cap2).getService());
    }

    @Test
    public void testGrant_withDuplicates() {
        UUID cap = map.grant("test-servlet", key);
        UUID cap2 = map.grant("test-servlet", key);
        assertFalse(cap.equals(cap2));
    }

    @Test
    public void testRevoke() {
        UUID cap = map.grant("test-servlet", key);
        map.revoke(cap);
        assertNull(map.resolve(cap));
    }

    @Test
    public void testRegrant() throws Exception {
        UUID cap = map.regrant("test-servlet", key);
        UUID cap2 = map.regrant("test-servlet", key);
        assertEquals(cap, cap2);
    }

    @Test
    public void testRegrant_afterGrant() throws Exception {
        UUID cap = map.grant("test-servlet", key);
        UUID cap2 = map.regrant("test-servlet", key);
        assertEquals(cap, cap2);
    }

    @Test(expected = AmbiguousRegrantException.class)
    public void testRegrant_ambiguous() throws Exception {
        map.grant("test-servlet", key);
        map.grant("test-servlet", key);
        map.regrant("test-servlet", key);
    }
}
