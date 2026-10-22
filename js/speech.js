// Free, built-in browser voice: speechSynthesis (speak) + SpeechRecognition (listen).
const Speech = {
  override:{}, // code -> locale list from the loaded pack
  locs(lang){ return this.override[lang] || (LANGS[lang]||[0,[lang]])[1]; },
  voiceFor(lang){
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    for (const l of this.locs(lang)) { const v = vs.find(v=>v.lang.replace('_','-').toLowerCase().startsWith(l.toLowerCase())); if (v) return v; }
    return null;
  },
  say(text, lang='es', slow=false){
    if (!('speechSynthesis' in window)) return;
    const ss = speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const v = this.voiceFor(lang); u.lang = v ? v.lang : this.locs(lang)[0]; if (v) u.voice = v;
    u.rate = slow ? 0.6 : 0.95; u.volume = 1;
    if (ss.speaking || ss.pending){ ss.cancel(); setTimeout(()=>ss.speak(u), 120); } // iPhone drops speak() right after cancel()
    else ss.speak(u); // called straight from the tap so iPhone allows it
    if (ss.paused) ss.resume();
  },
  canListen(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },
  listen(lang='es'){ // resolves with array of alternative transcripts
    return new Promise((res, rej)=>{
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return rej(new Error('unsupported'));
      const r = new R(); r.lang = this.locs(lang)[0]; r.interimResults=false; r.maxAlternatives=5;
      let done=false;
      r.onresult = e => { done=true; res(Array.from(e.results[0]).map(a=>a.transcript)); };
      r.onerror = e => { if(!done){done=true; const err=new Error(typeof micErrorText==='function'?micErrorText(e):(e.error||'error')); err.code=e.error; rej(err);} };
      r.onend = () => { if(!done){done=true; res([]);} };
      setTimeout(()=>{ if(!done){ done=true; try{ r.abort(); }catch(e){} res([]); } }, 12000); // iPhone sometimes never ends
      try{ r.start(); }catch(e){ done=true; rej(new Error(typeof micErrorText==='function'?micErrorText(e):'error')); }
    });
  },
  ding(){ // subtle "correct" chime via WebAudio, no files
    try{ const c = this._ac || (this._ac = new (window.AudioContext||window.webkitAudioContext)());
      [880,1320].forEach((f,i)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='sine'; o.frequency.value=f;
        const t=c.currentTime+i*0.09; g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.08,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
        o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.3); }); }catch(e){}
  }
};
if ('speechSynthesis' in window){ try{ speechSynthesis.getVoices(); }catch(e){} speechSynthesis.onvoiceschanged = ()=>{ try{ speechSynthesis.getVoices(); }catch(e){} }; } // iPhone loads voices late
