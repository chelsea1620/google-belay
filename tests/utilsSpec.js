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

require(['../lib/js/utils'], function(utils) {

  describe('newUUIDv4', function () {
    it('should return two distinct uuids', function() {
      var u1 = utils.newUUIDv4(), u2 = utils.newUUIDv4();
      expect(u1).not.toEqual(u2);
      expect(u1.toString()).not.toEqual(u2.toString());
    });

  });

  describe('Belay hashing', function() {
    it('should perform the algorithm', function() {
      /* NOTE(jpolitz): these were done out out "by hand" in the Python REPL, using
       > import uuid
       > import hashlib
       > p = uuid.uuid4()
       > str(p) # arg to newInstanceId
       > hashlib.sha256(p.bytes).hexdigest() # expected result
      */
      expect(newInstanceId('20079a21-1ee8-4523-ad65-d8c4736276af')).toBe('debc56d8a87287861914bdbf4d0850a7');
      expect(newInstanceId('f50b4dab-0701-4008-8281-68c4c3ff9d6e')).toBe('8fe5d63019007e79b7516a62385a7b28');
      expect(newInstanceId('3c89bdda-ff70-4389-8870-2630e768c25d')).toBe('a40a9308790b58b76674d1ba1cb9e7fb');
    });
    
    it('should throw on non-strings', function() {
      expect(function() { newInstanceId(); }).toThrow(); 
      expect(function() { newInstanceId({}); }).toThrow();
      expect(function() { newInstanceId(55); }).toThrow();
      expect(function() { newInstanceId(0xf50b4dab07014008828168c4c3ff9d6e); }).toThrow(); 
      expect(function() { newInstanceId(null); }).toThrow(); 
    });
    
    it('should throw on non-uuids', function() {
      expect(function() { newInstanceId(''); }).toThrow();
      
      expect(function() { newInstanceId('5uperman'); }).toThrow();
      
      expect(function() { newInstanceId('f50b4dab-0701-4008-0281-68c4c3ff9d6e'); }).toThrow();
      // The careted hex value has to be in [ab89]          ^
      
      expect(function() { newInstanceId('f50b4dab-0701-3008-8281-68c4c3ff9d6e'); }).toThrow();
      // The careted hex value has to be 4             ^
      
      expect(function() { newInstanceId('f50b4dab07014008828168c4c3ff9d6e'); }).toThrow(); 
    });
    
  });



});

