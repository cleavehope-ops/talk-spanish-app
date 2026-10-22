// Startup splash (sun winks with a golden glow just before Home; skipped for reduced motion): ~1.8s, tap to skip. Says "Welcome to Talvoya" (pre-recorded) unless muted or turned off.
// First open: shows "Tap to start" and plays on that tap (iPhone blocks sound before a tap). Later opens: tries autoplay, skips quietly if blocked.
(function(){ const s=document.getElementById('splash'); if(!s) return;
  if (/[?&]nosplash\b/.test(location.search) || window.TT_NOSPLASH){ s.remove(); return; }
  const T=(t)=>typeof tx==='function'?tx(t):t;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches; if (calm) s.classList.add('calm');
  let p={}; try{ p=(typeof Prefs!=='undefined'&&Prefs.get())||{}; }catch(e){}
  const muted = localStorage.getItem('tt_msgmute')==='1' || p.sound===false || p.sayWelcome===false;
  const firstTime = !localStorage.getItem('tt_welcome_seen');
  let audio=null; if(!muted){ audio=new Audio('sounds/welcome_talvoya.mp3'); audio.preload='auto'; }
  const play=()=>{ if(!audio) return; try{ const r=audio.play(); if(r&&r.catch) r.catch(()=>{}); }catch(e){} };
  const say=document.getElementById('spSay'); const hear=()=>{ const a=audio||new Audio('sounds/welcome_talvoya.mp3'); try{ a.pause(); a.currentTime=0; }catch(e){} const r=a.play(); if(r&&r.catch) r.catch(()=>{}); };
  let done=false, winked=false; const wink=(then)=>{ if(calm||winked){ then(); return; } winked=true; s.classList.add('wink'); setTimeout(then, 700); };
  const finish=()=>wink(end);
  const end=(e)=>{ if(e && e.target && e.target.closest && e.target.closest('#spSay')) return; if(done) return; done=true; s.classList.add('out'); setTimeout(()=>s.remove(), calm?150:450); document.removeEventListener('pointerdown', end, true); };
  let heard=false; if (say){ say.addEventListener('pointerdown', e=>{ e.stopPropagation(); }, true); say.addEventListener('click', e=>{ e.stopPropagation(); if(heard) return; heard=true; hear(); localStorage.setItem('tt_welcome_seen','1'); setTimeout(finish,2550); }); }
  if (firstTime && audio && !(navigator.webdriver && !window.TT_TEST_WELCOME)){
    s.style.pointerEvents='auto';
    const b=document.createElement('button'); b.id='spStart'; b.className='sp-start'; b.textContent=T('Tap to start'); s.appendChild(b);
    s.addEventListener('click', ()=>{ if(heard) return; heard=true; b.style.transition='opacity .25s'; b.style.opacity='0'; b.style.pointerEvents='none'; play(); localStorage.setItem('tt_welcome_seen','1'); setTimeout(finish, 2550); }, {once:true});
    return;
  }
  localStorage.setItem('tt_welcome_seen','1');
  play();
  document.addEventListener('pointerdown', end, true); document.addEventListener('keydown', end, {once:true, capture:true}); setTimeout(finish, 2650); })();
