// Voice notes + pronunciation check. Free browser APIs only: MediaRecorder (audio), SpeechRecognition (transcript).
Object.assign(ICONS, {
 send:'<path d="M4 12 20 4l-4 16-4-7-8-1z"/><path d="m12 13 8-9"/>',
 stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',
 flag:'<path d="M5 21V4h11l-2 4 2 4H5"/>',
 ban:'<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
 back2:'<path d="m15 5-7 7 7 7"/>',
 more:'<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
 trash:'<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
});
// Plain-words mic errors (with an iPhone tip). tx() gives Spanish.
const IS_APPLE_TOUCH = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const IS_SAFARI = /^((?!chrome|android|crios|fxios|opr|opera|edg).)*safari/i.test(navigator.userAgent);
function micErrorText(e){ const n=(e&&(e.name||e.error||e.message))||'';
  if (!window.isSecureContext) return tx('The mic only works on a secure (https) page.');
  if (/NotAllowed|Permission|not-allowed|SecurityError/i.test(n)) return IS_APPLE_TOUCH ? tx('Mic is blocked. On iPhone: Settings > Safari > Microphone > Allow, then reload this page.') : tx('Mic is blocked. Click the lock or mic icon next to the web address, allow the microphone, then reload.');
  if (/service-not-allowed/i.test(n)) return tx('Speech check is off on this phone. On iPhone: Settings > General > Keyboard > turn on Dictation. You can still tap an answer.');
  if (/NotFound|DevicesNotFound|audio-capture/i.test(n)) return tx('No microphone found. Plug one in or check your sound settings.');
  if (/NotReadable|TrackStart|Abort/i.test(n)) return tx('The mic is busy in another app. Close it and try again.');
  if (/unsupported|NotSupported/i.test(n)) return tx("This browser can't record voice notes. Please type instead.");
  if (/too-short/i.test(n)) return tx('Too short. Hold the mic a little longer.');
  return tx("The mic didn't work. Please try again, or type instead."); }
