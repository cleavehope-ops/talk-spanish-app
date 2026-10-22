// Fun layer: practice-buddy avatars, scene pictures, confetti, cheer sound, streak, settings. No images or network needed.
const Prefs = { get(){ const d={sound:true, anim:!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}; try{ return Object.assign(d, JSON.parse(localStorage.getItem('tt_prefs')||'{}')); }catch(e){ return d; } },
  set(k,v){ const p=this.get(); p[k]=v; localStorage.setItem('tt_prefs', JSON.stringify(p)); } };

// Pretend characters (cartoon, not real people). Same buddy in every language.
const BUDDIES = {
  meet:{name:'Anna', role:'a pretend friend at the park', intro:'you meet', skin:'#f2c9a0', hair:'#7a4b2a', shirt:'#E0A526', style:'bob'},
  cafe:{name:'Leo', role:'a pretend server at the café', intro:'you order from', skin:'#c98d5b', hair:'#2d2d2d', shirt:'#9C4A2F', style:'short'},
  directions:{name:'Mia', role:'a pretend helper on the street', intro:'you ask the way from', skin:'#8d5a3b', hair:'#1f1f1f', shirt:'#7A3A24', style:'puffs'},
};
function buddyFor(sc, pack){ const b = BUDDIES[sc.id] || {name:'Sam', role:'a pretend friend', intro:'you chat with', skin:'#f0c08a', hair:'#5b3a1e', shirt:'#9C4A2F', style:'short'};
  const n = (pack && pack.buddyNames && pack.buddyNames[sc.id]) || b.name; return Object.assign({}, b, {name:n}); }
function avatarSVG(b, size=64){
  const hair = b.style==='bob' ? `<path d="M14 34c0-16 9-24 18-24s18 8 18 24v10h-6V30c-4 2-16 2-24-6v20h-6z" fill="${b.hair}"/>`
    : b.style==='puffs' ? `<circle cx="16" cy="18" r="8" fill="${b.hair}"/><circle cx="48" cy="18" r="8" fill="${b.hair}"/><path d="M17 28c0-12 7-17 15-17s15 5 15 17c-6-5-24-5-30 0z" fill="${b.hair}"/>`
    : `<path d="M17 28c0-12 7-18 15-18s15 6 15 18c-4-4-9-6-15-6s-11 2-15 6z" fill="${b.hair}"/>`;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="31" fill="#FFF8F2"/>
   <path d="M12 64c2-12 10-17 20-17s18 5 20 17z" fill="${b.shirt}"/><circle cx="32" cy="31" r="15" fill="${b.skin}"/>${hair}
   <circle cx="26" cy="31" r="2.2" fill="#222"/><circle cx="38" cy="31" r="2.2" fill="#222"/>
   <circle cx="22" cy="36" r="2.5" fill="#ff8a8a" opacity=".5"/><circle cx="42" cy="36" r="2.5" fill="#ff8a8a" opacity=".5"/>
   <path d="M26 38c3 4 9 4 12 0" stroke="#222" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}
