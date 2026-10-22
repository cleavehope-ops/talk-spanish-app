// Every language the app knows: name + speech locales (first = speech recognition; voices tried in order).
const LANGS = {
 en:["English",["en-US","en-GB","en"]], es:["Spanish",["es-MX","es-US","es-419","es-ES","es"]], fr:["French",["fr-FR","fr-CA","fr"]],
 ht:["Haitian Creole",["ht-HT","fr-FR","fr"]], pt:["Portuguese (Brazil)",["pt-BR","pt-PT","pt"]], it:["Italian",["it-IT","it"]],
 de:["German",["de-DE","de"]], zh:["Mandarin Chinese",["zh-CN","zh"]], ja:["Japanese",["ja-JP","ja"]],
 ar:["Arabic",["ar-SA","ar-EG","ar"]], bn:["Bengali",["bn-IN","bn-BD","bn"]], bg:["Bulgarian",["bg-BG"]], ca:["Catalan",["ca-ES"]],
 hr:["Croatian",["hr-HR"]], cs:["Czech",["cs-CZ"]], da:["Danish",["da-DK"]], nl:["Dutch",["nl-NL","nl-BE"]], el:["Greek",["el-GR"]],
 tl:["Filipino (Tagalog)",["fil-PH","tl-PH"]], fi:["Finnish",["fi-FI"]], he:["Hebrew",["he-IL","iw-IL"]], hi:["Hindi",["hi-IN"]],
 hu:["Hungarian",["hu-HU"]], id:["Indonesian",["id-ID"]], ga:["Irish",["ga-IE"]], ko:["Korean",["ko-KR"]], ms:["Malay",["ms-MY"]],
 no:["Norwegian",["nb-NO","no-NO"]], fa:["Persian",["fa-IR"]], pl:["Polish",["pl-PL"]], ro:["Romanian",["ro-RO"]], ru:["Russian",["ru-RU"]],
 sr:["Serbian",["sr-RS"]], sk:["Slovak",["sk-SK"]], so:["Somali",["so-SO"]], sw:["Swahili",["sw-KE","sw-TZ","sw"]], sv:["Swedish",["sv-SE"]],
 ta:["Tamil",["ta-IN"]], th:["Thai",["th-TH"]], tr:["Turkish",["tr-TR"]], uk:["Ukrainian",["uk-UA"]], ur:["Urdu",["ur-PK","ur-IN"]],
 vi:["Vietnamese",["vi-VN"]], yo:["Yoruba",["yo-NG"]], zu:["Zulu",["zu-ZA"]], am:["Amharic",["am-ET"]], pa:["Punjabi",["pa-IN"]],
 ne:["Nepali",["ne-NP"]], af:["Afrikaans",["af-ZA"]], is:["Icelandic",["is-IS"]], lt:["Lithuanian",["lt-LT"]], lv:["Latvian",["lv-LV"]],
 et:["Estonian",["et-EE"]], sl:["Slovenian",["sl-SI"]], sq:["Albanian",["sq-AL"]], hy:["Armenian",["hy-AM"]], ka:["Georgian",["ka-GE"]],
 km:["Khmer",["km-KH"]], lo:["Lao",["lo-LA"]], my:["Burmese",["my-MM"]], ha:["Hausa",["ha-NG"]], ig:["Igbo",["ig-NG"]],
};
// Scripts written without spaces: answers are compared letter by letter.
const COMPACT_LANGS = new Set(['zh','ja','th','km','lo','my']);
const langName = c => (LANGS[c]||[c])[0];