const Voice = {
  MAX_SEC: 60, MAX_BYTES: 1.6e6, // keeps the encrypted note under the server's 3 MB limit
  canRecord(){ return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder); },
  // iPhone Safari can't record or play WebM well, so prefer MP4/AAC, then WebM/Opus.
  pickMime(){ const ok=t=>{ try{ return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); }catch(e){ return false; } };
    return ['audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/aac','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg'].find(ok) || ''; },
  canPlay(mime){ const a=document.createElement('audio'); return !!a.canPlayType && a.canPlayType(String(mime||'').split(';')[0])!==''; },
  // Start recording. Returns a handle with stop() -> Promise<{blob, mime, dur, wave, heard[]}>.
  // If SpeechRecognition exists, it listens at the same time in the speaker's language.
  // Call straight from the tap handler: getUserMedia and the AudioContext are created before any other await (iOS needs the tap).
  async start(lang, onLevel){
    if (!window.isSecureContext) throw Object.assign(new Error('insecure'), {name:'SecurityError'});
    if (!this.canRecord()) throw Object.assign(new Error('unsupported'), {name:'NotSupportedError'});
    let ac=null; try{ ac = new (window.AudioContext||window.webkitAudioContext)(); ac.resume && ac.resume(); }catch(e){ ac=null; }
    const sp = navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
    let stream; try{ stream = await sp; }catch(e){ try{ ac&&ac.close(); }catch(_){} throw e; }
    const mime = this.pickMime();
    let rec; try{ rec = new MediaRecorder(stream, mime?{mimeType:mime}:{}); }catch(e){ try{ rec = new MediaRecorder(stream); }catch(e2){ stream.getTracks().forEach(t=>t.stop()); try{ ac&&ac.close(); }catch(_){} throw e2; } }
    const chunks=[], levels=[], t0=Date.now();
    rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
    let an, timer;
    try{ if(!ac) throw 0; an = ac.createAnalyser(); an.fftSize=512; ac.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.fftSize);
      timer = setInterval(()=>{ an.getByteTimeDomainData(buf); let pk=0; for (const v of buf) pk=Math.max(pk, Math.abs(v-128)); const l=Math.min(1, pk/64); levels.push(l); onLevel&&onLevel(l, (Date.now()-t0)/1000); }, 100);
    }catch(e){}
    let heardP = Promise.resolve([]), recog=null;
    if (Speech.canListen() && !IS_APPLE_TOUCH && !IS_SAFARI) { const R = window.SpeechRecognition || window.webkitSpeechRecognition; recog = new R(); recog.lang = Speech.locs(lang)[0]; recog.interimResults=false; recog.maxAlternatives=5; recog.continuous=true;
      heardP = new Promise(res=>{ const out=[]; recog.onresult=e=>{ for (let i=e.resultIndex;i<e.results.length;i++) if (e.results[i].isFinal) out.push(Array.from(e.results[i]).map(a=>a.transcript)); };
        recog.onerror=()=>{}; recog.onend=()=>{ // join best alternatives of each phrase; also offer the alternatives of a single-phrase note
          res(out.length===1 ? out[0] : out.length ? [out.map(a=>a[0]).join(' ')] : []); }; });
      try{ recog.start(); }catch(e){ heardP=Promise.resolve([]); } }
    rec.start(1000);
    const auto = setTimeout(()=>h.stop(), this.MAX_SEC*1000);
    const h = { stopped:null, stop:()=> h.stopped || (h.stopped = new Promise(res=>{ clearTimeout(auto); clearInterval(timer);
      rec.onstop = async ()=>{ stream.getTracks().forEach(t=>t.stop()); try{ ac&&ac.close(); }catch(e){}
        const heard = await Promise.race([heardP, new Promise(r=>setTimeout(()=>r([]),2500))]);
        const type=(rec.mimeType||mime||'audio/mp4'); res({blob:new Blob(chunks,{type}), mime:type, dur:(Date.now()-t0)/1000, wave:Voice.bars(levels), heard, empty:!chunks.length}); };
      try{ recog&&recog.stop(); }catch(e){} try{ rec.requestData && rec.state==='recording' && rec.requestData(); }catch(e){} try{ rec.stop(); }catch(e){ rec.onstop(); } })),
      cancel:()=>{ clearTimeout(auto); clearInterval(timer); try{ recog&&recog.abort(); }catch(e){} try{ rec.stop(); }catch(e){} stream.getTracks().forEach(t=>t.stop()); try{ ac&&ac.close(); }catch(e){} } };
    return h;
  },
  bars(levels, n=28){ if (!levels.length) return Array(n).fill(0.15); const out=[];
    for (let i=0;i<n;i++){ const a=Math.floor(i*levels.length/n), b=Math.max(a+1, Math.floor((i+1)*levels.length/n)); out.push(Math.max(0.12, Math.max(...levels.slice(a,b)))); }
    return out.map(x=>Math.round(x*100)/100); },
  waveHtml(wave, cls=''){ return `<span class="wa-wave ${cls}">${wave.map(v=>`<i style="height:${Math.round(4+v*22)}px"></i>`).join('')}</span>`; },
  fmt(sec){ sec=Math.max(0,Math.round(sec)); return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0'); },
  async blobToB64(blob){ const b=new Uint8Array(await blob.arrayBuffer()); let s=''; for (let i=0;i<b.length;i+=0x8000) s+=String.fromCharCode(...b.subarray(i,i+0x8000)); return btoa(s); },
  b64ToBlob(b64, mime){ return new Blob([Uint8Array.from(atob(b64), c=>c.charCodeAt(0))], {type:mime}); },
  // Encrypt a voice note with the room key: audio and the message text (transcript, wave, length) are locked separately.
  async seal(key, note){ const audio = await E2E.encrypt(key, JSON.stringify({mime:note.mime, b64: await this.blobToB64(note.blob)}));
    const meta = await E2E.encrypt(key, JSON.stringify({transcript:note.transcript||'', dur:note.dur, wave:note.wave, note:note.note||''})); return {audio, meta}; },
  async openAudio(key, blob){ const a = JSON.parse(await E2E.decrypt(key, blob)); return this.b64ToBlob(a.b64, a.mime); },
};
// Pronunciation check: compare what was heard to the phrase you meant to say, word by word,
// with the app's own matchers (wordOk for spaced languages, simCompact for Chinese/Japanese/Thai...).
const Pron = {
  score(heardList, target){
    heardList = (Array.isArray(heardList)?heardList:[heardList]).filter(Boolean);
    const compact = CJK_RE.test(target);
    let best = null;
    for (const heard of heardList.length?heardList:['']) { const r = compact ? this._compact(heard, target) : this._words(heard, target); r.heard = heard;
      if (!best || r.right>best.right || (r.right===best.right && r.sim>best.sim)) best = r; }
    best.pct = best.total ? Math.round(100*best.right/best.total) : 0; best.pass = best.total>0 && best.right===best.total; return best;
  },
  _words(heard, target){ const ap = x => String(x||'').replace(/['’‘ʼ`´]/g,''); heard = ap(heard); target = ap(target); // "That's" and "that’s" stay one word
    const raw = String(target).replace(/\*/g,' ').split(/\s+/).filter(w=>norm(w)); const got = norm(heard).split(' ').filter(Boolean), used=new Set();
    const words = raw.map(w=>{ const e=norm(w); const i=got.findIndex((g,k)=>!used.has(k) && wordOk(e,g)); if(i>=0) used.add(i); return {w, ok:i>=0}; });
    return {words, right:words.filter(x=>x.ok).length, total:words.length, sim: heard ? sim(heard, target) : 0}; },
  _compact(heard, target){ // each character of the phrase counts as one "word"; overall closeness from simCompact
    const h = norm(heard).replace(/\s/g,''); const chars=[...String(target)].filter(c=>norm(c).trim()); let pos=0;
    const words = chars.map(c=>{ const n=norm(c); const i=h.indexOf(n,pos); if(i>=0){ pos=i+n.length; return {w:c, ok:true}; } return {w:c, ok:h.includes(n)}; });
    return {words, right:words.filter(x=>x.ok).length, total:words.length, sim: heard ? simCompact(heard, target) : 0}; },
  html(r){ if (!r.total) return '';
    return `<div class="pron ${r.pass?'good':''}"><b>${r.right} of ${r.total} words right</b>
      <div class="pw">${r.words.map(x=>`<span class="${x.ok?'ok':'miss'}">${esc(x.w)}</span>`).join(' ')}</div>
      ${r.heard?`<small>I heard: “${esc(r.heard)}”</small>`:'<small>I didn\'t catch any words. Try again a little closer to the mic.</small>'}</div>`; },
};
