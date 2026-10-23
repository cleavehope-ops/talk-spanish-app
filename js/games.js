// Talvoya games: 7 trip games with levels (one level per real city where the language is spoken), points and passport stamps.
// Free and on this phone only (localStorage). Uses app globals: PACK, Speech, Pron, sim, norm, tx, esc, store, cheer, I, toast.
(function(){
Object.assign((I18N.es = I18N.es || {}), {
 'Games':'Juegos','Trip games':'Juegos de viaje','points':'puntos','Points':'Puntos','Best':'Mejor','Level':'Nivel','Locked':'Bloqueado','Play game':'Jugar',
 'Order Before Time Runs Out':'Pide antes de que se acabe el tiempo','Lost in the City':'Perdido en la ciudad','Say It Right':'Dilo bien','Fix the Message':'Arregla el mensaje','Passport Stamps':'Sellos del pasaporte','Quick Ear':'Oído rápido','Two-Player Challenge':'Reto de dos jugadores',
 'Tap the words in order, or say it.':'Toca las palabras en orden, o dilo.','Pick what they said to find the way.':'Elige lo que dijeron para encontrar el camino.','Say the phrase out loud, like karaoke.':'Di la frase en voz alta, como karaoke.','Put the text back in order before it sends.':'Ordena el mensaje antes de que se envíe.','A stamp for every city you finish.':'Un sello por cada ciudad que terminas.','Hear it, tap what it means.':'Escúchalo y toca lo que significa.','Race a friend on the same phrases.':'Compite con un amigo con las mismas frases.',
 'Order:':'Pide:','Hear it':'Escúchalo','Hear the question':'Escuchar la pregunta','Hear it slowly':'Escúchalo despacio','Say it':'Dilo','Hint':'Pista','Undo':'Borrar','Hear':'Escuchar','Slow':'Lento','Next':'Siguiente','Done':'Listo','Back to games':'Volver a los juegos','Play again':'Jugar otra vez','Next level':'Siguiente nivel',
 'Level complete!':'¡Nivel completado!','Nice try!':'¡Buen intento!','right':'bien','Accuracy':'Precisión','Speed':'Rapidez','No hints':'Sin pistas','Base':'Base','Total points':'Puntos totales','New city unlocked:':'Nueva ciudad desbloqueada:','Get most of them right to unlock the next city. Your points are kept.':'Acierta la mayoría para desbloquear la siguiente ciudad. Tus puntos se guardan.',
 'Great!':'¡Genial!','Oops, try the next one':'Uy, prueba la siguiente','Time is up':'Se acabó el tiempo','Wrong street! Back you go.':'¡Calle equivocada! Vuelve.','You found the hotel!':'¡Encontraste el hotel!',
 'is a practice character, not a real person.':'es un personaje de práctica, no una persona real.','Your friend (practice character)':'Tu amigo (personaje de práctica)','Sending in':'Se envía en',
 'Tap the mic and say:':'Toca el micrófono y di:','Listening…':'Escuchando…','Speaking check is not on this browser. Listen, say it, then tap I said it.':'Este navegador no revisa la voz. Escucha, dilo y toca Lo dije.','score':'puntaje','best':'mejor',
 'What did they say?':'¿Qué dijeron?','stamps':'sellos','No streaks here. Play any day, any city.':'Aquí no hay rachas. Juega cualquier día, cualquier ciudad.','Not yet':'Todavía no',
 'Pass and play (same phone)':'Pasar y jugar (mismo teléfono)','Challenge code (two phones)':'Código de reto (dos teléfonos)','Both phones type the same code to get the same phrases. Then compare points.':'Los dos teléfonos escriben el mismo código para tener las mismas frases. Luego comparen puntos.','Player':'Jugador','Your turn':'Tu turno','Pass the phone to':'Pasa el teléfono a','wins!':'¡gana!','It is a tie!':'¡Empate!','Live online race is coming soon.':'La carrera en vivo por internet llegará pronto.','Make a code':'Crear código','Start':'Empezar','Code':'Código','Pick a city':'Elige una ciudad','Winner bonus':'Bonus del ganador',
 'Order':'Pedido','Points are saved on this phone only.':'Los puntos se guardan solo en este teléfono.','Characters are practice buddies, not real people.':'Los personajes son compañeros de práctica, no personas reales.',
 'Mexico City':'Ciudad de México','New York':'Nueva York','London':'Londres','Havana':'La Habana','Sydney':'Sídney','Dublin':'Dublín','Toronto':'Toronto','Miami':'Miami',
 'Hot dog cart':'Carrito de hot dogs','Fish and chips shop':'Tienda de pescado frito','Juice stand':'Puesto de jugos','Meat pie shop':'Tienda de pasteles de carne','Poutine truck':'Camión de poutine','Breakfast café':'Café de desayunos','market':'mercado','beach':'playa','airport':'aeropuerto','hotel street':'calle del hotel',
});
const T = k => tx(k);
const GAMES = [
 {id:'order', icon:'⏱️', name:'Order Before Time Runs Out', d:'Tap the words in order, or say it.'},
 {id:'lost',  icon:'🗺️', name:'Lost in the City', d:'Pick what they said to find the way.'},
 {id:'say',   icon:'🎤', name:'Say It Right', d:'Say the phrase out loud, like karaoke.'},
 {id:'fix',   icon:'💬', name:'Fix the Message', d:'Put the text back in order before it sends.'},
 {id:'ear',   icon:'👂', name:'Quick Ear', d:'Hear it, tap what it means.'},
 {id:'duel',  icon:'🏁', name:'Two-Player Challenge', d:'Race a friend on the same phrases.'},
 {id:'passport', icon:'🛂', name:'Passport Stamps', d:'A stamp for every city you finish.'},
];
const BUDDIES = ['🧑🏽‍🍳','👩🏻‍🦰','🧔🏾','👵🏼','👨🏻‍🎤','👩🏽‍💼'];
const BUDDY_NAMES = ['Lola','Sam','Nico','Rosa','Kai','Mina'];
// ---------- state (this phone only) ----------
const LKEY = () => 'games_'+(PACK?PACK.speak+'-'+PACK.learn:'x');
const S = { get(){ return store.get(LKEY(), {best:{}, done:{}, stamps:{}}); }, set(v){ store.set(LKEY(), v); },
  total(){ return store.get('gpoints', 0); }, add(n){ store.set('gpoints', this.total()+Math.max(0,Math.round(n))); } };
const cities = () => citiesFor(PACK.learn);
const cname = c => T(c.n);
const unlocked = (g, i) => i===0 || !!(S.get().done[g]||{})[i-1];
// ---------- random + phrases ----------
function rng(seed){ let h=1779033703^String(seed).length; for (const ch of String(seed)) { h=Math.imul(h^ch.charCodeAt(0),3432918353); h=h<<13|h>>>19; }
  return () => { h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909); return ((h^=h>>>16)>>>0)/4294967296; }; }
let R = Math.random;
const shuffle = a => { a=[...a]; for (let i=a.length-1;i>0;i--){ const j=Math.floor(R()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
function phrases(sceneId){ const out=[], seen=new Set();
  for (const sc of PACK.scenes) { if (sceneId && sc.id!==sceneId) continue;
    for (const tu of Object.values(sc.turns)) for (const x of [tu.they, ...tu.replies]) { if (!x||!x.t||/[()*]/.test(x.t)||seen.has(x.t)) continue; seen.add(x.t); out.push({t:x.t, m:x.m||'', s:x.s||''}); } }
  return out; }
// Levels get harder: later cities use longer phrases and less time.
// Seen/correct/wrong per learn language (this phone only): correct items don't come back until the pool runs out; wrong ones come first next time.
const SEEN = { key:()=>'seen_'+(PACK?PACK.learn:'x'), get(){ const v=store.get(this.key(),{}); v.ok=v.ok||{}; v.bad=v.bad||{}; return v; }, set(v){ store.set(this.key(),v); },
  mark(t, ok){ const v=this.get(), now=Date.now(); if(ok){ v.ok[t]=now; delete v.bad[t]; } else { v.bad[t]=now; delete v.ok[t]; } this.set(v); } };
function rankFresh(list, n){ const v=SEEN.get(), seen=new Set(), uniq=list.filter(x=>!seen.has(x.t)&&seen.add(x.t));
  const bad=uniq.filter(x=>v.bad[x.t]).sort((a,b)=>v.bad[a.t]-v.bad[b.t]), fresh=uniq.filter(x=>!v.bad[x.t]&&!v.ok[x.t]), ok=uniq.filter(x=>v.ok[x.t]&&!v.bad[x.t]).sort((a,b)=>v.ok[a.t]-v.ok[b.t]);
  return [...bad, ...fresh, ...ok].slice(0,n); }
function pick(sceneId, lvl, n, fixed){ n = n || (lvl>=2 ? 6 : 5); if (!fixed) { const lv=pickLevel(sceneId, lvl, n, 99), all=phrases(sceneId), rest=phrases(); return shuffle(rankFresh([...lv, ...all, ...rest], n)); } return pickLevel(sceneId, lvl, n); }
function pickLevel(sceneId, lvl, n, keep){ let p=phrases(sceneId); if (p.length<n+4) p=[...p, ...shuffle(phrases().filter(x=>!p.includes(x)&&!p.some(y=>y.t===x.t)))].slice(0, Math.max(p.length, n+6));
  p.sort((a,b)=>a.t.length-b.t.length); const span=Math.max(n, Math.ceil(p.length*0.6)), start=Math.min(p.length-span, Math.floor((p.length-span)*Math.min(1,lvl/4)));
  return shuffle(p.slice(Math.max(0,start), Math.max(0,start)+span)).slice(0, keep||n); }
function words(t){ const lang=PACK.learn;
  if ((PACK.compact || CJK_RE.test(t)) && window.Intl && Intl.Segmenter) return [...new Intl.Segmenter(lang,{granularity:'word'}).segment(t)].map(s=>s.segment).filter(s=>s.trim() && norm(s));
  return t.split(/\s+/).filter(Boolean); }
const uniqM = a => { const s=new Set(); return a.filter(x=>{ const k=norm(x.m); if(s.has(k)) return false; s.add(k); return true; }); };
const joinW = ws => (PACK.compact ? ws.join('') : ws.join(' '));
const say = (t, slow) => Speech.say(t, PACK.learn, slow);
const hear = t => `<button class="g-hear g-qhear" data-say="${esc(t)}" aria-label="${esc(T('Hear it'))}">${I('volume')}</button>`;
// Speaker for a prompt in the user's own language (the meaning line).
const myLang = () => (PACK && PACK.speak) || (settings().speak) || 'en';
const hearMine = t => `<button class="g-hear g-qhear" data-say="${esc(t)}" data-lang="${esc(myLang())}" aria-label="${esc(T('Hear the question'))}">${I('volume')}</button>`;
// Called straight inside the tap, so iPhone allows the speech.
function bindHear(root=document){ root.querySelectorAll('[data-say]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); if (b.dataset.lang) Speech.say(b.dataset.say, b.dataset.lang, b.dataset.slow==='1'); else say(b.dataset.say, b.dataset.slow==='1'); }); }
let timers=[], runId=0; const clearT=()=>{ timers.forEach(clearInterval); timers=[]; };
function countdown(sec, el, onEnd){ const t0=Date.now(); const iv=setInterval(()=>{ const left=Math.max(0, sec-(Date.now()-t0)/1000);
    if (!document.body.contains(el)) return clearInterval(iv); el.style.width=(100*left/sec)+'%'; el.classList.toggle('low', left<sec*0.3); if (left<=0){ clearInterval(iv); onEnd(); } }, 100); timers.push(iv); return ()=>clearInterval(iv); }
const head = (g, c, lvl) => `<div class="g-top"><button class="g-back" onclick="location.hash='games'" aria-label="Back">‹</button><div><b>${g.icon} ${T(g.name)}</b><small>${c.f} ${esc(cname(c))} · ${T('Level')} ${lvl+1}</small></div><span class="g-pts">⭐ ${S.total()}</span></div>`;
// ---------- level runner (5 rounds, then the level-complete screen) ----------
function run(gid, lvl, roundFn, opts={}){
  const g=GAMES.find(x=>x.id===gid), c=cities()[lvl]; const N=opts.n||5; const my=++runId; const st={i:0, ok:0, hint:false, rq:new Set(), t0:Date.now(), items:opts.items||pick(opts.scene, lvl, N)};
  const next = (ok) => { if (my!==runId) return; timers.forEach(clearInterval); timers=[]; const it=st.items[st.i]; if (it && gid!=='duel') SEEN.mark(it.t, !!ok);
    if (ok) { st.ok++; Speech.ding(); } else if (it && gid!=='duel' && !st.rq.has(it.t)) { st.rq.add(it.t); st.items.push(it); } /* wrong: comes back later this round (once) */ st.i++; setTimeout(()=>{ if (my!==runId) return; if (st.i>=st.items.length) return (opts.onEnd||finish)(gid, lvl, st); step(); }, ok?650:1100); };
  const step = () => { app.innerHTML = head(g,c,lvl)+`<div class="g-prog">${st.items.map((_,k)=>`<i class="${k<st.i?'d':''}${k===st.i?' n':''}"></i>`).join('')}</div><div id="gbody"></div>`;
    roundFn($('#gbody'), st.items[st.i], {lvl, c, st, next, hint(){ st.hint=true; }}); bindHear(); };
  st.n0=st.items.length; window.__game = st; step();
}
function scoreOf(st){ const n=st.n0||st.items.length; st={...st, ok:Math.min(st.ok, n)}; const secs=(Date.now()-st.t0)/1000, per=secs/n;
  const base=100, acc=Math.round(50*st.ok/n), speed=st.ok? Math.round(30*Math.max(0, Math.min(1,(14-per)/10))) : 0, nohint= st.hint?0:20;
  return {base, acc, speed, nohint, total: base+acc+speed+nohint, pass: st.ok>=Math.ceil(n*0.6)}; }
function finish(gid, lvl, st, extra){
  const sc=scoreOf(st), g=GAMES.find(x=>x.id===gid), c=cities()[lvl], s=S.get();
  if (extra) { sc.win=extra; sc.total+=extra; }
  s.best[gid+':'+lvl] = Math.max(s.best[gid+':'+lvl]||0, sc.total); s.best[gid] = Math.max(s.best[gid]||0, sc.total);
  let unlockedNow=null;
  if (sc.pass) { (s.done[gid]=s.done[gid]||{}); if (!s.done[gid][lvl] && cities()[lvl+1]) unlockedNow=cities()[lvl+1]; s.done[gid][lvl]=true; if (!s.stamps[c.n]) s.stamps[c.n]=Date.now(); }
  S.set(s); S.add(sc.total); if (sc.pass) cheer();
  const row=(k,v)=>`<div class="lc-row"><span>${T(k)}</span><b>+${v}</b></div>`;
  app.innerHTML = `<div class="lc"><div class="lc-badge">${sc.pass?c.f:'💪'}</div><h2>${T(sc.pass?'Level complete!':'Nice try!')}</h2>
   <p class="muted">${g.icon} ${T(g.name)} · ${esc(cname(c))} · ${st.ok}/${st.items.length} ${T('right')}</p>
   <div class="lc-pts">+${sc.total} <small>${T('points')}</small></div>
   <div class="card lc-list">${row('Base',sc.base)}${row('Accuracy',sc.acc)}${row('Speed',sc.speed)}${row('No hints',sc.nohint)}${sc.win?row('Winner bonus',sc.win):''}</div>
   <div class="lc-total">⭐ ${T('Total points')}: <b>${S.total()}</b> · ${T('Best')}: ${s.best[gid]}</div>
   ${unlockedNow?`<div class="lc-unlock">🔓 ${T('New city unlocked:')} ${unlockedNow.f} <b>${esc(cname(unlockedNow))}</b></div>`:''}
   ${sc.pass?'':`<p class="muted">${T('Get most of them right to unlock the next city. Your points are kept.')}</p>`}
   ${sc.pass&&cities()[lvl+1]&&gid!=='duel'?`<button class="big g-main" onclick="location.hash='games/${gid}/${lvl+1}'">${T('Next level')} ›</button>`:''}
   <div class="row"><button class="alt" onclick="Games.replay('${gid}',${lvl})">${T('Play again')}</button><button class="alt" onclick="location.hash='games'">${T('Back to games')}</button></div></div>`;
}
// ---------- tile picker (Order + Fix) ----------
function tiles(el, item, done, extraWords=[]){
  const target=words(item.t), pool=shuffle([...target.map((w,k)=>({w,k})), ...extraWords.map(w=>({w,k:-1}))]); let got=[];
  const draw=()=>{ el.querySelector('.g-ans').innerHTML = got.length? got.map(x=>`<span>${esc(x.w)}</span>`).join(''):'<em>…</em>';
    el.querySelectorAll('.g-tile').forEach(b=>b.disabled=got.includes(pool[+b.dataset.i])); };
  el.querySelector('.g-tiles').innerHTML = pool.map((x,i)=>`<button class="g-tile" data-i="${i}">${esc(x.w)}</button>`).join('');
  el.querySelectorAll('.g-tile').forEach(b=>b.onclick=()=>{ got.push(pool[+b.dataset.i]); draw(); if (got.length===target.length) done(norm(joinW(got.map(x=>x.w)))===norm(joinW(target))); else if (got.filter(x=>x.k>=0).length && 0) {} });
  const u=el.querySelector('.g-undo'); if (u) u.onclick=()=>{ got.pop(); draw(); };
  draw(); return { check:()=> norm(joinW(got.map(x=>x.w)))===norm(joinW(target)) };
}
function feedback(el, ok, item, msg){ el.insertAdjacentHTML('beforeend', `<div class="g-fb ${ok?'ok':'no'}">${ok?'✅ '+T('Great!'):'💡 '+T(msg||'Oops, try the next one')}<div class="es">${esc(item.t)} ${hear(item.t)}</div><small>${esc(item.m)}</small></div>`); bindHear(el); if(!ok) say(item.t); }
// 1. Order Before Time Runs Out
function order(lvl){ const c=cities()[lvl], b=lvl%BUDDIES.length, sec=Math.max(12, 26-3*lvl), all=phrases();
  run('order', lvl, (el, item, x) => {
    el.innerHTML = `<div class="g-stand" style="--city:${c.col}"><div class="g-awning"></div><div class="g-standname">${c.food.e} ${esc(T(c.food.stand))} · ${c.f}</div><div class="g-buddy" id="bud">${BUDDIES[b]}</div><small>${BUDDY_NAMES[b]} ${T('is a practice character, not a real person.')}</small></div>
     <div class="g-timer"><i id="tbar"></i></div><div class="card g-q"><div class="muted">${T('Order:')}</div><div class="g-big">${esc(item.m)} ${hearMine(item.m)}</div></div>
     <div class="g-ans"></div><div class="g-tiles"></div>
     <div class="row g-tools"><button class="alt g-undo">↩ ${T('Undo')}</button><button class="alt" id="ghint">💡 ${T('Hint')}</button>${Speech.canListen()?`<button id="gmic">🎤 ${T('Say it')}</button>`:''}</div>`;
    let over=false; const end=(ok,msg)=>{ if(over) return; over=true; clearT(); $('#bud').textContent= ok?'😄':'🤔'; $('#bud').classList.add(ok?'happy':'huh'); el.querySelectorAll('button').forEach(z=>z.disabled=true); feedback(el, ok, item, msg); x.next(ok); };
    const decoy=shuffle(all.filter(p=>p.t!==item.t).flatMap(p=>words(p.t))).slice(0, Math.min(3,1+lvl));
    tiles(el, item, ok=>end(ok), decoy);
    countdown(sec, $('#tbar'), ()=>end(false,'Time is up'));
    $('#ghint').onclick=()=>{ x.hint(); say(item.t, true); };
    const m=$('#gmic'); if (m) m.onclick=async()=>{ m.textContent=T('Listening…'); try{ const a=await Speech.listen(PACK.learn); end(a.some(s=>sim(s,item.t)>=0.72)); }catch(e){ m.textContent='🎤 '+T('Say it'); } };
  }, {scene:'cafe'}); }
// 2. Lost in the City: a little map, 5 corners to the hotel
function lost(lvl){ const c=cities()[lvl], all=phrases(), nOpt=Math.min(4, 3+(lvl>1));
  run('lost', lvl, (el, item, x) => { const i=x.st.i;
    const opts=shuffle([item, ...uniqM(shuffle(all.filter(p=>p.m&&p.m!==item.m))).slice(0,nOpt-1)]);
    const pts=[[30,170],[90,170],[90,110],[160,110],[160,50],[230,50]];
    el.innerHTML = `<div class="g-map" style="--city:${c.col}"><svg viewBox="0 0 260 200"><rect width="260" height="200" rx="14" fill="#F6D6C2"/>
      ${[0,1,2].map(k=>`<rect x="${10+k*85}" y="10" width="60" height="28" rx="4" fill="#EBC3A8"/><rect x="${10+k*85}" y="130" width="40" height="26" rx="4" fill="#EBC3A8"/>`).join('')}
      <path d="M90 110 L90 40 M160 110 L220 160" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".7"/><text x="200" y="185" font-size="9" fill="#9C4A2F">✗</text>
      <polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="${pts.slice(0,i+1).map(p=>p.join(',')).join(' ')}" fill="none" stroke="var(--city)" stroke-width="5" stroke-dasharray="2 7" stroke-linecap="round"/>
      <text x="${pts[5][0]-14}" y="${pts[5][1]-12}" font-size="26">🏨</text><text id="me" x="${pts[i][0]-11}" y="${pts[i][1]+9}" font-size="22">🚶</text></svg>
      <div class="g-hotel">🏨 ${esc(c.hotel)} · ${c.f} ${esc(cname(c))}</div></div>
     <div class="card g-q"><div class="g-who">${BUDDIES[(lvl+2)%6]} <small>${BUDDY_NAMES[(lvl+2)%6]} ${T('is a practice character, not a real person.')}</small></div>
      <div class="es">${esc(item.t)} ${hear(item.t)} <button class="g-hear" data-say="${esc(item.t)}" data-slow="1" aria-label="${esc(T('Hear it slowly'))}">🐢</button></div><div class="muted">${T('What did they say?')}</div></div>
     <div class="g-opts">${opts.map((o,k)=>`<button class="g-opt" data-k="${k}">${esc(o.m)}</button>`).join('')}</div>`;
    say(item.t);
    el.querySelectorAll('.g-opt').forEach(bt=>bt.onclick=()=>{ const ok=opts[+bt.dataset.k]===item; el.querySelectorAll('.g-opt').forEach(z=>{ z.disabled=true; if(opts[+z.dataset.k]===item) z.classList.add('right'); }); bt.classList.add(ok?'right':'wrong');
      const me=el.querySelector('#me'); if (ok){ me.setAttribute('x',pts[i+1][0]-11); me.setAttribute('y',pts[i+1][1]+9); } else { me.setAttribute('x',200); me.setAttribute('y',170); }
      feedback(el, ok, item, ok?'':'Wrong street! Back you go.'); if (ok && i===4) el.insertAdjacentHTML('beforeend',`<div class="g-fb ok">🏨 ${T('You found the hotel!')}</div>`); x.next(ok); });
  }, {scene:'directions'}); }
// 3. Say It Right: karaoke, scored with the app's pronunciation check (Pron.score)
function sayIt(lvl){ const s=S.get();
  run('say', lvl, (el, item, x) => { const key='say:'+norm(item.t), best=s.best[key]||0, ws=words(item.t);
    el.innerHTML = `<div class="g-stage"><div class="g-lights">✨🎤✨</div><div class="muted">${T('Tap the mic and say:')}</div>
      <div class="g-kara" id="kara">${ws.map((w,k)=>`<span data-k="${k}">${esc(w)}</span>`).join(PACK.compact?'':' ')}</div><small>${esc(item.m)} ${hearMine(item.m)}</small>
      ${item.s?`<div class="say" id="sound" hidden>${esc(item.s)}</div>`:''}<div class="g-best">${T('best')}: ${best}%</div></div>
     <div class="row g-tools"><button class="alt" id="play">🔊 ${T('Hear')}</button><button class="alt" id="ghint">💡 ${T('Hint')}</button></div>
     ${Speech.canListen()?`<button class="g-mic" id="gmic">🎤</button>`:`<p class="muted">${T('Speaking check is not on this browser. Listen, say it, then tap I said it.')}</p><button class="big g-main" id="said">${T('I said it')}</button>`}`;
    const kara=()=>{ const sp=[...el.querySelectorAll('#kara span')]; sp.forEach((z,k)=>setTimeout(()=>{ sp.forEach(q=>q.classList.remove('on')); z.classList.add('on'); }, k*380)); };
    $('#play').onclick=()=>{ say(item.t); kara(); }; $('#ghint').onclick=()=>{ x.hint(); const so=$('#sound'); if(so) so.hidden=false; say(item.t,true); };
    const result=(pct, r)=>{ s.best[key]=Math.max(best,pct); S.set(Object.assign(S.get(),{best:Object.assign(S.get().best,{[key]:s.best[key]})}));
      el.insertAdjacentHTML('beforeend', `<div class="g-score ${pct>=70?'ok':''}"><b>${pct}%</b> ${T('score')} · ${T('best')} ${s.best[key]}%${r?Pron.html(r):''}</div>`); x.next(pct>=70); };
    const m=$('#gmic'); if (m) m.onclick=async()=>{ m.classList.add('on'); kara(); try{ const a=await Speech.listen(PACK.learn); const r=Pron.score(a,item.t); result(r.pct, r); }catch(e){ result(0); } };
    const sd=$('#said'); if (sd) sd.onclick=()=>{ sd.disabled=true; result(70); };
    window.__sayAnswer = heard => { const r=Pron.score(heard,item.t); result(r.pct, r); }; // test hook
  }); }
// 4. Fix the Message: a jumbled text from a practice friend, timer "sends" it
function fix(lvl){ const sec=Math.max(15, 32-3*lvl);
  run('fix', lvl, (el, item, x) => {
    el.innerHTML = `<div class="g-phone"><div class="g-phead">${BUDDIES[(lvl+4)%6]} ${BUDDY_NAMES[(lvl+4)%6]} <small>${T('Your friend (practice character)')}</small></div>
      <div class="g-bub them">${esc(item.m)} ${hearMine(item.m)}</div><div class="g-bub me g-ans"></div><div class="g-send">${T('Sending in')} <span id="secs">${sec}</span>s</div><div class="g-timer"><i id="tbar"></i></div></div>
     <div class="g-tiles"></div><div class="row g-tools"><button class="alt g-undo">↩ ${T('Undo')}</button><button class="alt" id="ghint">💡 ${T('Hint')}</button></div>`;
    let over=false; const end=ok=>{ if(over) return; over=true; clearT(); el.querySelectorAll('button').forEach(z=>z.disabled=true); feedback(el, ok, item, ok?'':'Time is up'); x.next(ok); };
    tiles(el, item, end); const t0=Date.now(); timers.push(setInterval(()=>{ const s=$('#secs'); if(s) s.textContent=Math.max(0,Math.ceil(sec-(Date.now()-t0)/1000)); },250));
    countdown(sec, $('#tbar'), ()=>end(false)); $('#ghint').onclick=()=>{ x.hint(); say(item.t,true); };
  }); }
// 6. Quick Ear (also used by the two-player race)
function earRound(el, item, x, nOpt=4){ const all=phrases(); const opts=shuffle([item, ...uniqM(shuffle(all.filter(p=>p.m&&p.m!==item.m))).slice(0,nOpt-1)]);
  el.innerHTML = `<div class="g-ear"><button class="g-bigplay g-qhear" data-say="${esc(item.t)}" aria-label="${esc(T('Hear it'))}">🔊</button><button class="alt g-slow" id="slow">🐢 ${T('Slow')}</button><div class="muted">${T('What did they say?')}</div></div>
   <div class="g-opts">${opts.map((o,k)=>`<button class="g-opt" data-k="${k}">${esc(o.m)}</button>`).join('')}</div>`;
  setTimeout(()=>say(item.t),200); el.querySelector('#slow').onclick=()=>{ x.hint(); say(item.t,true); };
  el.querySelectorAll('.g-opt').forEach(bt=>bt.onclick=()=>{ const ok=opts[+bt.dataset.k]===item; el.querySelectorAll('.g-opt').forEach(z=>{ z.disabled=true; if(opts[+z.dataset.k]===item) z.classList.add('right'); }); bt.classList.add(ok?'right':'wrong'); feedback(el, ok, item); x.next(ok); }); }
const ear = lvl => run('ear', lvl, (el,item,x)=>earRound(el,item,x, Math.min(5,3+lvl)));
// 7. Two-Player Challenge: same phrases for both. Pass-and-play on one phone, or a challenge code so two phones get the same phrases.
// ONLINE HOOK: when RoomServer.mode==='server' and a live game channel exists, Games.duelOnline(code) can send scores with
// RoomServer.send(code, memberId, JSON.stringify({game:'duel', score}), lang, 0, 'game') and read them in RoomServer.subscribe. Not wired yet.
function duel(){ runId++; const cs=cities();
  app.innerHTML = head(GAMES[5], cs[0], 0).replace(/<small>.*?<\/small>/,'')+`<div class="card"><b>${T('Pick a city')}</b><div class="g-cities">${cs.map((c,i)=>`<button class="g-city ${i?'':'sel'}" data-i="${i}">${c.f} ${esc(cname(c))}</button>`).join('')}</div></div>
   <button class="big g-main" id="pp">👥 ${T('Pass and play (same phone)')}</button>
   <div class="card"><b>🔑 ${T('Challenge code (two phones)')}</b><p class="muted">${T('Both phones type the same code to get the same phrases. Then compare points.')}</p>
    <div class="row"><input id="dcode" maxlength="6" placeholder="${T('Code')}" autocapitalize="characters"><button class="alt" id="mk">${T('Make a code')}</button><button id="dgo">${T('Start')}</button></div></div>
   <p class="muted small">🌐 ${T('Live online race is coming soon.')}</p>`;
  let ci=0; app.querySelectorAll('.g-city').forEach(b=>b.onclick=()=>{ ci=+b.dataset.i; app.querySelectorAll('.g-city').forEach(z=>z.classList.toggle('sel',z===b)); });
  $('#mk').onclick=()=>{ $('#dcode').value=Array.from({length:5},()=>'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random()*31)]).join(''); };
  const items=seed=>{ R=rng(seed+':'+PACK.learn+':'+ci); const it=pick(null, ci, 5, true); R=Math.random; return it; };
  $('#dgo').onclick=()=>{ const code=($('#dcode').value||'').toUpperCase().trim(); if(code.length<4) return toast(T('Code')+'?'); R=rng(code+ci); const it=items(code); run('duel', ci, (el,item,x)=>{ R=rng(code+item.t); earRound(el,item,x); R=Math.random; }, {items:it}); };
  $('#pp').onclick=()=>{ const seed=String(Date.now()), it=items(seed), res=[];
    const turn=p=>{ app.innerHTML=`<div class="lc"><div class="lc-badge">${p?'🟠':'🟤'}</div><h2>${p?T('Pass the phone to')+' '+T('Player')+' 2':T('Player')+' 1: '+T('Your turn')}</h2><button class="big g-main" id="go">${T('Start')}</button></div>`;
      $('#go').onclick=()=>run('duel', ci, (el,item,x)=>{ R=rng(seed+item.t); earRound(el,item,x); R=Math.random; }, {items:it, onEnd:(g,l,st)=>{ res.push(st); if(p===0) turn(1); else result(); }}); };
    const result=()=>{ const a=scoreOf(res[0]).total, b=scoreOf(res[1]).total, w=a===b?-1:(a>b?0:1), bonus=50;
      const s=S.get(); s.best.duel=Math.max(s.best.duel||0,a,b); if(!s.stamps[cs[ci].n] && (res[0].ok>=3||res[1].ok>=3)) s.stamps[cs[ci].n]=Date.now(); S.set(s);
      S.add(a+b+(w>=0?bonus:0)); cheer();
      app.innerHTML=`<div class="lc"><div class="lc-badge">🏁</div><h2>${w<0?T('It is a tie!'):T('Player')+' '+(w+1)+' '+T('wins!')}</h2><p class="muted">${cs[ci].f} ${esc(cname(cs[ci]))}</p>
       <div class="card lc-list"><div class="lc-row"><span>${T('Player')} 1 (${res[0].ok}/5)</span><b>+${a+(w===0?bonus:0)}</b></div><div class="lc-row"><span>${T('Player')} 2 (${res[1].ok}/5)</span><b>+${b+(w===1?bonus:0)}</b></div>${w>=0?`<div class="lc-row"><span>${T('Winner bonus')}</span><b>+${bonus}</b></div>`:''}</div>
       <div class="lc-total">⭐ ${T('Total points')}: <b>${S.total()}</b></div><div class="row"><button class="alt" onclick="Games.replay('duel',0)">${T('Play again')}</button><button class="alt" onclick="location.hash='games'">${T('Back to games')}</button></div></div>`; };
    turn(0); };
}
// 5. Passport Stamps: one stamp per city, no streaks
function passport(){ const s=S.get(), cs=cities(), n=cs.filter(c=>s.stamps[c.n]).length;
  app.innerHTML = head(GAMES[6], cs[0], 0).replace(/<small>.*?<\/small>/,'')+`<div class="g-passport"><div class="g-pcover">🛂 ${esc(langName(PACK.learn))} · ${n}/${cs.length} ${T('stamps')}</div>
   <div class="g-stamps">${cs.map((c,i)=>{ const on=s.stamps[c.n]; return `<div class="g-stamp ${on?'on':''}" style="--city:${c.col};--rot:${(i%3-1)*7}deg"><div class="g-sflag">${c.f}</div><b>${esc(cname(c))}</b><small>${on?new Date(on).toLocaleDateString(UI_LANG()):T('Not yet')}</small><div class="g-sicons">${c.food.e} 🛍️ ${c.sea?'🏖️':'🏛️'} ✈️ 🏨</div></div>`; }).join('')}</div>
   <p class="muted">💛 ${T('No streaks here. Play any day, any city.')}</p></div>`; }
// ---------- hub ----------
function hub(){ clearT(); runId++; const s=S.get(), cs=cities();
  app.innerHTML = `<div class="g-hubtop"><h2>🎮 ${T('Trip games')}</h2><div class="g-total">⭐ <b>${S.total()}</b> ${T('points')}</div></div>
   <p class="muted small">${T('Characters are practice buddies, not real people.')} ${T('Points are saved on this phone only.')}</p>
   ${GAMES.map(g=>{ const lv = g.id==='passport'||g.id==='duel' ? '' : `<div class="g-levels">${cs.map((c,i)=>{ const u=unlocked(g.id,i), d=(s.done[g.id]||{})[i];
        return `<button class="g-lv ${d?'done':''}" ${u?'':'disabled'} data-g="${g.id}" data-l="${i}" title="${esc(cname(c))}">${u?c.f:'🔒'}<small>${esc(cname(c))}</small></button>`; }).join('')}</div>`;
      return `<div class="card g-card" data-open="${g.id}"><div class="g-ic">${g.icon}</div><div class="g-txt"><b>${T(g.name)}</b><small>${T(g.d)}</small>${s.best[g.id]?`<span class="g-bestb">${T('Best')}: ${s.best[g.id]}</span>`:''}</div>${lv?'':`<button class="g-playbtn" data-g="${g.id}">${T('Play game')}</button>`}${lv}</div>`; }).join('')}`;
  app.querySelectorAll('.g-lv,.g-playbtn').forEach(b=>b.onclick=()=>location.hash='games/'+b.dataset.g+(b.dataset.l?'/'+b.dataset.l:''));
}
const PLAY = {order, lost, say:sayIt, fix, ear};
window.Games = {
  route(h){ clearT(); runId++; const [,g,l]=h.split('/'); if (!PACK) return; if (!g) return hub(); if (g==='passport') return passport(); if (g==='duel') return duel();
    const lvl=Math.min(+l||0, cities().length-1); if (!PLAY[g]) return hub(); if (!unlocked(g,lvl)) return hub(); PLAY[g](lvl); },
  replay(g,l){ if (g==='duel') return duel(); this.route('games/'+g+'/'+l); },
  // Small Games card at the top of the Practice screen
  card(){ if (!PACK || !app) return; const s=S.get(), n=cities().filter(c=>s.stamps[c.n]).length;
    app.insertAdjacentHTML('afterbegin', `<button class="g-entry" onclick="location.hash='games'"><span class="g-eic">🎮</span><span><b>${T('Trip games')}</b><small>${cities().slice(0,3).map(c=>c.f+' '+esc(cname(c))).join(' · ')}</small></span><span class="g-epts">⭐ ${S.total()}<small>${n} 🛂</small></span></button>`); },
  _state:S, cities, _seen:SEEN, _pick:pick,
};
})();
