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

// before this script, be sure that the following is set:
//    topDiv -- a jQuery object for the top div
//    storage.get & storage.put -- save and restore state

var languageMap = {
  ar: 'مرحبا العالم!',
  cy: 'Helo byd!',
  el: 'Γεια σας κόσμο!',
  en: 'Hello World!',
  es: '¡Hola, mundo!',
  fi: 'Moikka maailma!',
  is: 'Halló heimur!',
  it: 'Ciao mondo!',
  iw: 'שלום עולם!',
  ja: 'こんにちは、世界！',
  ko: '안녕하세요!',
  hi: 'नमस्ते विश्व!',
  nl: 'Hallo wereld!',
  ru: 'Привет мир!',
  sr: 'Здраво свете!',
  sv: 'Hej världen!',
  sw: 'Hello ulimwengu!',
  th: 'สวัสดีชาวโลก',
  vi: 'Xin chào thế giới!',
  yi: 'העלא וועלט!',
  zh: '世界您好！'
};

var languages = [];
for (var l in languageMap) { languages.push(l); }

var setLang = function(l) {
  topDiv.find('p').text(languageMap[l]);
  if (storage.get() != l) {
     storage.put(l);
  }
}

topDiv.find('a').click(function() {
  var l = languages[Math.floor(Math.random() * languages.length)];
  setLang(l);
  return false;
});

setLang(storage.get() || 'en');
