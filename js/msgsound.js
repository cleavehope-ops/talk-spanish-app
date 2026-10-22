// New-message sound. Choice + mute are saved on this phone. Only plays for messages from other people.
const MsgSound = (() => {
  const FILES = { pop:'sounds/1_soft_pop.mp3', chime:'sounds/2_travel_chime.mp3', marimba:'sounds/4_marimba_tap.mp3' };
  const LABELS = { pop:'Soft pop', chime:'Travel chime', marimba:'Marimba tap', off:'Off' };
  const get = (k,d) => { try { return JSON.parse(localStorage.getItem('tt_'+k)) ?? d; } catch(e){ return d; } };
  const set = (k,v) => localStorage.setItem('tt_'+k, JSON.stringify(v));
  const cache = {}; const el = k => cache[k] || (cache[k] = Object.assign(new Audio(FILES[k]), {preload:'auto'}));
  // iOS only allows sound after a tap: on the first tap, play each sound silently once.
  let unlocked=false; const unlock = () => { if (unlocked) return; unlocked=true;
    for (const k of Object.keys(FILES)) { const a=el(k); a.muted=true; a.play().then(()=>{ a.pause(); a.currentTime=0; a.muted=false; }).catch(()=>{ a.muted=false; }); } };
  document.addEventListener('touchend', unlock, {once:true, capture:true}); document.addEventListener('pointerdown', unlock, {once:true, capture:true});
  const choice = () => { const c=get('msgsound','pop'); return LABELS[c]?c:'pop'; };
  const playKey = k => { if (!FILES[k]) return; const a=el(k); try{ a.currentTime=0; a.volume=0.8; a.play().catch(()=>{}); }catch(e){} };
  return { LABELS, choice, setChoice:c=>set('msgsound',c), muted:()=>!!get('msgmute',false), setMuted:m=>set('msgmute',!!m),
    preview: playKey, play(){ if (this.muted() || choice()==='off') return; playKey(choice()); } };
})();
