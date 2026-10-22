const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = { get(k,d){ try{return JSON.parse(localStorage.getItem('tt_'+k)) ?? d;}catch(e){return d;} }, set(k,v){ localStorage.setItem('tt_'+k, JSON.stringify(v)); } };
let INDEX=null, PACK=null;
const settings = () => store.get('settings', {speak:'en', learn:'es'});
function toast(t){ const d=document.createElement('div'); d.className='toast'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2200); }

// ---------- matching ----------
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ\s]/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){ const m=a.length,n=b.length; if(!m)return n; if(!n)return m; let p=[...Array(n+1).keys()];
  for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
// Word-level check: every expected word must be said. Short words (<=4 letters) exact, longer ones max 1 letter off.
// "*" = any word(s) here (at least one), e.g. a name or a city. A few extra words are fine.
const wordOk = (exp, got) => exp.length<=4 ? exp===got : lev(exp,got)<=1;
function sim(said, pattern){
  const s = norm(said).split(' ').filter(Boolean), wild = pattern.includes('*');
  const exp = norm(pattern.replace(/\*/g,' ')).split(' ').filter(Boolean);
  if (!exp.length) return s.length?1:0;
  const used = new Set(); let hit = 0, pos = -1, inOrder = true;
  for (const e of exp){ const i = s.findIndex((g,k)=>!used.has(k) && wordOk(e,g)); if (i<0) continue; used.add(i); hit++; if(i<pos) inOrder=false; pos=i; }
  const extra = s.length - used.size;
  if (hit===exp.length && inOrder && (wild ? extra>=1 && extra<=4 : extra<=2)) return 1;
  return 0.7 * hit/exp.length; // partial credit only for choosing the best hint
}
function bestMatch(alts, replies){
  let best={score:0};
  for (const said of alts) for (const r of replies) for (const a of [r.t, ...(r.accept||[])]) {
    const sc = sim(said, a); if (sc>best.score) best={score:sc, reply:r, said};
  }
  return best;
}

// ---------- cards (simple spaced review) ----------
const GAPS=[0, 1, 3, 7, 14, 30]; // days per box
const DAY=864e5;
function cards(){ return store.get('cards', {}); }
function addCard(t, m, s, src){ const c=cards(); const id=norm(t); if(!id||c[id]) return false; c[id]={t,m,s:s||'',src,box:0,due:Date.now()}; store.set('cards',c); return true; }
function seedCards(scene){ for (const tid in scene.turns){ const tu=scene.turns[tid]; addCard(tu.they.t,tu.they.m,tu.they.s,scene.title); tu.replies.forEach(r=>{ if(!r.s.includes('…')) addCard(r.t,r.m,r.s,scene.title); }); } }
function grade(id, ok){ const c=cards(), k=c[id]; if(!k) return; k.box = ok? Math.min(k.box+1, GAPS.length-1) : 0; k.due = Date.now() + (ok? GAPS[k.box]*DAY : 60e3); store.set('cards',c); }
const dueCards = () => Object.entries(cards()).filter(([,k])=>k.due<=Date.now());

// ---------- screens ----------
async function boot(){
  INDEX = await (await fetch('packs/index.json')).json();
  if (!store.get('settings')) return setup();
  await loadPack(); route();
}
async function loadPack(){ const s=settings(); const p=INDEX.packs.find(p=>p.speak===s.speak&&p.learn===s.learn)||INDEX.packs[0]; PACK = await (await fetch(p.file)).json(); }
function route(){ const h=location.hash.slice(1)||'home'; const [v,a]=h.split('/');
  ({home, scene:()=>scene(a), practice, chat, setup}[v]||home)(); window.scrollTo(0,0); }
window.addEventListener('hashchange', route);
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);
$('#homeBtn').onclick=()=>location.hash='home'; $('#setupBtn').onclick=()=>location.hash='setup';

function setup(){
  const L=INDEX.languages, s=settings();
  const opts = (sel)=>Object.entries(L).map(([k,v])=>`<option value="${k}" ${k===sel?'selected':''}>${v}</option>`).join('');
  app.innerHTML = `<h2>Welcome! 👋</h2><div class="card"><p><b>I speak</b></p><select id="sp">${opts(s.speak)}</select>
   <p><b>I want to learn</b></p><select id="le">${opts(s.learn)}</select>
   <p class="muted">More languages can be added later as new language packs.</p></div>
   <button class="big" id="go">Start my trip ▶</button><p class="muted" id="msg"></p>`;
  $('#go').onclick = async ()=>{ const sp=$('#sp').value, le=$('#le').value;
    if (!INDEX.packs.find(p=>p.speak===sp&&p.learn===le)) { $('#msg').textContent='That pair is coming soon. Right now: English → Spanish.'; return; }
    store.set('settings',{speak:sp,learn:le}); await loadPack(); location.hash='home'; route(); };
}

