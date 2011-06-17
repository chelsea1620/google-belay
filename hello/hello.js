var $ = os.jQuery;
var me = os.topDiv;

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
  zh: '世界您好！',
}

var languages = []
for (var l in languageMap) { languages.push(l); }

me.load("http://localhost:9002/hello.html", function() {
  var p = me.find('p');
  
  var setLang = function (l) {
    p.text(languageMap[l]);
    if (os.storage.get() != l) {
      os.storage.put(l);
    }
  }
  
  var l = os.storage.get() || 'en';
  setLang(l);
   
  me.find('#pick-language').click(function () {
    var l = languages[Math.floor(Math.random() * languages.length)];
    setLang(l);
    return false;
  });
});
