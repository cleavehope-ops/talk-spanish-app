// Free, built-in browser voice: speechSynthesis (speak) + SpeechRecognition (listen).
const Speech = {
  LOCALES:{es:["es-MX","es-US","es-419","es-ES","es"],en:["en-US","en-GB","en"]},
  voiceFor(lang){
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    for (const l of this.LOCALES[lang]||[lang]) { const v = vs.find(v=>v.lang.replace('_','-').toLowerCase().startsWith(l.toLowerCase())); if (v) return v; }
    return null;
  },
  say(text, lang='es', slow=false){
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = (this.LOCALES[lang]||[lang])[0]; const v = this.voiceFor(lang); if (v) u.voice = v;
    u.rate = slow ? 0.6 : 0.95; speechSynthesis.speak(u);
  },
  canListen(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  listen(lang='es'){ // resolves with array of alternative transcripts
    return new Promise((res, rej)=>{
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return rej(new Error('unsupported'));
      const r = new R(); r.lang = (this.LOCALES[lang]||[lang])[0]; r.interimResults=false; r.maxAlternatives=5;
      let done=false;
      r.onresult = e => { done=true; res(Array.from(e.results[0]).map(a=>a.transcript)); };
      r.onerror = e => { if(!done){done=true; rej(new Error(e.error||'error'));} };
      r.onend = () => { if(!done){done=true; res([]);} };
      r.start();
    });
  },
  ding(){ // subtle "correct" chime via WebAudio, no files
    try{ const c = this._ac || (this._ac = new (window.AudioContext||window.webkitAudioContext)());
      [880,1320].forEach((f,i)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.value=f;
        const t=c.currentTime+i*0.09; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.08,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.3); }); }catch(e){}
  }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = ()=>{};