function home(){
  const done = store.get('done', {}), due=dueCards().length;
  app.innerHTML = `<h2>Your trip map</h2><p class="muted">Tap a stop to have a short talk in Spanish.</p>
   <div class="map">${PACK.scenes.map(sc=>`<button class="stop" data-id="${sc.id}"><span class="ic">${sc.icon}</span><span><b>${esc(sc.stop)}</b><small>${esc(sc.title)}</small></span><span class="done">${done[sc.id]?'⭐':''}</span></button>`).join('')}
   <button class="stop" onclick="location.hash='chat'"><span class="ic">💬</span><span><b>Chat with a friend</b><small>Type or talk, it translates</small></span></button></div>
   <button class="big ${due?'':'alt'}" onclick="location.hash='practice'">🃏 Practice phrases (${due} ready)</button>`;
  app.querySelectorAll('.stop[data-id]').forEach(b=>b.onclick=()=>location.hash='scene/'+b.dataset.id);
}

function scene(id){
  const sc = PACK.scenes.find(s=>s.id===id); if(!sc) return home();
  seedCards(sc);
  let tid = sc.start;
  const show = () => {
    if (tid==='end'){ const d=store.get('done',{}); d[sc.id]=1; store.set('done',d); Speech.ding();
      app.innerHTML=`<h2>${sc.icon} Great talk! ⭐</h2><div class="card">You finished <b>${esc(sc.title)}</b>. The phrases are now in your practice cards.</div>
       <div class="row"><button onclick="location.hash='practice'">🃏 Practice</button><button class="alt" onclick="location.hash='home'">🗺️ Trip map</button></div>`; return; }
    const tu = sc.turns[tid];
    app.innerHTML = `<h2>${sc.icon} ${esc(sc.title)}</h2>
     <div class="card"><div class="muted">They say:</div><div class="es">${esc(tu.they.t)}</div><div class="en">${esc(tu.they.m)}</div><div class="say">🔊 ${esc(tu.they.s)}</div>
      <div class="row"><button id="play">🔊 Play</button><button class="alt" id="slow">🐢 Slow</button></div></div>
     <div id="fb"></div>
     ${Speech.canListen()?`<button class="mic" id="mic">🎤 Tap and answer out loud</button><p class="muted" style="text-align:center">or tap an answer:</p>`:`<p class="muted">Tap an answer (and say it out loud too!):</p>`}
     <div id="replies">${tu.replies.map((r,i)=>`<button class="reply" data-i="${i}"><b>${esc(r.t)}</b><span class="en">${esc(r.m)}</span><br><span class="say">${esc(r.s)}</span></button>`).join('')}</div>`;
    $('#play').onclick=()=>Speech.say(tu.they.t,'es'); $('#slow').onclick=()=>Speech.say(tu.they.t,'es',true);
    setTimeout(()=>Speech.say(tu.they.t,'es'),300);
    const answer = (alts, tapped) => {
      const m = tapped ? {score:1, reply:tapped, said:tapped.t} : bestMatch(alts, tu.replies);
      const fb=$('#fb');
      if (m.score >= 0.72){ Speech.ding();
        const shown = (!tapped && m.reply.t.includes('(')) ? m.said : m.reply.t;
        fb.innerHTML=`<div class="fb good">✅ Nice, I understood you! <br><b>${esc(shown)}</b> ${shown===m.reply.t?`<span class="en">— ${esc(m.reply.m)}</span>`:""}</div><button class="big ok" id="next">Next ▶</button>`;
        if (tapped && !m.reply.t.includes('(')) Speech.say(m.reply.t,'es');
        $('#next').onclick=()=>{ tid=m.reply.next; show(); };
      } else {
        fb.innerHTML=`<div class="fb try">🙂 Almost! ${alts[0]?`I heard “${esc(alts[0])}”.`:'I didn\'t catch that.'}<br>💡 ${esc(tu.hint)}</div>`;
      }
    };
    app.querySelectorAll('.reply').forEach(b=>b.onclick=()=>answer([], tu.replies[b.dataset.i]));
    const mic=$('#mic'); if(mic) mic.onclick=async()=>{ mic.classList.add('on'); mic.textContent='🎤 Listening…';
      try{ const alts=await Speech.listen('es'); answer(alts); }catch(e){ $('#fb').innerHTML=`<div class="fb try">The mic didn't work (${esc(e.message)}). You can tap an answer instead.</div>`; }
      mic.classList.remove('on'); mic.textContent='🎤 Tap and answer out loud'; };
    window.__answer = answer; // test hook
  };
  show();
}

