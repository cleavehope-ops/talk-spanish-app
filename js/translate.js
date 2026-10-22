// Free, keyless translation: Chrome built-in Translator API first, then MyMemory public API.
const Translate = {
  cache:{}, chromeBad:{},
  async viaChrome(text, from, to){
    if (!('Translator' in self)) return null;
    try{
      const a = await Translator.availability({sourceLanguage:from, targetLanguage:to});
      if (a === 'unavailable') return null;
      const key = from+'>'+to;
      const t = this.cache[key] || (this.cache[key] = await Translator.create({sourceLanguage:from, targetLanguage:to}));
      return await t.translate(text);
    }catch(e){ return null; }
  },
  async viaMyMemory(text, from, to){
    const url = 'https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair='+from+'|'+to;
    const ctl = new AbortController(); setTimeout(()=>ctl.abort(), 10000);
    const r = await fetch(url,{signal:ctl.signal}); if(!r.ok) throw new Error('http '+r.status);
    const j = await r.json();
    let txt = j.responseData && j.responseData.translatedText;
    if (!txt && Array.isArray(j.matches)) { const m = j.matches.find(x=>x.translation); if (m) txt = m.translation; }
    if (j.responseStatus != 200 || !txt) throw new Error(j.responseDetails||'no translation');
    if (/MYMEMORY WARNING|QUOTA/i.test(txt)) throw new Error('quota');
    const d = document.createElement('textarea'); d.innerHTML = txt; return d.value;
  },
  async run(text, from, to){ // returns {text, via} or throws
    if (from === to) return {text, via:'same'};
    const pair=from+'>'+to; let c=null;
    if (!this.chromeBad[pair]) { c = await Promise.race([this.viaChrome(text, from, to), new Promise(r=>setTimeout(()=>r(null),4000))]); if (!c) this.chromeBad[pair]=true; }
    if (c) return {text:c, via:'chrome'};
    return {text: await this.viaMyMemory(text, from, to), via:'mymemory'};
  }
};
