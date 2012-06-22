// Copyright 2011 Google Inc. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

define(['./sjcl'], function() {
  'use strict';

  /****************************************************************************/
  /** UTILITY FUNCTIONS *******************************************************/
  /****************************************************************************/

  /**
   * Generates a new UUIDv4 using a cryptographically secure
   * random number generator if the browser supports JS Crypto,
   * or uses the standard Math.random() generator.
   *
   * See RFC 4122 for more information on UUIDs:
   * http://www.ietf.org/rfc/rfc4122.txt 
   */
  var newUUIDv4 = (function() {
    var r;
      // handle for a random 16-bit int generator

    if (typeof window !== 'undefined' && window !== null &&
    'crypto' in window && 'getRandomValues' in window.crypto) {
      // variant which uses the brower provided, cryptography
      // grade random number generator.
      var randomShort = new Int16Array(1);
      r = function() {
        window.crypto.getRandomValues(randomShort);
        return randomShort[0] + 0x8000;
      }
    } else {
      // if the browser doesn't support JS crypto, or we are
      // in a context where we can't use it (i.e. shared worker
      // in chrome), we just use the standard Math.random().
      r = function() { return Math.floor(Math.random() * 0x10000); };
    }

    var s = function(x) { return ('000' + x.toString(16)).slice(-4); };
    var u = function() { return s(r()); };
    var v = function() { return s(r() & 0x0fff | 0x4000); };
    var w = function() { return s(r() & 0x3fff | 0x8000); };

    // the actual UUIDv4 generator
    return function() {
      return u() + u() + '-' + u() + '-' + v() +
             '-' + w() + '-' + u() + u() + u();
    }
  })();

  var uuidv4RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  var isUUIDv4 = function(u) { return uuidv4RE.test(u); };
  
  /**
    Used for creating new names for windows from (secret) uuids.
    Hashes the *bits* of the uuid, using SHA-256, and returns the first 128 bits
    of the resulting hash, represented as a hex string.
    
    newInstanceId provides the canonical form for instanceIds for CapServers.
  */
  var newInstanceId = function(uuid) {
    if (typeof uuid !== 'string') throw 'newInstanceId: Got non-string value.';
    if (!isUUIDv4(uuid))          throw 'newInstanceId: Got non-uuid v4 value.';
    
    var uuidbits = sjcl.codec.hex.toBits(uuid.replace(/-/g, ''));
    var hashedbits = sjcl.hash.sha256.hash(uuidbits);
    
    return sjcl.codec.hex.fromBits(hashedbits).substring(0, 32);
  };
  
  var instanceIdRE = /^[0-9a-f]{32}$/;
  var isInstanceId = function(b) { return instanceIdRE.test(b); };
  
  var validInstId = function(id) {
    return isUUIDv4(id) || isInstanceId(id);
  };

  var encodeSerialization = function(instanceId, capId) {
    return 'urn:x-cap:' + instanceId + ':' + capId;
  };

  var decodeSerialization = function(ser) {
    var m = ser.match(/^urn:x-cap:([-0-9a-f]{32,36}):([-0-9a-f]{36})$/);
    if (m) {
      m.shift();
    }
    return m;
  };

  var decodeInstanceId = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[0] : nullInstanceId;
  };

  var decodeCapId = function(ser) {
    var m = decodeSerialization(ser);
    return m ? m[1] : nullCapId;
  };

  var nullInstanceId = '00000000-0000-0000-0000-000000000000';
  var nullCapId = '00000000-0000-0000-0000-000000000000';


  /****************************************************************************/
  /** PUBLIC EXPORTS **********************************************************/
  /****************************************************************************/

  return {
    newUUIDv4: newUUIDv4,
    newInstanceId: newInstanceId,
    validInstId: validInstId,
    encodeSerialization: encodeSerialization,
    decodeSerialization: decodeSerialization,
    decodeInstanceId: decodeInstanceId,
    decodeCapId: decodeCapId
  };
});