function practice(){
  const due = dueCards(), total=Object.keys(cards()).length;
  if (!due.length){ app.innerHTML=`<h2>🃏 Practice</h2><div class="card">${total?`All done for now! 🎉 ${total} phrases saved. Come back later.`:'No phrases yet. Do a stop on the trip map first.'}</div><button class="big" onclick="location.hash='home'">🗺️ Trip map</button>`; return; }
  const [id,k]=due[0];
  app.innerHTML = `<h2>🃏 Practice <span class="muted">(${due.length} ready)</span></h2>
   <div class="card"><div class="muted">How do you say:</div><div class="es" style="color:#1b2533">${esc(k.m)} <button class="ghost" id="hearQ" aria-label="Hear">🔊</button></div>
   <div id="ans" hidden><hr><div class="es">${esc(k.t)} <button class="ghost" id="hearA" aria-label="Hear">🔊</button></div><div class="say">🔊 ${esc(k.s)}</div></div></div>
   <div id="pfb"></div>
   ${Speech.canListen()?`<button class="mic" id="pmic">🎤 Say it in Spanish</button>`:''}
   <div class="row"><button class="alt" id="show">👀 Show answer</button></div>
   <div class="row" id="gr" hidden><button class="alt" id="again">🔁 Again</button><button class="ok" id="got">✅ Got it</button></div>
   <p class="muted">From: ${esc(k.src||'')} · level ${k.box+1}/6</p>`;
  const reveal=()=>{ $('#ans').hidden=false; $('#gr').hidden=false; $('#show').parentNode.hidden=true; Speech.say(k.t,'es'); };
  $('#show').onclick=reveal; $('#hearQ').onclick=()=>Speech.say(k.m,'en'); $('#hearA').onclick=()=>Speech.say(k.t,'es');
  $('#again').onclick=()=>{ grade(id,false); practice(); };
  $('#got').onclick=()=>{ Speech.ding(); grade(id,true); practice(); };
  const pm=$('#pmic'); if(pm) pm.onclick=async()=>{ try{ const a=await Speech.listen('es'); const ok=a.some(x=>sim(x,k.t)>=0.72);
     $('#pfb').innerHTML=`<div class="fb ${ok?'good':'try'}">${ok?'✅ Sounds right!':'🙂 Close, listen and try again.'} ${a[0]?`(I heard “${esc(a[0])}”)`:''}</div>`; if(ok) Speech.ding(); reveal(); }catch(e){ reveal(); } };
}

// ---------- translate chat (local two-pane demo) ----------
function chat(){
  const L=INDEX.languages; const st=store.get('chat',{a:'en',b:'es'});
  const opts=sel=>Object.keys(L).map(k=>`<option value="${k}" ${k===sel?'selected':''}>${L[k]}</option>`).join('');
  const pane=(who,name)=>`<div class="pane" id="p${who}"><h3>${name} <select data-who="${who}">${opts(st[who])}</select></h3>
    <div class="msgs"></div><div class="compose"><input placeholder="Type a message…" enterkeyhint="send">${Speech.canListen()?'<button class="alt mic-btn" aria-label="Talk">🎤</button>':''}<button class="send">Send</button></div></div>`;
  app.innerHTML = `<h2>💬 Chat with a friend</h2><p class="muted">Each person reads in their own language. Demo: both people on this screen.</p><p class="muted">🔒 Privacy: if your browser can't translate by itself, messages are sent to the free MyMemory service to be translated. Don't type private info.</p>${pane('a','Me')}${pane('b','Friend')}`;
  const T = new LocalTransport('demo');
  app.querySelectorAll('select').forEach(s=>s.onchange=()=>{ st[s.dataset.who]=s.value; store.set('chat',st); });
  const render = async (msg, who) => {
    const my = st[who], box=$('#p'+who+' .msgs'), b=document.createElement('div');
    b.className='bubble'+(msg.from===who?' me':''); box.appendChild(b);
    const draw=(tr,lang,err)=>{ b.innerHTML = `<div class="tr">${esc(tr)}</div>${tr!==msg.text?`<div class="orig">${L[msg.lang]}: ${esc(msg.text)}</div>`:''}${err?`<div class="orig">⚠️ ${esc(err)}</div>`:''}
      <div class="acts"><button class="alt hear">🔊 Hear</button>${msg.lang!==my||tr!==msg.text?'<button class="alt save">⭐ Save phrase</button>':''}</div>`;
      b.querySelector('.hear').onclick=()=>Speech.say(tr,lang);
      const sv=b.querySelector('.save'); if(sv) sv.onclick=()=>{ const es = msg.lang==='es'?msg.text:(lang==='es'?tr:null), en = msg.lang==='en'?msg.text:(lang==='en'?tr:null);
        toast(addCard(es||msg.text, en||tr, '', 'Chat')?'Saved to practice ⭐':'Already saved'); };
      box.scrollTop=box.scrollHeight; };
    if (msg.from===who || msg.lang===my) return draw(msg.text, msg.lang);
    b.innerHTML='<div class="muted">Translating…</div>';
    try{ const r = await Translate.run(msg.text, msg.lang, my); msg[my]=r.text; draw(r.text, my); }
    catch(e){ draw(msg.text, msg.lang, 'Translation is busy right now. Please try again later.'); }
  };
  T.onMessage(m=>{ render(m,'a'); render(m,'b'); });
  ['a','b'].forEach(who=>{ const p=$('#p'+who), inp=p.querySelector('input');
    const send=()=>{ const t=inp.value.trim(); if(!t) return; inp.value=''; T.send({from:who, lang:st[who], text:t}); };
    p.querySelector('.send').onclick=send; inp.onkeydown=e=>{ if(e.key==='Enter') send(); };
    const mb=p.querySelector('.mic-btn'); if(mb) mb.onclick=async()=>{ try{ const a=await Speech.listen(st[who]); if(a[0]) inp.value=a[0]; }catch(e){ toast('Mic not available, please type.'); } };
  });
}
boot();