const buddyTag = b => `<span class="buddy-tag"><b>${esc(b.name)}</b> · ${tx('practice buddy')}</span>`;
// Simple cartoon scene pictures
const PICS = {
  meet:`<svg viewBox="0 0 160 90" class="pic"><rect width="160" height="90" fill="#F6D6C2"/><circle cx="135" cy="18" r="11" fill="#E0A526"/><rect y="62" width="160" height="28" fill="#E8B49A"/><rect x="28" y="40" width="6" height="26" fill="#8b5a2b"/><circle cx="31" cy="36" r="16" fill="#7A3A24"/><rect x="70" y="58" width="44" height="5" rx="2" fill="#c47a3c"/><rect x="74" y="63" width="4" height="9" fill="#8b5a2b"/><rect x="106" y="63" width="4" height="9" fill="#8b5a2b"/></svg>`,
  cafe:`<svg viewBox="0 0 160 90" class="pic"><rect width="160" height="90" fill="#FFF8F2"/><rect x="0" y="0" width="160" height="16" fill="#9C4A2F"/><path d="M0 16h20l-10 8zM20 16h20l-10 8zM40 16h20l-10 8zM60 16h20l-10 8zM80 16h20l-10 8zM100 16h20l-10 8zM120 16h20l-10 8zM140 16h20l-10 8z" fill="#fff"/><rect x="58" y="44" width="34" height="30" rx="6" fill="#fff"/><path d="M92 50c10 0 10 16 0 16" stroke="#fff" stroke-width="5" fill="none"/><path d="M66 36c0-6 6-6 6-12M78 36c0-6 6-6 6-12" stroke="#6B5B45" stroke-width="3" fill="none" stroke-linecap="round"/><rect y="74" width="160" height="16" fill="#EBCDB8"/></svg>`,
  directions:`<svg viewBox="0 0 160 90" class="pic"><rect width="160" height="90" fill="#FBE7DA"/><rect x="8" y="22" width="30" height="50" fill="#D9A288"/><rect x="122" y="14" width="30" height="58" fill="#F0C9B3"/><rect y="70" width="160" height="20" fill="#6B4A3E"/><rect x="20" y="78" width="18" height="3" fill="#fff"/><rect x="70" y="78" width="18" height="3" fill="#fff"/><rect x="120" y="78" width="18" height="3" fill="#fff"/><rect x="78" y="24" width="4" height="48" fill="#555"/><path d="M60 26h36l8 6-8 6H60z" fill="#7A3A24"/><path d="M100 42H64l-8 6 8 6h36z" fill="#E0A526"/></svg>`,
};
const picFor = sc => PICS[sc.id] || `<div class="pic pic-emoji">${sc.icon||'💬'}</div>`;

// Cheerful sound + confetti
function cheer(){
  const p = Prefs.get();
  if (p.sound) try{ const c = Speech._ac || (Speech._ac = new (window.AudioContext||window.webkitAudioContext)());
    [659,880].forEach((f,i)=>{ const o=c.createOscillator(), g=c.createGain(); o.type='triangle'; o.frequency.value=f; const t=c.currentTime+i*0.08;
      g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.05,t+0.02); g.gain.exponentialRampToValueAtTime(0.0001,t+0.3); o.connect(g).connect(c.destination); o.start(t); o.stop(t+0.32); }); }catch(e){}
  if (p.anim) confetti();
}
function confetti(){
  const box=document.createElement('div'); box.className='confetti'; const cols=['#9C4A2F','#E0A526','#F6D6C2','#7A3A24','#FFF8F2'];
  for (let i=0;i<14;i++){ const s=document.createElement('i'); s.style.left=(15+Math.random()*70)+'%'; s.style.background=cols[i%cols.length];
    s.style.animationDelay=(Math.random()*0.25)+'s'; s.style.animationDuration=(0.9+Math.random()*0.7)+'s'; s.style.transform=`rotate(${Math.random()*360}deg)`; box.appendChild(s); }
  document.body.appendChild(box); setTimeout(()=>box.remove(), 1900);
}

// Kind streak: counts days with at least one correct answer. One free rest day per week (Mon-Sun) keeps the streak.
const dayKey = d => { const x=new Date(d); return x.getFullYear()+'-'+(x.getMonth()+1)+'-'+x.getDate(); };
const weekKey = d => { const x=new Date(d); x.setHours(0,0,0,0); x.setDate(x.getDate()-((x.getDay()+6)%7)); return dayKey(x); };
const Streak = {
  get(){ try{ return JSON.parse(localStorage.getItem('tt_streak')) || {count:0,last:null,restWeek:null}; }catch(e){ return {count:0,last:null,restWeek:null}; } },
  save(s){ localStorage.setItem('tt_streak', JSON.stringify(s)); },
  daysBetween(a,b){ const p=s=>{const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d);}; return Math.round((p(b)-p(a))/864e5); },
  mark(now=Date.now()){ const s=this.get(), today=dayKey(now);
    if (s.last===today) return s;
    const gap = s.last ? this.daysBetween(s.last, today) : 99;
    if (gap===1) s.count++;
    else if (gap===2 && s.restWeek!==weekKey(now)) { s.count++; s.restWeek=weekKey(now); }
    else s.count=1;
    s.last=today; this.save(s); return s; },
  view(now=Date.now()){ const s=this.get(); if (!s.last) return {count:0, alive:false, restLeft:true};
    const gap=this.daysBetween(s.last, dayKey(now)); const restLeft = s.restWeek!==weekKey(now);
    const alive = gap<=1 || (gap===2 && restLeft); return {count: alive?s.count:0, alive, restLeft, today: gap===0}; }
};
