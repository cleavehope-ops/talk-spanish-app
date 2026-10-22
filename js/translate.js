// Free, keyless translation: Chrome built-in Translator API first, then MyMemory public API.
const Translate = {
  cache:{}, chromeBad:{},
  // Chat messages: the online backup is OFF unless the user turns it on ('not set' = off).
  allowOnline(){ return localStorage.getItem('tt_mymemory')==='on'; },
  setOnline(on){ localStorage.setItem('tt_mymemory', on?'on':'off'); },
  // Building lessons for a new language sends only the app's fixed English lesson lines, never user text. On unless turned off.
  allowPackOnline(){ return localStorage.getItem('tt_mymemory_packs')!=='off'; },
  setPackOnline(on){ localStorage.setItem('tt_mymemory_packs', on?'on':'off'); },
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
    // MyMemory's top hit is sometimes a crowd memory with extra words ("Hey, Tony, how are you?").
    // Prefer close matches whose length is near the original and that add no quotes.
    if (Array.isArray(j.matches) && j.matches.length) {
      const n = text.length, score = m => (+m.match||0) - 0.6*Math.abs(m.translation.length-n)/Math.max(n,1) - (/["“”]/.test(m.translation) && !/["“”]/.test(text) ? 0.3 : 0);
      const best = j.matches.filter(m=>m.translation && (+m.match||0)>=0.5).sort((a,b)=>score(b)-score(a))[0];
      if (best && (!txt || score(best) > score({translation:txt, match:j.responseData.match}))) txt = best.translation;
    }
    if (j.responseStatus != 200 || !txt) throw new Error(j.responseDetails||'no translation');
    if (/MYMEMORY WARNING|QUOTA/i.test(txt)) throw new Error('quota');
    const d = document.createElement('textarea'); d.innerHTML = txt; return d.value;
  },
  async run(text, from, to, opts={}){ // returns {text, via} or throws
    if (from === to) return {text, via:'same'};
    const pair=from+'>'+to; let c=null;
    if (!this.chromeBad[pair]) { c = await Promise.race([this.viaChrome(text, from, to), new Promise(r=>setTimeout(()=>r(null),4000))]); if (!c) this.chromeBad[pair]=true; }
    if (c) return {text:c, via:'chrome'};
    if (!(opts.scope==='packs' ? this.allowPackOnline() : this.allowOnline())) throw new Error('offline-off');
    return {text: await this.viaMyMemory(text, from, to), via:'mymemory'};
  }
};
