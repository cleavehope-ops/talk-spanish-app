if (location.protocol==='http:' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) location.replace('https:'+location.href.slice(5)); // HTTPS only
const $ = s => document.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const store = { get(k,d){ try{return JSON.parse(localStorage.getItem('tt_'+k)) ?? d;}catch(e){return d;} }, set(k,v){ localStorage.setItem('tt_'+k, JSON.stringify(v)); } };
let INDEX=null, PACK=null;
const settings = () => store.get('settings', {speak:'en', learn:'es'});
function toast(t){ const d=document.createElement('div'); d.className='toast'; d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.remove(),2200); }

// ---------- matching ----------
const norm = s => String(s).toLowerCase().replace(/ß/g,'ss').normalize('NFD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
const CJK_RE = /[\u0e00-\u0e7f\u1000-\u109f\u1780-\u17ff\u3040-\u30ff\u3400-\u9fff]/;
function lev(a,b){ const m=a.length,n=b.length; if(!m)return n; if(!n)return m; let p=[...Array(n+1).keys()];
  for(let i=1;i<=m;i++){ const c=[i]; for(let j=1;j<=n;j++) c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c; } return p[n]; }
// Word-level check: every expected word must be said. Short words (<=4 letters) exact, longer ones max 1 letter off.
// "*" = any word(s) here (at least one), e.g. a name or a city. A few extra words are fine.
const wordOk = (exp, got) => exp.length<=4 ? exp===got : lev(exp,got)<=1;
// Compact check for languages written without spaces (Chinese, Japanese, Thai…), also used for pinyin/romaji in those packs.
function simCompact(said, pattern){
  const s = norm(said).replace(/\s/g,'');
  if (pattern.includes('*')) {
    const parts = pattern.split('*').map(x=>norm(x).replace(/\s/g,'').replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
    const m = s.match(new RegExp('^(?:.{0,2})' + parts.join('(.+)') + '$'));
    if (m && m.slice(1).join('').length <= 10 && !m.slice(1).some(g=>/(て|で)す|ます|ません|ない|わから|知ら|wakara|shira|masen/.test(g))) return 0.99 - 0.01*Math.max(0, s.length - m[0].length); // name/city: 1-10 letters // exact answers beat wildcard ones
    const lit = parts.join('').replace(/\\/g,''); return lit && s.includes(lit) ? 0.6 : 0.2;
  }
  const p = norm(pattern).replace(/\s/g,''); if (!p) return 0;
  if (s===p) return 1;
  const r = 1 - lev(s,p)/Math.max(s.length,p.length);
  if (s.includes(p) && s.length-p.length<=3) return Math.max(r, 0.8);
  return r>=0.8 ? r : r*0.85;
}
const isCompact = pattern => (typeof PACK!=='undefined' && PACK && PACK.compact) || CJK_RE.test(pattern);
function sim(said, pattern){
  if (isCompact(pattern)) return simCompact(said, pattern);
  const s = norm(said).split(' ').filter(Boolean), wild = pattern.includes('*');
  const exp = norm(pattern.replace(/\*/g,' ')).split(' ').filter(Boolean);
  if (!exp.length) return s.length?1:0;
  const used = new Set(); let hit = 0, pos = -1, inOrder = true;
  for (const e of exp){ const i = s.findIndex((g,k)=>!used.has(k) && wordOk(e,g)); if (i<0) continue; used.add(i); hit++; if(i<pos) inOrder=false; pos=i; }
  const extra = s.length - used.size;
  if (hit===exp.length && inOrder && (wild ? extra>=1 && extra<=4 : extra<=2)) return wild ? 0.99 : 1 - 0.01*extra;
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
const LK = () => (PACK ? PACK.learn : 'es');
function cards(){ return store.get('cards_'+LK(), LK()==='es' ? store.get('cards',{}) : {}); }
function addCard(t, m, s, src){ const c=cards(); const id=norm(t); if(!id||c[id]) return false; c[id]={t,m,s:s||'',src,box:0,due:Date.now()}; store.set('cards_'+LK(),c); return true; }
function seedCards(scene){ for (const tid in scene.turns){ const tu=scene.turns[tid]; addCard(tu.they.t,tu.they.m,tu.they.s,scene.title); tu.replies.forEach(r=>{ if(!r.t.includes('(')) addCard(r.t,r.m,r.s,scene.title); }); } }
function grade(id, ok){ const c=cards(), k=c[id]; if(!k) return; k.box = ok? Math.min(k.box+1, GAPS.length-1) : 0; k.due = Date.now() + (ok? GAPS[k.box]*DAY : 60e3); store.set('cards_'+LK(),c); }
const dueCards = () => Object.entries(cards()).filter(([,k])=>k.due<=Date.now());

// ---------- screens ----------
async function boot(){
  INDEX = await (await fetch('packs/index.json')).json();
  if (!store.get('settings')) return setup();
  await loadPack(); route();
}
const userPacks = () => store.get('userpacks', {});
function packKind(sp, le){ if (INDEX.packs.find(p=>p.speak===sp&&p.learn===le)) return 'hand'; if (userPacks()[sp+'-'+le]) return 'file'; return sp==='en' && le!=='en' ? 'auto' : null; }
async function loadPack(){
  const s=settings(), kind=packKind(s.speak,s.learn);
  if (kind==='hand') PACK = await (await fetch(INDEX.packs.find(p=>p.speak===s.speak&&p.learn===s.learn).file)).json();
  else if (kind==='file') PACK = userPacks()[s.speak+'-'+s.learn];
  else if (kind==='auto') PACK = store.get('autopack_'+s.learn) || await buildAutoPack(s.learn);
  else PACK = await (await fetch(INDEX.packs[0].file)).json();
  if (!PACK.name) PACK.name = langName(PACK.learn);
  if (PACK.compact===undefined && COMPACT_LANGS.has(PACK.learn)) PACK.compact = true;
  Speech.override = {}; if (PACK.voice) Speech.override[PACK.learn] = PACK.voice;
}
// "My name is Anna." -> "Jina langu ni (your name)." and accepts "Jina langu ni *"
function wildReply(tr, r){ const re = new RegExp(r.token, 'i'), clean = x => x.replace(/[.!?。！？]+$/,'').trim();
  const t = re.test(tr) ? tr.replace(re, r.wild) : clean(tr)+' '+r.wild;
  const acc = re.test(tr) ? clean(tr.replace(re, '*')) : clean(tr)+' *';
  return {t, m:r.en.replace(r.token, r.wild), s:'', accept:[acc], next:r.next}; }
// Build scenes on the fly by translating the English lines with the free translator. Cached on this device.
async function buildAutoPack(code){
  const base = await (await fetch('packs/base-en.json')).json();
  const jobs = [];
  base.scenes.forEach(sc=>Object.values(sc.turns).forEach(tu=>{ jobs.push(tu.they); tu.replies.forEach(r=>jobs.push(r)); }));
  const src = j => typeof j==='string' ? j : j.en;
  const texts = [...new Set(jobs.map(j=>typeof j==='string'?j:j.en))], out = {};
  let done = 0; const prog = () => { const el=document.getElementById('autoprog'); if (el) el.textContent = `Translating the scenes… ${done}/${texts.length}`; };
  app.innerHTML = `<h2>${I('globe')} Getting ${esc(langName(code))} ready</h2><div class="card" id="autoprog">Translating the scenes…</div><p class="muted">This happens once, then it's saved on this device.</p>`;
  let i = 0; const worker = async () => { while (i < texts.length) { const t = texts[i++]; out[t] = (await Translate.run(t, 'en', code, {scope:'packs'})).text; done++; prog(); } };
  await Promise.all([worker(), worker(), worker()]);
  const pack = { id:'auto-en-'+code, speak:'en', learn:code, name:langName(code), auto:true, voice:(LANGS[code]||[0,[code]])[1], compact:COMPACT_LANGS.has(code), scenes:[] };
  for (const sc of base.scenes){ const T={};
    for (const [tid,tu] of Object.entries(sc.turns)) T[tid] = { they:{t:out[tu.they], m:tu.they, s:''},
      replies: tu.replies.map(r => r.wild ? wildReply(out[r.en], r)
                                           : {t:out[r.en], m:r.en, s:'', accept:[], next:r.next}) };
    pack.scenes.push({id:sc.id, title:sc.title, stop:sc.stop, icon:sc.icon, start:sc.start, turns:T}); }
  store.set('autopack_'+code, pack); return pack;
}
// One live channel per open chat; closed when you leave that chat.
function roomUnsubscribe(){ const s=window.__roomSub; window.__roomSub=null; window.__roomCtx=null; if (s && s.unsub) { try{ s.unsub(); }catch(e){} } }
function route(){ window.__uiLang=null; window.__openSheet=null; window.__pendingRender=false; { const s=window.__roomSub, h=location.hash.slice(1); if (s && h!=='chat/'+s.code) roomUnsubscribe(); } applyNavI18n(); document.querySelectorAll('.confetti').forEach(c=>c.remove()); document.body.classList.remove('chatmode'); const v0=(location.hash.slice(1)||'home').split('/')[0]; document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active', b.dataset.go===v0 || (b.dataset.go==='chat'&&v0==='join')||(b.dataset.go==='me'&&(v0==='privacy'||v0==='setup'||v0==='terms')))); const h=location.hash.slice(1)||'home'; const [v,a]=h.split('/');
  ({home, scene:()=>scene(a), practice:()=>{ practice(); window.Games&&Games.card(); }, games:()=>window.Games?Games.route(h):home(), chat:()=> a==='new'?chat({}) : a?roomView(a):chat(), join:()=>chat({code:a, invite:h.split('/')[2], key:h.split('/')[3]}), setup, quick, privacy, terms:()=>terms(a), me}[v]||home)(); window.scrollTo(0,0); }
window.addEventListener('hashchange', route);
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>location.hash=b.dataset.go);
$('#homeBtn').innerHTML=I('map'); $('#setupBtn').innerHTML=I('globe'); document.querySelectorAll('nav i[data-i]').forEach(x=>x.outerHTML=I(x.dataset.i));
$('#homeBtn').onclick=()=>location.hash='home'; $('#setupBtn').onclick=()=>location.hash='setup';

function setup(spPick){
  const s0=settings(), s = spPick ? {speak:spPick, learn:(spPick===s0.speak?s0.learn:'')} : s0, up=userPacks();
  const SP = s.speak||'en', ES = SP!=='en', speakers = [...new Set(INDEX.packs.map(p=>p.speak).concat(Object.values(up).map(p=>p.speak)))].filter(k=>k!=='en');
  window.__uiLang = SP; applyNavI18n();
  if (ES && !s.learn) s.learn = (INDEX.packs.find(p=>p.speak===SP)||{}).learn || '';
  const hand = new Set(INDEX.packs.filter(p=>p.speak===SP).map(p=>p.learn)), files = new Set(Object.values(up).map(p=>p.learn));
  const all = ES ? [...hand] : Object.keys(LANGS).filter(k=>k!=='en').concat([...files].filter(k=>!LANGS[k]));
  const nm = k => up['en-'+k]?.name || langName(k);
  const label = k => (up['en-'+k] && up['en-'+k].name) || (NATIVE[k] ? (NATIVE[k]===langName(k) ? NATIVE[k] : `${NATIVE[k]} (${langName(k)})`) : langName(k));
  const group = (lbl, list) => list.length ? `<optgroup label="${lbl}">${list.map(k=>`<option value="${k}" ${k===s.learn?'selected':''}>${esc(label(k))}</option>`).join('')}</optgroup>` : '';
  const handL = all.filter(k=>hand.has(k)), fileL = all.filter(k=>!hand.has(k)&&files.has(k)), autoL = all.filter(k=>!hand.has(k)&&!files.has(k)).sort((a,b)=>langName(a).localeCompare(langName(b)));
  app.innerHTML = `<h2>${tx('Pick a language')}</h2><p class="muted">${tx('I speak')} <select id="sp"><option value="en">English</option>${speakers.map(k=>`<option value="${k}" ${k===SP?'selected':''}>${esc(nativeName(k))}</option>`).join('')}</select> ${tx('and I want to learn:')}</p>
   <div class="tiles">${handL.concat(fileL).map(k=>`<button class="tile ${k===s.learn?'on':''}" data-k="${k}"><span class="flag">${FLAG[k]||I('globe')}</span><b>${esc(nativeName(k))}</b><small>${esc(ES?tx(langName(k)):langName(k))}${files.has(k)&&!hand.has(k)?' · from file':''}</small></button>`).join('')}</div>
   <div class="card" ${ES?'hidden':''}><b>${I('globe')} Any language</b><p class="muted">Pick from the full list. Languages without hand-made lessons are auto-translated.</p>
   <select id="le">${group('Hand-made lessons',handL)}${group('Added from a file',fileL)}${group('Any language (auto-translated)',autoL)}</select>
   <p class="muted" id="kind"></p></div>
   <button class="big" id="go">${tx('Start my trip')} ${I('arrow')}</button><p class="muted" id="msg"></p>
   <div class="card" ${ES?'hidden':''}><b>${I('file')} Add a language file</b><p class="muted">Got a lesson file (.json) for a new language? Add it here. It stays on this device.</p>
   <input type="file" id="packfile" accept=".json,application/json"></div>`;
  app.querySelectorAll('.tile').forEach(t=>t.onclick=()=>{ $('#le').value=t.dataset.k; app.querySelectorAll('.tile').forEach(x=>x.classList.toggle('on',x===t)); showKind(); });
  const showKind = () => { const k = packKind($('#sp').value, $('#le').value);
    $('#kind').textContent = k==='hand' ? tx('Hand-made, checked lessons.') : k==='file' ? 'Lessons from a file you added.' : k==='auto' ? 'Auto-translated, so it may have small mistakes. Needs internet the first time.' : tx('Coming soon.'); };
  $('#le').onchange = ()=>{ app.querySelectorAll('.tile').forEach(x=>x.classList.toggle('on',x.dataset.k===$('#le').value)); showKind(); }; $('#sp').onchange = ()=>setup($('#sp').value); showKind();
  $('#go').onclick = async ()=>{ const sp=$('#sp').value, le=$('#le').value;
    if (!packKind(sp,le)) { $('#msg').textContent=tx('That pair is coming soon.'); return; }
    store.set('settings',{speak:sp,learn:le}); window.__uiLang=null;
    try { await loadPack(); location.hash='home'; route(); }
    catch(e){ console.warn('pack load failed', e); store.set('settings', s0); setup(); $('#msg').textContent = e.message==='offline-off' ? tx('This language needs the online translator once. Turn on "Build lessons online" in Privacy to build it.') : tx('Translation is busy right now. Please try again later.'); }
  };
  $('#packfile').onchange = async e => { const f=e.target.files[0]; if(!f) return;
    try { const p = JSON.parse(await f.text()); const err = checkPack(p); if (err) throw new Error(err);
      p.speak = p.speak || 'en'; const u=userPacks(); u[p.speak+'-'+p.learn]=p; store.set('userpacks',u);
      toast('Added: '+(p.name||langName(p.learn))); setup(); $('#le').value=p.learn; showKind(); }
    catch(err){ $('#msg').textContent = 'That file did not work: '+err.message; } };
}
// A pack needs: learn (language code), scenes[] with id, title, start and turns{ id: {they:{t,m}, replies:[{t,m,next}]} }.
function checkPack(p){
  if (!p || typeof p.learn!=='string' || !Array.isArray(p.scenes) || !p.scenes.length) return 'missing "learn" or "scenes"';
  for (const sc of p.scenes){ if (!sc.id || !sc.title || !sc.turns || !sc.turns[sc.start]) return 'scene "'+(sc.id||'?')+'" is incomplete';
    for (const [tid,tu] of Object.entries(sc.turns)){ if (!tu.they || !tu.they.t || !Array.isArray(tu.replies) || !tu.replies.length) return 'turn '+tid+' is incomplete';
      for (const r of tu.replies){ if (!r.t || !r.next || (r.next!=='end' && !sc.turns[r.next])) return 'a reply in '+tid+' has a bad "next"'; r.m=r.m||''; r.s=r.s||''; r.accept=r.accept||[]; }
      tu.they.m=tu.they.m||''; tu.they.s=tu.they.s||''; sc.stop=sc.stop||sc.title; sc.icon=sc.icon||'💬'; } }
  return null;
}

const banner = () => (PACK.auto ? `<div class="note">${I('info')} Auto-translated: may have small mistakes.</div>` : '') + (PACK.voiceNote ? `<p class="muted">${esc(PACK.voiceNote)}</p>` : '') + (PACK.note ? `<p class="muted">${esc(PACK.note)}</p>` : '');
function allProgress(){ // finished chats across every language you've tried
  let done=0; for (let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if (k.startsWith('tt_done_')) try{ done+=Object.keys(JSON.parse(localStorage.getItem(k))).length; }catch(e){} }
  const langs = new Set(INDEX.packs.filter(p=>p.speak===(settings().speak||'en')).map(p=>p.learn)); langs.add(PACK.learn); return {done, total: langs.size*3}; }
function prefsRow(){ const p=Prefs.get(); return `<div class="prefs"><label><input type="checkbox" id="pSound" ${p.sound?'checked':''}> ${tx('Sounds')}</label><label><input type="checkbox" id="pAnim" ${p.anim?'checked':''}> ${tx('Animations')}</label><label><input type="checkbox" id="pWelcome" ${p.sayWelcome!==false?'checked':''}> ${tx('Say welcome at start')}</label></div>`; }
function soundCard(){ const c=MsgSound.choice(); return `<div class="card sndcard"><b>${tx('New message sound')}</b><p class="muted small">${tx('Plays when someone else sends you a message.')}</p>
  ${Object.entries(MsgSound.LABELS).map(([k,l])=>`<div class="snd"><label><input type="radio" name="msnd" value="${k}" ${k===c?'checked':''}> ${tx(l)}</label>${k!=='off'?`<button class="ghost iconbtn sprev" data-prev="${k}" aria-label="${tx('Preview')} ${tx(l)}">${I('play')}</button>`:''}</div>`).join('')}</div>`; }
function bindSound(){ document.querySelectorAll('input[name=msnd]').forEach(r=>r.onchange=()=>{ MsgSound.setChoice(r.value); if (r.value!=='off') MsgSound.preview(r.value); });
  document.querySelectorAll('[data-prev]').forEach(b=>b.onclick=()=>MsgSound.preview(b.dataset.prev)); }
function bindPrefs(){ bindSound(); const s=$('#pSound'), a=$('#pAnim'); if(s) s.onchange=()=>Prefs.set('sound',s.checked); const w=$('#pWelcome'); if(w) w.onchange=()=>Prefs.set('sayWelcome',w.checked); if(a) a.onchange=()=>{ Prefs.set('anim',a.checked); document.body.classList.toggle('noanim',!a.checked); }; }
function home(){
  const done = store.get('done_'+LK(), {}), due=dueCards().length, pr=allProgress(), st=Streak.view();
  const first = !sessionStorage.getItem('tt_welcomed'); sessionStorage.setItem('tt_welcomed','1');
  const next = PACK.scenes.find(sc=>!done[sc.id]) || PACK.scenes[0];
  app.innerHTML = `<div class="greet ${first&&Prefs.get().anim?'wave':''}"><div><small>${tx('Learning')}</small><div class="hello">${FLAG[PACK.learn]||''} ${esc(nativeName(PACK.learn))}</div></div><button class="chip" onclick="location.hash='setup'">${tx('Change')}</button></div>
   <section class="focus"><div class="muted">${tx('Today')}</div><div class="ftitle">${tx('Say 1 phrase out loud')}</div><div class="muted">${tx('Takes about 30 seconds.')}</div>
     <button class="say1" id="say1">${I('mic')} ${tx('Start')}</button></section>
   <section class="card wbox"><b>${I('chat')} ${tx('Write a message')}</b><p class="muted small">${tx('Type a message, pick the language, then copy it to send to anyone.')}</p><p class="fine">${I('info')} ${tx("If your phone can't translate it, the text you type here is sent to a free online translator (MyMemory). Don't type private info.")}</p>
     <div class="wlangs"><label>${tx('From')}<select id="wFrom">${wOpts(wPair().from)}</select></label><button class="chip" id="wSwap" aria-label="${tx('Swap languages')}">⇄</button><label>${tx('To')}<select id="wTo">${wOpts(wPair().to)}</select></label></div>
     <textarea id="wIn" rows="3" maxlength="500" placeholder="${tx('Type your message…')}"></textarea>
     <button class="big" id="wGo">${I('globe')} ${tx('Translate')}</button>
     <div id="wOut" hidden><div class="wres" id="wTxt"></div><div class="wbtns"><button class="chip" id="wCopy">${tx('Copy translation')}</button><button class="chip" id="wCopyMine">${tx('Copy my words')}</button><button class="chip" id="wPlay">${I('play')} ${tx('Listen')}</button></div><div class="muted small" id="wMsg"></div></div></section>
   <div class="stats"><div class="stat"><span class="flame ${st.count?'lit':''}">${I('flame')}</span><b>${st.count}</b><small>${tx('day streak')}</small></div>
     <div class="stat"><span class="flame">${I('trophy')}</span><b>${pr.done}/${pr.total}</b><small>${tx('chats done')}</small></div>
     <div class="stat" onclick="location.hash='practice'"><span class="flame">${I('cards')}</span><b>${due}</b><small>${tx('to review')}</small></div></div>
   ${banner()}
   <h2 class="sec">${tx('Your trip')}</h2>
   <div class="list">${PACK.scenes.map((sc,i)=>{ const b=buddyFor(sc,PACK); return `<button class="stop lrow ${done[sc.id]?'won':''}" data-id="${sc.id}"><span class="pav">${avatarSVG(b,40)}</span><span class="lt"><b>${i+1}. ${esc(sc.stop)}</b><small>${esc(sc.title)}</small></span><span class="badge">${done[sc.id]?I('star','fill'):I('play')}</span></button>`; }).join('')}</div>
   <p class="fine">${I('mask')} ${tx('Characters are practice buddies, not real people.')}</p>`;
  app.querySelectorAll('.stop[data-id]').forEach(b=>b.onclick=()=>location.hash='scene/'+b.dataset.id);
  $('#say1').onclick=()=>location.hash='quick';
  bindWrite();
}
async function copyText(t){ try{ await navigator.clipboard.writeText(t); return true; }catch(e){ const a=document.createElement('textarea'); a.value=t; a.setAttribute('readonly',''); a.style.position='fixed'; a.style.opacity='0'; document.body.appendChild(a); a.select(); let ok=false; try{ ok=document.execCommand('copy'); }catch(_){} a.remove(); return ok; } }
const wPair=()=>{ const s=settings(), d={from:s.speak||'en',to:PACK.learn}, w=store.get('wpair',null); return (w && w.for===(s.speak||'en')+'-'+PACK.learn) || (w && !w.for && (s.speak||'en')==='en') ? w : d; };
const wOpts=sel=>Object.keys(LANGS).sort((x,y)=>langName(x).localeCompare(langName(y))).map(c=>`<option value="${c}" ${c===sel?'selected':''}>${esc(langName(c))}</option>`).join('');
let last='';
function bindWrite(){
  const setP=()=>store.set('wpair',{from:$('#wFrom').value,to:$('#wTo').value,for:(settings().speak||'en')+'-'+PACK.learn});
  $('#wFrom').onchange=setP; $('#wTo').onchange=setP;
  $('#wSwap').onclick=()=>{ const f=$('#wFrom').value; $('#wFrom').value=$('#wTo').value; $('#wTo').value=f; setP(); const t=$('#wTxt').textContent; if(last && t){ $('#wIn').value=last; } $('#wOut').hidden=true; last=''; };
  const inp=$('#wIn'); if(!inp) return; inp.value=sessionStorage.getItem('tt_wdraft')||'';
  inp.oninput=()=>sessionStorage.setItem('tt_wdraft',inp.value);
  last='';
  const msg=t=>{ $('#wMsg').textContent=t; };
  $('#wGo').onclick=async()=>{ const t=inp.value.trim(); if(!t){ inp.focus(); return; }
    $('#wOut').hidden=false; $('#wTxt').textContent=tx('Translating…'); msg('');
    try{ const r=await Translate.run(t, wPair().from, wPair().to, {scope:'write'}); last=r.text; $('#wTxt').textContent=last; msg(tx('Auto-translated: may have small mistakes.')); }
    catch(e){ last=''; $('#wTxt').textContent=t; msg(trMsg(e)+tx(' You can still copy your own words.')); } };
  $('#wCopy').onclick=async()=>{ if(!last){ msg(tx('Tap Translate first.')); return; } msg(await copyText(last)?tx('Copied! Paste it in any app.'):tx("Copy didn't work. Press and hold the text to copy it.")); };
  $('#wCopyMine').onclick=async()=>{ const t=inp.value.trim(); if(!t) return; msg(await copyText(t)?tx('Copied your words.'):tx("Copy didn't work. Press and hold the text to copy it.")); };
  $('#wPlay').onclick=()=>{ if(last) Speech.say(last, wPair().to); };
}
function me(){
  const standalone = (window.navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  app.innerHTML = `<h2>${tx('Me')}</h2>
   <div class="list"><button class="lrow" onclick="location.hash='setup'">${I('globe')}<span class="lt"><b>${tx('Languages')}</b><small>${esc(nativeName(PACK.learn))}</small></span>${I('arrow')}</button>
   <button class="lrow" onclick="location.hash='privacy'">${I('shield')}<span class="lt"><b>${tx('Privacy')}</b><small>${tx('Encrypted chats, nicknames only')}</small></span>${I('arrow')}</button>
   <button class="lrow" onclick="location.hash='terms'">${I('file')}<span class="lt"><b>${tx('Terms, Disclaimer and Privacy Notice')}</b><small>${tx('Free, as is, ages 13+, no personal info')}</small></span>${I('arrow')}</button></div>
   <h2 class="sec">${tx('Settings')}</h2><div class="card">${prefsRow()}</div>${soundCard()}
   ${!standalone?`<details class="card"><summary>${I('phone')} ${tx('Add to Home Screen')}</summary><p class="small">${tx('iPhone: tap Share')} ${I('share')}${tx(', then “Add to Home Screen”.')}<br>${tx('Android: tap')} <b>⋮</b>${tx(', then “Add to Home screen”.')}</p></details>`:''}
   <details class="card"><summary>${I('mask')} ${tx('About the characters')}</summary><p class="small">${tx('Anna and the other buddies are cartoon practice characters, not real people. Mistakes are fine. To talk with real people, use the Chat tab.')}</p></details>`;
  bindPrefs();
}
// One-tap: say a single phrase
function quick(){
  const pool=[]; PACK.scenes.forEach(sc=>Object.values(sc.turns).forEach(tu=>tu.replies.forEach(r=>{ if(!r.t.includes('(')) pool.push(r); })));
  const due=dueCards().map(([,k])=>k).filter(k=>!k.t.includes('(')); const r = due.length ? {t:due[0].t,m:due[0].m,s:due[0].s} : pool[Math.floor(Math.random()*pool.length)];
  app.innerHTML=`<h2>${tx('Say 1 phrase')}</h2><div class="card"><div class="muted">${tx('Say this out loud:')}</div><div class="es">${esc(r.t)}</div><div class="en">${esc(r.m)}</div>${r.s?`<div class="say">${esc(r.s)}</div>`:''}
    <div class="row"><button id="qplay">${I('volume')} ${tx('Hear it')}</button><button class="alt" id="qslow">${I('slow')} ${tx('Slow')}</button></div></div><div id="fb"></div>
    ${Speech.canListen()?`<button class="mic" id="qmic">${I('mic')} ${tx('Tap and say it')}</button>`:''}<button class="big alt" id="qdone" style="margin-top:10px">${I('check')} ${tx('I said it')}</button>
    <button class="big alt" style="margin-top:10px" onclick="location.hash='home'">${I('back')} ${tx('Back to the trip')}</button>`;
  const L=PACK.learn; $('#qplay').onclick=()=>Speech.say(r.t,L); $('#qslow').onclick=()=>Speech.say(r.t,L,true); setTimeout(()=>Speech.say(r.t,L),300);
  const win=()=>{ Streak.mark(); cheer(); $('#fb').innerHTML=`<div class="fb good">${I('check')} ${tx('Great job! That counts for today.')}</div><button class="big ok" id="qmore">${tx('One more')} ${I('arrow')}</button>`; $('#qmore').onclick=quick; };
  $('#qdone').onclick=win;
  const mic=$('#qmic'); if(mic) mic.onclick=async()=>{ try{ const a=await Speech.listen(L); if(a.some(x=>sim(x,r.t)>=0.72)) win(); else $('#fb').innerHTML=`<div class="fb try">${tx('Almost!')} ${a[0]?`${tx('I heard')} “${esc(a[0])}”.`:''} ${tx('Listen and try again.')}</div>`; }catch(e){ $('#fb').innerHTML='<div class="fb try">The mic didn\'t work. Say it out loud and tap “I said it!”.</div>'; } };
}

function scene(id){
  const sc = PACK.scenes.find(s=>s.id===id); if(!sc) return home();
  seedCards(sc);
  let tid = sc.start; const B = buddyFor(sc, PACK);
  const show = () => {
    if (tid==='end'){ const d=store.get('done_'+LK(),{}); d[sc.id]=1; store.set('done_'+LK(),d); cheer();
      app.innerHTML=`<h2>${tx('Great talk!')}</h2><div class="card celebrate">${avatarSVG(B,72)}<div>${tx('You finished')} <b>${esc(sc.title)}</b> ${tx('with')} ${esc(B.name)} ${tx('(practice buddy). You earned a star. The phrases are now in your practice cards.')}</div></div>
       <div class="row"><button onclick="location.hash='practice'">${I('cards')} ${tx('Practice')}</button><button class="alt" onclick="location.hash='home'">${I('map')} ${tx('Trip map')}</button></div>`; return; }
    const tu = sc.turns[tid];
    const L=PACK.learn, r0=tu.replies[0], hint = tu.hint || `${tx('Try:')} “${r0.t}”${r0.s?` (${r0.s})`:''} = ${r0.m}`;
    app.innerHTML = `<h2>${esc(sc.title)}</h2>${PACK.auto?`<div class="note">${I('info')} Auto-translated: may have small mistakes.</div>`:''}
     ${tid===sc.start?`<div class="intro">${I('mask')} <span><b>${tx('Practice chat:')}</b> ${UI_LANG()==='es'&&BUDDY_ES[sc.id] ? `${esc(BUDDY_ES[sc.id].intro)} ${esc(B.name)}, ${esc(BUDDY_ES[sc.id].role)}.` : `${esc(B.intro)} ${esc(B.name)}, ${esc(B.role)}.`} ${tx('Not a real person, so relax and have fun!')}</span></div>`:''}
     <div class="card"><div class="speaker">${avatarSVG(B,52)}<div>${buddyTag(B)}<div class="muted">${tx('says:')}</div></div></div><div class="es">${esc(tu.they.t)}</div><div class="en">${esc(tu.they.m)}</div>${tu.they.s?`<div class="say">${esc(tu.they.s)}</div>`:''}
      <div class="row"><button id="play">${I('volume')} ${tx('Play')}</button><button class="alt" id="slow">${I('slow')} ${tx('Slow')}</button></div></div>
     <div id="fb"></div>
     ${Speech.canListen()?`<button class="mic" id="mic">${I('mic')} ${tx('Answer out loud')}</button><p class="muted" style="text-align:center">${tx('or tap an answer:')}</p>`:`<p class="muted">${tx('Tap an answer (and say it out loud too!):')}</p>`}
     <div id="replies">${tu.replies.map((r,i)=>`<button class="reply" data-i="${i}"><b>${esc(r.t)}</b><span class="en">${esc(r.m)}</span>${r.s?`<br><span class="say">${esc(r.s)}</span>`:''}</button>`).join('')}</div>`;
    $('#play').onclick=()=>Speech.say(tu.they.t,L); $('#slow').onclick=()=>Speech.say(tu.they.t,L,true);
    setTimeout(()=>Speech.say(tu.they.t,L),300);
    const answer = (alts, tapped) => {
      const m = tapped ? {score:1, reply:tapped, said:tapped.t} : bestMatch(alts, tu.replies);
      const fb=$('#fb');
      if (m.score >= 0.72){ cheer(); Streak.mark();
        const shown = (!tapped && m.reply.t.includes('(')) ? m.said : m.reply.t;
        fb.innerHTML=`<div class="fb good pop">${I('check')} ${tx(["Yes, that's it!",'Nice, I understood you!','Great!','Well said!'][Math.floor(Math.random()*4)])} <br><b>${esc(shown)}</b> ${shown===m.reply.t?`<span class="en">— ${esc(m.reply.m)}</span>`:""}</div><button class="big ok" id="next">${tx('Next')} ${I('arrow')}</button>`;
        if (tapped && !m.reply.t.includes('(')) Speech.say(m.reply.t,L);
        $('#next').onclick=()=>{ tid=m.reply.next; show(); };
      } else {
        fb.innerHTML=`<div class="fb try">${tx('Almost!')} ${alts[0]?`${tx('I heard')} “${esc(alts[0])}”.`:tx("I didn't catch that.")}<br><b>${tx('Hint:')}</b> ${esc(hint)}</div>`;
      }
    };
    app.querySelectorAll('.reply').forEach(b=>b.onclick=()=>answer([], tu.replies[b.dataset.i]));
    const mic=$('#mic'); if(mic) mic.onclick=async()=>{ mic.classList.add('on'); mic.innerHTML=I('mic')+' '+tx('Listening…');
      try{ const alts=await Speech.listen(L); answer(alts); }catch(e){ $('#fb').innerHTML=`<div class="fb try">${esc(e.message)} ${tx('You can tap an answer instead.')}</div>`; }
      mic.classList.remove('on'); mic.innerHTML=I('mic')+' '+tx('Answer out loud'); };
    window.__answer = answer; // test hook
  };
  show();
}

function practice(){
  const due = dueCards(), total=Object.keys(cards()).length;
  if (!due.length){ app.innerHTML=`<h2>${tx('Practice')}</h2><div class="card">${total?`${tx('All done for now.')} ${total} ${tx('phrases saved. Come back later.')}`:tx('No phrases yet. Do a stop on the trip map first.')}</div><button class="big" onclick="location.hash='home'">${I('map')} ${tx('Trip map')}</button>`; return; }
  const [id,k]=due[0];
  app.innerHTML = `<h2>${tx('Practice')} <span class="muted">(${due.length} ${tx('ready')})</span></h2>
   <div class="card"><div class="muted">${tx('How do you say:')}</div><div class="es" style="color:#1b2533">${esc(k.m)} <button class="ghost g-qhear" id="hearQ" aria-label="${esc(tx('Hear the question'))}">${I('volume')}</button></div>
   <div id="ans" hidden><hr><div class="es">${esc(k.t)} <button class="ghost g-qhear" id="hearA" aria-label="${esc(tx('Hear the answer'))}">${I('volume')}</button></div>${k.s?`<div class="say">${esc(k.s)}</div>`:''}</div></div>
   <div id="pfb"></div>
   ${Speech.canListen()?`<button class="mic" id="pmic">${I('mic')} ${tx('Say it in')} ${esc(PACK.name)}</button>`:''}
   <div class="row"><button class="alt" id="show">${I('eye')} ${tx('Show answer')}</button></div>
   <div class="row" id="gr" hidden><button class="alt" id="again">${I('retry')} ${tx('Again')}</button><button class="ok" id="got">${I('check')} ${tx('Got it')}</button></div>
   <p class="muted">${tx('From:')} ${esc(k.src||'')} · ${tx('level')} ${k.box+1}/6</p>`;
  const reveal=()=>{ $('#ans').hidden=false; $('#gr').hidden=false; $('#show').parentNode.hidden=true; Speech.say(k.t,PACK.learn); };
  $('#show').onclick=reveal; $('#hearQ').onclick=()=>Speech.say(k.m,settings().speak||'en'); $('#hearA').onclick=()=>Speech.say(k.t,PACK.learn);
  $('#again').onclick=()=>{ grade(id,false); practice(); };
  $('#got').onclick=()=>{ cheer(); Streak.mark(); grade(id,true); practice(); };
  const pm=$('#pmic'); const check=async()=>{ try{ const a=await Speech.listen(PACK.learn); const r=Pron.score(a, k.t); const ok=r.pass || a.some(x=>sim(x,k.t)>=0.72);
     $('#pfb').innerHTML=`<div class="fb ${ok?'good':'try'}">${ok?tx('Sounds right!'):tx('Close. Listen and try again.')}</div>${Pron.html(r)}${ok?'':`<button class="alt" id="pRetry">${I('retry')} ${tx('Try again')}</button>`}`;
     const rt=$('#pRetry'); if(rt) rt.onclick=check; if(ok) Speech.ding(); reveal(); }catch(e){ reveal(); } }; if(pm) pm.onclick=check;
}

// ---------- talk to a real person: private rooms (WhatsApp-style, with translation) ----------
const MSG_DAYS = 7;
const myRooms = () => store.get('myrooms', {});            // code -> {ids:[memberId...], active:memberId}
const blocked = () => store.get('blocked', {});            // memberId -> true (hidden on this device)
const safetyNote_ = () => `<div class="safety">${I('shield')}<span><b>${tx('Stay safe:')}</b> ${tx("Don't share your address, school or phone number. Use a nickname, not your real name.")} <a href="#privacy">${tx('Privacy')}</a></span></div>`;
const allLangOpts = sel => Object.keys(LANGS).sort((a,b)=>nativeName(a).localeCompare(nativeName(b))).map(k=>`<option value="${k}" ${k===sel?'selected':''}>${esc(nativeName(k))}</option>`).join('');
function onlineToggle(){ return `<label class="toggle"><input type="checkbox" id="mmOn" ${Translate.allowOnline()?'checked':''}> ${tx('Use the free online backup translator (MyMemory) for chat messages')}</label>
  <p class="muted small">${tx("Off by default. When off, chat messages are only translated by your browser's own translator on this device, and may stay untranslated. When on, a message your browser can't translate is sent as plain text to MyMemory.")}</p>`; }
function packToggle(){ return `<label class="toggle"><input type="checkbox" id="mmPk" ${Translate.allowPackOnline()?'checked':''}> ${tx("Build lessons online (sends only the app's English lesson lines)")}</label>`; }
// The status line in every chat must tell the truth about where translation happens.
const trLine = () => `<span id="mmNote" ${Translate.allowOnline()?'hidden':''}>${tx('Translator: on this phone only.')}</span><span id="mmOnl" ${Translate.allowOnline()?'':'hidden'}>${tx("Translator: online backup (MyMemory) is on, so messages your phone can't translate are sent to it.")}</span>`;
function bindOnline(){ const t=$('#mmOn'); if(t) t.onchange=()=>{ Translate.setOnline(t.checked); const n=$('#mmNote'); if(n) n.hidden=t.checked; const o=$('#mmOnl'); if(o) o.hidden=!t.checked; }; const p=$('#mmPk'); if(p) p.onchange=()=>Translate.setPackOnline(p.checked); }
const tm = t => new Date(t).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
const dayLabel = t => { const d=new Date(t), n=new Date(); const k=x=>x.toDateString(); if (k(d)===k(n)) return 'Today'; n.setDate(n.getDate()-1); if (k(d)===k(n)) return 'Yesterday'; return d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'}); };
const listTime = t => { const l=dayLabel(t); return l==='Today' ? tm(t) : l; };
const AV_COLORS = ['#9C4A2F','#7A3A24','#B5841A','#5E2A1A','#A0522D','#8C5A3C'];
const avColor = s => AV_COLORS[([...String(s)].reduce((a,c)=>(a*31+c.charCodeAt(0))|0,0)>>>0) % AV_COLORS.length];
const initials = s => String(s).replace(/[^\p{L}\p{N} ]/gu,'').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase() || '?';
const roomTitle = (room, me) => room.name || (room.members.length===2 ? room.members.find(m=>m.id!==me.id).nick : 'Chat '+room.code);
// Age check: one tap, only "yes" or "no" is stored. No birthday, email, phone or real name, ever.
const ageOk = () => store.get('age13', null);
function ageGate(next){
  if (ageOk()==='yes') return false;
  document.body.classList.remove('chatmode');
  if (ageOk()==='no') { app.innerHTML = `<h2>${tx('Chat with real people')}</h2><div class="card"><b>${tx('Chat is for ages 13 and up')}</b><p>${tx('You can still use everything else: the trip map, practice buddies and phrase cards.')}</p><button class="big" onclick="location.hash='home'">${I('map')} ${tx('Go practice')}</button></div>`; return true; }
  app.innerHTML = `<h2>${tx('Chat with real people')}</h2><div class="card age"><b>${tx('Are you 13 or older?')}</b><p class="muted small">${tx('We only save your answer (yes or no) on this phone. We never ask for your birthday, name, email or phone number.')}</p>
    <div class="row"><button class="big" id="ageYes">${tx("Yes, I'm 13 or older")}</button><button class="big alt" id="ageNo">${tx('No')}</button></div></div>`;
  $('#ageYes').onclick=()=>{ store.set('age13','yes'); next(); }; $('#ageNo').onclick=()=>{ store.set('age13','no'); ageGate(next); };
  return true;
}
// Safety & Rules: everyone taps "I agree" once before their first chat.
function rulesGate(next){
  if (store.get('rules_ok', null)==='yes') return false;
  document.body.classList.remove('chatmode');
  app.innerHTML = `<h2>${tx('Chat safety and rules')}</h2><div class="card rules"><b>${tx('Before you chat, please agree to these rules')}</b><ul>${UI_LANG()==='es'?I18N.es.rules_list:`
    <li><b>Be kind.</b> No bullying, hate, threats or sexual content.</li>
    <li><b>Keep your personal info private.</b> Don't share your address, phone number, school or real full name.</li>
    <li><b>Report and block</b> anyone who makes you uncomfortable. Every chat has Report and Block buttons. For now a report is saved on your phone, so use Block right away. Reports will reach the host once chat works across phones, and the host can remove people.</li>
    <li><b>Invite only.</b> Nobody can find you or be matched with you. Only people with an invite link can join.</li>
    <li><b>The host is in charge.</b> The person who starts a chat can remove people or close the chat.</li>
    <li><b>A parent can join.</b> You can invite a parent or guardian to any chat.</li>
    <li>Translations can be wrong. Don't use them for medical, legal or emergency needs.</li>`}</ul>
    ${UI_LANG()==='es'?`<p class="small">${I18N.es.rules_read}</p>`:`<p class="small">Read the <a href="#terms">Terms of Use</a>, <a href="#terms/disclaimer">Disclaimer</a> and <a href="#terms/privacy">Privacy Notice</a>.</p>`}
    <button class="big" id="rulesOk">${I('check')} ${tx('I agree')}</button></div>`;
  $('#rulesOk').onclick=()=>{ store.set('rules_ok','yes'); next(); }; return true;
}
async function chat(join){
  if (ageGate(()=>chat(join)) || rulesGate(()=>chat(join))) return;
  document.body.classList.remove('chatmode');
  const rooms=myRooms(), codes=Object.keys(rooms);
  if (!join && codes.length) return chatList();
  const me = store.get('chat',{a:'en',b:'es'});
  app.innerHTML = `<h2>${codes.length?`<button class="ghost iconbtn" onclick="location.hash='chat'" aria-label="Back">${I('back2')}</button>`:''}${tx('Talk to a real person')}</h2>${safetyNote_()}
   <p class="muted">${tx('A private chat with real people you invite. Each person reads every message in their own language.')}</p>
   <div class="card"><b>${tx('Start a new chat')}</b>
    <label>${tx('Chat name (optional)')}<input id="cName" maxlength="40" placeholder="${tx('e.g. Spanish Club')}" autocomplete="off"></label>
    <label>${tx('Your nickname')}<input id="cNick" maxlength="20" placeholder="${tx('e.g. Sunny')}" autocomplete="off"></label>
    <label>${tx('Your language')}<select id="cLang">${allLangOpts(me.a)}</select></label>
    <label>${tx('Make a passcode')}<input id="cPass" type="password" minlength="4" placeholder="${tx('at least 4 characters')}"></label>
    <p class="muted small">${I('lock')} ${tx('Invite-only: nobody can search for this chat or be matched with you. Only people you send an invite link to can join.')}</p>
    <button class="big" id="cGo">${tx('Start chat')}</button><p class="err" id="cErr"></p></div>
   <div class="card"><b>${tx('Join with an invite link')}</b><p class="muted small">${tx('Ask someone in the chat for your own invite link and the passcode.')}</p>
    <label>${tx('Chat code')}<input id="jCode" placeholder="K7QX-29MB" value="${esc(join&&join.code||'')}" autocapitalize="characters"></label>
    <label>${tx('Invite link')}<input id="jInv" placeholder="${tx('paste your whole invite link')}" value="${esc(join&&join.invite?location.href:'')}"></label>
    <label>${tx('Passcode')}<input id="jPass" type="password"></label>
    <label>${tx('Your nickname')}<input id="jNick" maxlength="20" autocomplete="off"></label>
    <label>${tx('Your language')}<select id="jLang">${allLangOpts(me.b)}</select></label>
    <button class="big" id="jGo">${tx('Join chat')}</button><p class="err" id="jErr"></p></div>
   <p class="muted small">${tx("No account, email or phone number is needed: you get a random ID and the nickname you pick.")}</p>`;
  const keep=(code,id,key,pair,epoch=0)=>{ const r=myRooms(); r[code]=r[code]||{ids:[]}; r[code].ids.push(id); r[code].active=id; r[code].key=r[code].key||key;
    r[code].mk=r[code].mk||{}; r[code].mk[id]={keys:{[epoch]:key}, priv:pair.priv, pub:pair.pub}; store.set('myrooms',r); openRoom(code); };
  if (!E2E.supported()) app.insertAdjacentHTML('afterbegin','<p class="err">'+tx('This browser is too old for private (encrypted) chats.')+'</p>');
  $('#cGo').onclick=async()=>{ try{ const key=await E2E.newKey(), pair=await E2E.newPair(); const r=await RoomServer.createRoom({nickname:$('#cNick').value, passcode:$('#cPass').value, lang:$('#cLang').value, pub:pair.pub, name:$('#cName').value}); keep(r.code,r.memberId,key,pair); }catch(e){ $('#cErr').textContent=tx(e.message); } };
  $('#jGo').onclick=async()=>{ try{ const parts=$('#jInv').value.trim().split('#').pop().split('/'); const inv = parts.length>=2 ? parts[parts.length-2] : parts[0], key = parts.length>=2 ? parts[parts.length-1] : '';
      if (!key || key.length<40) throw new Error(tx('Please paste the whole invite link. It holds the secret key that unlocks the messages.'));
      const pair=await E2E.newPair(); const r=await RoomServer.joinRoom({code:$('#jCode').value, invite:inv, passcode:$('#jPass').value, nickname:$('#jNick').value, lang:$('#jLang').value, pub:pair.pub}); keep(r.code,r.memberId,key,pair,r.epoch); }catch(e){ const m=e.message||''; $('#jErr').textContent = /already used/i.test(m) ? tx('This invite link was already used. Ask for a new one.') : /chat is full/i.test(m) ? tx('This chat is full (15 people).') : /expired/i.test(m) ? tx('This invite link has expired (24 hours). Ask for a new one.') : tx(m); } };
}
const openRoom = code => { if (location.hash==='#chat/'+code) roomView(code); else location.hash='chat/'+code; };
// Short preview of a message for the chat list (decrypted on this phone only).
async function preview(m, mk){ try{ const k=mk.keys[m.epoch||0]; if(!k) throw 0; const p=await E2E.decrypt(k, m.text);
  if (m.kind==='voice'){ const v=JSON.parse(p); return `${I('mic')} ${tx('Voice note')} (${Voice.fmt(v.dur)})`; } return esc(p); }catch(e){ return '<i>'+tx('Locked message')+'</i>'; } }
async function chatList(){
  document.body.classList.add('chatmode'); setChatBox();
  const rooms=myRooms(), rows=[];
  for (const code of Object.keys(rooms)){ const mine=rooms[code]; let room;
    try{ room=await RoomServer.getRoom(code, mine.active); }catch(e){ const r=myRooms(); delete r[code]; store.set('myrooms',r); continue; }
    const mk=await roomKeys(code, mine, room), me=room.members.find(m=>m.id===mine.active), bl=blocked();
    const msgs=room.messages.filter(m=>!bl[m.from]), last=msgs[msgs.length-1], unread=msgs.filter(m=>m.from!==me.id && m.at>(me.seenAt||0)).length;
    const title=roomTitle(room, me);
    rows.push({at:last?last.at:room.members[0].joinedAt, html:`<button class="wa-row" data-room="${esc(code)}"><span class="wa-av" style="background:${avColor(title)}">${esc(initials(title))}</span>
      <span class="wa-mid"><b>${esc(title)}</b><small>${last? (last.from===me.id?'<span class="tick">✓</span> ':(room.members.length>2?esc(last.nick)+': ':'')) + await preview(last, mk) : tx('No messages yet')}</small></span>
      <span class="wa-rt"><small class="${unread?'un':''}">${last?listTime(last.at):''}</small>${unread?`<span class="wa-badge">${unread}</span>`:''}</span></button>`}); }
  if (!rows.length) return chat({});
  rows.sort((a,b)=>b.at-a.at);
  app.innerHTML = `<div class="wa list"><div class="wa-top"><h1>${tx('Chats')}</h1></div>
    <div class="wa-note">${I('lock')} ${tx('End-to-end encrypted · invite-only · messages vanish after')} ${MSG_DAYS} ${tx('days')}</div>
    <div class="wa-rows">${rows.map(r=>r.html).join('')}</div>
    <button class="wa-fab" id="newChat" aria-label="${tx('New chat')}">${I('plus')}</button></div>`;
  app.querySelectorAll('[data-room]').forEach(b=>b.onclick=()=>openRoom(b.dataset.room));
  $('#newChat').onclick=()=>location.hash='chat/new';
}
function setChatBox(){ const h=document.querySelector('header'), n=document.querySelector('nav'); document.documentElement.style.setProperty('--navh', (n?n.offsetHeight:64)+'px'); }
// Keys this member holds, by key version (epoch). Picks up new keys wrapped for this member after a rotation.
async function roomKeys(code, mine, room){ const all=myRooms(); const rec=all[code]; rec.mk=rec.mk||{};
  const mk=rec.mk[mine.active]||(rec.mk[mine.active]={keys:{0:rec.key}}); // chats made before key rotation existed
  let changed=false;
  for (const env of room.rekeys||[]) if (!mk.keys[env.epoch] && mk.priv) { try{ mk.keys[env.epoch]=await E2E.unwrap(mk.priv, env.from, env.blob); changed=true; }catch(e){} }
  if (changed){ all[code]=rec; store.set('myrooms',all); } return mk; }
// Creator only: make a new room key and wrap it for each remaining member. Removed people get nothing.
async function rotateRoomKey(code, meId){ const all=myRooms(), rec=all[code], mk=rec.mk&&rec.mk[meId]; if (!mk || !mk.priv) throw new Error('This chat was made before key changes existed.'); const room=await RoomServer.getRoom(code, meId);
  const epoch=room.epoch+1, key=await E2E.newKey(), env=[];
  for (const m of room.members) if (m.id!==meId && m.pub) { try{ env.push({to:m.id, blob:await E2E.wrap(mk.priv, m.pub, key)}); }catch(e){ console.warn('wrap failed for', m.id); } }
  await RoomServer.rotateKey(code, meId, epoch, env, mk.pub); mk.keys[epoch]=key; store.set('myrooms',all); return epoch; }
const trMsg = e => e && e.message==='offline-off' ? tx('Not translated: the online backup translator is off.') : e && e.message==='quota' ? tx('Translation limit reached for today, try again later.') : tx('Translation is busy right now. Please try again later.');
// Does this chat need translation into showLang? (someone writes in another language)
const needsTr = (room, showLang) => room.members.some(m=>m.lang!==showLang) || room.messages.some(m=>m.lang!==showLang);
const mmAskHtml = id => `<div class="mm-ask" id="${id}"><span>${esc(tx('To translate on this phone, turn on the free online translator'))}</span> <button class="chip mm-on">${esc(tx('Turn on'))}</button><small class="muted">${esc(tx('Messages you see translated are sent as plain text to MyMemory, a free translation service. You can turn it off in chat info.'))}</small></div>`;
// Per-chat language choice: what I type in, and what others' messages are shown in. Saved on this phone, per chat.
function chatLangs(code, me){ const c=(store.get('chatlang',{})||{})[code+'|'+me.id]||{}; return {type:LANGS[c.type]?c.type:me.lang, show:LANGS[c.show]?c.show:me.lang}; }
const chatLangOpts = sel => Object.keys(LANGS).sort((a,b)=>langName(a).localeCompare(langName(b))).map(c=>`<option value="${c}" ${c===sel?'selected':''}>${esc(nativeName(c))}${nativeName(c)!==langName(c)?' · '+esc(langName(c)):''}</option>`).join('');
async function roomView(code){
  if (ageGate(()=>roomView(code)) || rulesGate(()=>roomView(code))) return;
  const mine=myRooms()[code]; if (!mine) { location.hash='chat'; return; }
  let room;
  try{ room=await RoomServer.getRoom(code, mine.active); }catch(e){ const r=myRooms(); delete r[code]; store.set('myrooms',r); toast(e.message); location.hash='chat'; return; }
  document.body.classList.add('chatmode'); setChatBox();
  const mk=await roomKeys(code, mine, room);
  const me=room.members.find(m=>m.id===mine.active), bl=blocked(), cutoff=Date.now()-MSG_DAYS*864e5;
  const chl=chatLangs(code, me), typeLang=chl.type, showLang=chl.show;
  const others=room.members.filter(m=>m.id!==me.id), group=room.members.length>2, title=roomTitle(room, me);
  const msgs=room.messages.filter(m=>m.at>=cutoff), hidden=msgs.filter(m=>bl[m.from]).length;
  const otherLangs=[...new Set(others.map(m=>m.lang).filter(l=>l!==me.lang))];
  const sub = group || !others.length ? `${room.members.length} ${room.members.length>1?tx('members'):tx('member')} · ${tx('tap for info')}` : `${isOnline(others[0])?tx('online')+' · ':''}${tx('speaks')} ${esc(nativeName(others[0].lang))}`;
  const seesWho = group ? tx('Others see') : (others[0] ? tx('What')+' '+esc(others[0].nick)+' '+tx('sees') : tx('They see'));
  const recog = Speech.canListen(), canRec = Voice.canRecord();
  app.innerHTML = `<div class="wa conv" data-code="${esc(room.code)}">
   <div class="wa-top"><button class="ghost iconbtn" id="backList" aria-label="${tx('Back to chats')}">${I('back2')}</button><span class="wa-av s" style="background:${avColor(title)}">${esc(initials(title))}</span>
     <button class="wa-hn" id="mBar"><b>${esc(title)}</b><small>${sub}</small></button><button class="wa-lang" id="langBtn" aria-label="${esc(tx('Chat languages'))}">${I('globe')}<span>${esc(typeLang.toUpperCase())}→${esc(showLang.toUpperCase())}</span></button><button class="ghost iconbtn wa-mute${MsgSound.muted()?' on':''}" id="hMute" aria-pressed="${MsgSound.muted()}" aria-label="${MsgSound.muted()?tx('Turn message sound on'):tx('Mute message sound')}" title="${MsgSound.muted()?tx('Turn message sound on'):tx('Mute message sound')}">${I(MsgSound.muted()?'mute':'volume')}</button><button class="ghost iconbtn" id="mBar2" aria-label="${tx('Chat info')}">${I('more')}</button></div>
   ${mine.ids.length>1?`<div class="wa-demo">${tx('Demo on one device: you are')} <select id="who">${mine.ids.map(id=>{const m=room.members.find(x=>x.id===id); return m?`<option value="${id}" ${id===me.id?'selected':''}>${esc(m.nick)}</option>`:''}).join('')}</select></div>`:''}
   <div class="wa-wall" id="msgs"></div>
   <div id="vPrev"></div>
   <div class="wa-bar"><input id="msgIn" placeholder="${esc(tx('Type in'))} ${esc(nativeName(typeLang))}…" enterkeyhint="send" maxlength="500" autocomplete="off">
     <button class="wa-mic" id="mic2" aria-label="${tx('Hold to record a voice note')}">${I('mic')}</button><button class="wa-send" id="send" aria-label="${tx('Send')}" hidden>${I('send')}</button></div>
   <div class="wa-sheet" id="mList" hidden><div class="grab"></div><b id="mCount">${room.members.length}/${ROOM_CAP} ${tx('members')}</b>${room.members.length>=ROOM_CAP?` <span class="muted small">· ${tx('This chat is full (15 people).')}</span>`:''} <span class="muted small">· ${tx('code')} ${esc(room.code)} · ${I('key')} ${tx('passcode protected')}</span>
     ${room.members.map(m=>`<div class="mem"><span class="dot ${isOnline(m)?'on':''}" title="online"></span>
     <div class="mi"><b>${esc(m.nick)}</b>${m.id===me.id?' ('+tx('you')+')':''}${m.creator?' · '+tx('started the chat'):''}<small>${m.addedByNick?`${tx('added by')} ${esc(m.addedByNick)} · `:''}${tx('joined')} ${tm(m.joinedAt)} · ${esc(nativeName(m.lang))}</small></div>
     ${m.id!==me.id?`<div class="macts"><button class="chip" data-block="${m.id}">${bl[m.id]?tx('Unblock'):tx('Block')}</button><button class="chip" data-report="${m.id}">${tx('Report')}</button>${me.creator?`<button class="chip warn" data-remove="${m.id}">${tx('Remove')}</button>`:''}</div>`:''}</div>`).join('')}
     <div class="wa-acts"><button class="alt" id="inv" ${room.members.length>=ROOM_CAP?'disabled title="'+tx('This chat is full (15 people).')+'"':''}>${I('plus')} ${tx('Invite')}</button><button class="alt" id="leave">${I('logout')} ${tx('Leave')}</button><button class="alt" id="muteBtn">${I('volume')} ${MsgSound.muted()?tx('Sound off'):tx('Sound on')}</button>
     ${me.creator?`<button class="alt" id="newPass">${I('key')} ${tx('Passcode')}</button><button class="alt warn" id="close">${I('close')} ${tx('Close chat')}</button>`:''}</div><div id="invOut"></div>
     <p class="muted small">${I('shield')} ${tx('Invite-only: no strangers can find this chat.')} ${me.creator?tx('You are the host: you can remove anyone (they also lose the key) or close the chat.'):tx('Only the host can remove people. Block hides someone on your phone.')}</p>
     ${onlineToggle()}<button class="alt" id="closeSheet">${tx('Done')}</button></div>
   <div class="wa-sheet lsheet" id="lSheet" hidden><div class="grab"></div><b>${esc(tx('Chat languages'))}</b><p class="muted small">${esc(tx('Only for this chat. You can change it anytime.'))}</p>
     <label class="lrow"><span>${esc(tx('I type in'))}</span><select id="lType">${chatLangOpts(typeLang)}</select></label>
     <label class="lrow"><span>${esc(tx('Show messages in'))}</span><select id="lShow">${chatLangOpts(showLang)}</select></label>
     <p class="muted small">${esc(tx('Messages from others are translated for you. Tap Show original to see what they wrote.'))}</p>
     <div id="lAsk" ${!Translate.allowOnline()&&showLang!==typeLang?'':'hidden'}>${mmAskHtml('mmAskL')}</div><button id="lSave">${esc(tx('Save'))}</button></div>
  </div>`;
  bindOnline();
  const box=$('#msgs'), plainOf={};
  // Speak a message in the chosen 'Show messages in' language. iPhone: must start inside the tap, so unlock speech first if we have to wait for a translation.
  const trShown={};
  const sayShown=(id, plain, from)=>{ if(!plain) return; if(from===showLang) return Speech.say(plain, from); if(trShown[id]) return Speech.say(trShown[id], showLang);
    Speech.unlock(); Translate.run(plain, from, showLang).then(r=>{ trShown[id]=r.text; Speech.say(r.text, showLang); }).catch(e=>{ toast(tx("Couldn't translate, so reading the original.")+' '+trMsg(e)); Speech.say(plain, from); }); };
  // Message list only. Called for the first draw and for every live update (input text, focus and open sheets are left alone).
  const meRef=me;
  const renderMsgs=async(room, mk)=>{ const bl=blocked(), cutoff=Date.now()-MSG_DAYS*864e5; const me=room.members.find(m=>m.id===mine.active)||meRef;
    const others=room.members.filter(m=>m.id!==me.id), group=room.members.length>2;
    const msgs=room.messages.filter(m=>m.at>=cutoff), hidden=msgs.filter(m=>bl[m.from]).length;
    const atBottom = box.scrollHeight-box.scrollTop-box.clientHeight < 80; Object.keys(plainOf).forEach(k=>delete plainOf[k]);
    box.innerHTML = `<div class="wa-sys">${I('lock')} ${tx('Messages are end-to-end encrypted and vanish after')} ${MSG_DAYS} ${tx('days')}. ${trLine()}</div>${!Translate.allowOnline()&&needsTr(room, showLang)?mmAskHtml('mmAskC'):''}`;
    // timeline: messages + "X was added by Y" lines
    const events = msgs.map(m=>({at:m.at, m})).concat(room.members.map(x=>({at:x.joinedAt, sys: x.id===me.id ? (x.creator?tx('You started this chat'):`${tx('You were added by')} ${esc(x.addedByNick||tx('someone'))}`) : x.creator?`${esc(x.nick)} ${tx('started this chat')}`:`${esc(x.nick)} ${tx('was added by')} ${esc(x.addedByNick||tx('someone'))}`}))).sort((a,b)=>a.at-b.at);
    let lastDay='';
    for (const ev of events){ const dl=dayLabel(ev.at); if (dl!==lastDay){ lastDay=dl; box.insertAdjacentHTML('beforeend', `<div class="wa-day">${dl}</div>`); }
      if (ev.sys){ box.insertAdjacentHTML('beforeend', `<div class="wa-sys">${ev.sys}</div>`); continue; }
      const m=ev.m; if (bl[m.from]) continue; const mineMsg=m.from===me.id;
      const d=document.createElement('div'); d.className='wb '+(mineMsg?'out':'in')+(m.kind==='voice'?' v':''); d.dataset.id=m.id; d.dataset.from=m.from; box.appendChild(d);
      const nk = group && !mineMsg ? `<div class="nk" style="color:${avColor(m.nick)}">${esc(m.nick)}</div>` : '';
      const seen = others.length && others.every(o=>(o.seenAt||0)>=m.at);
      const foot = (extra='') => `<div class="f">${extra}<button class="spk" aria-label="${tx('Hear')}">${I('volume')}</button><time>${tm(m.at)}</time>${mineMsg?`<span class="tick ${seen?'rd':''}" title="${seen?tx('Read'):tx('Sent')}">${seen?'✓✓':'✓'}</span>`:''}</div>`;
      let plain, voice=null; try{ const k=mk.keys[m.epoch||0]; if(!k) throw 0; plain = await E2E.decrypt(k, m.text); if (m.kind==='voice') { voice=JSON.parse(plain); plain=voice.transcript||''; } }
      catch(e){ d.innerHTML=`${nk}<div class="muted">${I('lock')} ${tx("Can't unlock this message on this device.")}</div>`; continue; }
      plainOf[m.id]={from:m.from, text:plain};
      const vHead = voice ? `<div class="wa-vn"><button class="play" aria-label="Play voice note">${I('play')}</button>${Voice.waveHtml(voice.wave||[])}<span class="dur">${Voice.fmt(voice.dur)}</span></div>
         <div class="sub">${I('mic')} ${tx('Voice note')}${plain?` · “${esc(plain)}”`:''}</div>${!plain?`<div class="sub">${esc(voice.note||'No words written down for this one. Tap play to listen.')}</div>`:''}` : '';
      const bindVoice = () => { const pb=d.querySelector('.play'); if(!pb) return; let au=null;
        pb.onclick=async()=>{ try{ if(!au){ const el=new Audio(); el.muted=true; el.play().catch(()=>{}); /* iPhone: unlock playback inside the tap */ const blob=await Voice.openAudio(mk.keys[m.epoch||0], await RoomServer.getAudio(code, me.id, m.audioId)); if (!Voice.canPlay(blob.type)) throw new Error(tx("This voice note can't play on this device.")); el.pause(); el.muted=false; el.src=URL.createObjectURL(blob); au=el;
            const bars=d.querySelectorAll('.wa-wave i'); au.ontimeupdate=()=>{ const p=au.currentTime/(au.duration&&isFinite(au.duration)?au.duration:voice.dur||1); bars.forEach((b,i)=>b.classList.toggle('on', i/bars.length<=p)); };
            au.onended=()=>{ pb.innerHTML=I('play'); bars.forEach(b=>b.classList.remove('on')); }; }
          if (au.paused){ await au.play(); pb.innerHTML=I('pause'); } else { au.pause(); pb.innerHTML=I('play'); } }catch(e){ toast(e.message||'Could not play this voice note.'); } }; };
      if (mineMsg){
        const myTo = otherLangs.length ? otherLangs[0] : (showLang!==m.lang ? showLang : null), myLbl = otherLangs.length ? seesWho : esc(tx('In'))+' '+esc(nativeName(showLang));
        d.innerHTML = `${vHead}${voice?'':`<div class="t">${esc(plain)}</div>`}<div class="sub" id="sees-${m.id}" ${myTo&&plain?'':'hidden'}></div>${plain&&showLang!==m.lang&&showLang!==myTo?`<div class="sub mine-show" data-lang="${showLang}"></div>`:''}${foot()}`;
        { const ms=d.querySelector('.mine-show'); if (ms){ const lbl=esc(tx('In'))+' '+esc(nativeName(showLang)); const put=t=>{ trShown[m.id]=t; ms.innerHTML=`${lbl}: “${esc(t)}”`; }; const pre=voice&&voice.tr&&voice.tr[showLang]; if (pre) put(pre); else { ms.textContent=`${lbl}: ${tx('translating…')}`; Translate.run(plain, m.lang, showLang).then(r=>put(r.text)).catch(e=>{ ms.textContent=`${lbl}: ${trMsg(e)}`; }); } } }
        if (voice&&voice.tr&&voice.tr[showLang]) trShown[m.id]=voice.tr[showLang];
        d.querySelector('.spk').onclick=()=>sayShown(m.id, plain, m.lang); bindVoice();
        if (myTo && plain){ const to=myTo, s=d.querySelector('.sub[id]'); const pre=voice&&voice.tr&&voice.tr[to];
          const show = t => { if (to===showLang) trShown[m.id]=t; s.innerHTML=`${myLbl}: “${esc(t)}” <button class="spk2" aria-label="${tx('Hear their version')}">${I('volume')}</button>`; s.querySelector('.spk2').onclick=()=>Speech.say(t,to); };
          if (pre) show(pre); else { s.textContent=`${myLbl}: ${tx('translating…')}`; Translate.run(plain, m.lang, to).then(r=>show(r.text)).catch(e=>{ s.textContent=`${myLbl}: ${typeof trMsg==='function'?trMsg(e):tx('your words as typed')}`; }); } }
        continue; }
      const draw=(tr,lang,err)=>{ const translated = plain && tr!==plain;
        d.innerHTML=`${nk}${vHead}${plain&&(!voice||translated)?`<div class="t">${esc(tr)}</div>`:''}${err?`<div class="sub">${esc(err)}</div>`:''}
          <div class="og" hidden><small>${tx('Original')} · ${esc(nativeName(m.lang))}</small>${esc(plain)} <button class="spk3">${I('volume')} ${tx('Hear')} ${esc(nativeName(m.lang))}</button></div>
          ${foot(`<a class="so" href="javascript:void 0">${translated?tx('Show original'):tx('More')}</a>`)}
          <div class="wa-more" hidden>${m.lang===PACK.learn||lang===PACK.learn?`<button class="chip save">${I('star')} ${tx('Save phrase to practice')}</button>`:''}<button class="chip rep">${I('flag')} ${tx('Report')}</button></div>`;
        if (lang===showLang && tr && lang!==m.lang) trShown[m.id]=tr;
        d.querySelector('.spk').onclick=()=>sayShown(m.id, plain, m.lang);
        const so=d.querySelector('.so'); so.onclick=()=>{ const og=d.querySelector('.og'), more=d.querySelector('.wa-more'); more.hidden=!more.hidden; if (translated) og.hidden=more.hidden; d.classList.toggle('open', !more.hidden); so.textContent=translated?(more.hidden?tx('Show original'):tx('Hide original')):(more.hidden?tx('More'):tx('Less')); };
        d.querySelector('.spk3').onclick=()=>Speech.say(plain, m.lang);
        d.querySelector('.rep').onclick=()=>reportMember(code, m.from, [plain]);
        const sv=d.querySelector('.save'); if(sv) sv.onclick=()=>{ const T=PACK.learn, tgt=m.lang===T?plain:tr, en=m.lang===T?(lang!==T?tr:''):plain; toast(addCard(tgt, en, '', 'Chat')?'Saved to practice':'Already saved'); };
        bindVoice(); };
      if (!plain || m.lang===showLang) draw(plain,m.lang);
      else { const pre=voice&&voice.tr&&voice.tr[showLang]; if (pre) draw(pre, showLang);
        else if (trShown[m.id]) draw(trShown[m.id], showLang);
      else { draw(plain, m.lang, tx('Translating…')); d.classList.add('trw'); Translate.run(plain, m.lang, showLang).then(r=>{ d.classList.remove('trw'); draw(r.text, showLang); }).catch(e=>{ d.classList.remove('trw'); draw(plain, m.lang, trMsg(e)); }); } } }
    if (!msgs.length) box.insertAdjacentHTML('beforeend',`<div class="wa-sys">${tx('No messages yet. Say hi! Hold the mic to send a voice note.')}</div>`);
    if (hidden) box.insertAdjacentHTML('beforeend',`<div class="wa-sys">${hidden} ${tx(hidden>1?'messages hidden from people you blocked.':'message hidden from people you blocked.')}</div>`);
    if (atBottom || !box.dataset.drawn || window.__forceBottom) box.scrollTop=box.scrollHeight; box.dataset.drawn='1'; window.__forceBottom=false; RoomServer.markSeen(code, me.id).catch(()=>{});
    // new-message sound: only for messages from someone else that arrived since the last look
    { const inc=msgs.filter(m=>m.from!==me.id && !bl[m.from]), lastAt=inc.length?inc[inc.length-1].at:0, seenIn=(window.__lastIn=window.__lastIn||{});
      if (seenIn[code]!==undefined && lastAt>seenIn[code]) MsgSound.play(); seenIn[code]=lastAt; }
  };
  await renderMsgs(room, mk);
  const syncMute=()=>{ const m=MsgSound.muted(), h=$('#hMute'); if(h){ h.innerHTML=I(m?'mute':'volume'); h.classList.toggle('on',m); h.setAttribute('aria-pressed',m); const l=m?tx('Turn message sound on'):tx('Mute message sound'); h.setAttribute('aria-label',l); h.title=l; } const b=$('#muteBtn'); if(b) b.innerHTML=`${I(m?'mute':'volume')} ${m?tx('Sound off'):tx('Sound on')}`; };
  const flipMute=()=>{ MsgSound.setMuted(!MsgSound.muted()); syncMute(); toast(MsgSound.muted()?tx('Message sound is off.'):tx('Message sound is on.')); };
  $('#muteBtn').onclick=flipMute; $('#hMute').onclick=flipMute;
  // per-chat languages
  $('#langBtn').onclick=()=>{ $('#lSheet').hidden=false; keepSheet('lSheet'); };
  $('#lSave').onclick=()=>{ const all=store.get('chatlang',{}), sh=$('#lShow').value; all[code+'|'+me.id]={type:$('#lType').value, show:sh}; store.set('chatlang',all);
    // Choosing a different 'Show messages in' language needs a translator. iPhone has no built-in one, so turn on the online one and say so.
    if (!Translate.allowOnline() && (sh!==me.lang || room.members.some(x=>x.lang!==sh))) { Translate.setOnline(true); toast(tx('Chat languages saved. The free online translator is now on: messages are sent to MyMemory to translate. You can turn it off in chat info.')); }
    else toast(tx('Chat languages saved.'));
    keepSheet(null); roomView(code); };
  // live updates from the chat server (only rooms you are in)
  // Live updates: re-fetch and redraw the message list only. A member change (join/remove) needs a full redraw, held while a sheet is open.
  let busy=false, again=false;
  const refresh=async()=>{ if (busy){ again=true; return; } busy=true; try{ do { again=false;
      const r=await RoomServer.getRoom(code, mine.active); const k=await roomKeys(code, myRooms()[code]||mine, r);
      if (window.__roomCtx!==ctx) return;
      const ids=x=>x.members.map(m=>m.id).sort().join(',');
      { const io=$('#invOut'); const fresh=r.members.filter(m=>!room.members.some(x=>x.id===m.id)); if (io && io.innerHTML && fresh.length) io.innerHTML=`<div class="invite">${tx('Invite used by')} <b>${esc(fresh.map(m=>m.nick).join(', '))}</b>. ${tx('That link no longer works.')} <button class="chip" id="invNew">${tx('New link for another person')}</button></div>`, $('#invNew').onclick=()=>$('#inv').click(); }
      if (ids(r)!==ids(room) || (r.epoch!==room.epoch && !k.keys[r.epoch])) { if (window.__openSheet===code+'|mList'||window.__openSheet===code+'|lSheet') { window.__pendingRender=true; } else if (document.activeElement!==inp) { busy=false; return roomView(code); } }
      if (ids(r)!==ids(room)) room.members=r.members;
      Object.assign(mk.keys, k.keys); room.epoch=r.epoch; room.messages=r.messages; room.members.forEach(m=>{ const n=r.members.find(x=>x.id===m.id); if(n) m.seenAt=n.seenAt; });
      await renderMsgs(room, mk); } while(again); } catch(e){ if (/not in this chat|closed|removed/i.test(e.message||'')) { busy=false; return roomView(code); } } finally { busy=false; } };
  const ctx={code, refresh}; window.__roomCtx=ctx;
  if (!window.__roomSub || window.__roomSub.code!==code) { roomUnsubscribe(); const sub={code, unsub:null}; window.__roomSub=sub; window.__roomCtx=ctx;
    RoomServer.subscribe(code, ()=>{ const c=window.__roomCtx; if (c && c.code===code && (location.hash||'').includes(code)) c.refresh(); }).then(u=>{ if (window.__roomSub===sub) sub.unsub=u; else { try{ u(); }catch(e){} } }).catch(()=>{}); }
  // ----- compose: text, voice note, pronunciation check -----
  const inp=$('#msgIn'), sendB=$('#send');
  const upd=()=>{ sendB.hidden=!inp.value.trim(); }; inp.oninput=upd;
  const send=async()=>{ const t=inp.value.trim(); if(!t) return; if (/\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b|@\w+\.\w+/.test(t) && !confirm(tx('This looks like a phone number or email. Send it anyway?'))) return;
    // Optimistic: show it at once, clear the box, keep focus; then send and redraw only the list.
    inp.value=''; upd(); const tmp=document.createElement('div'); tmp.className='wb out pending'; tmp.innerHTML=`<div class="t">${esc(t)}</div><div class="f"><time>${tm(Date.now())}</time><span class="tick" title="${tx('Sending…')}">🕓</span></div>`; box.appendChild(tmp); box.scrollTop=box.scrollHeight;
    try{ await RoomServer.send(code, me.id, await E2E.encrypt(mk.keys[room.epoch], t), typeLang, room.epoch); window.__forceBottom=true; await refresh(); }
    catch(e){ tmp.classList.add('failed'); tmp.querySelector('.tick').textContent='⚠️'; if(!inp.value){ inp.value=t; upd(); } toast(tx(e.message)); } };
  sendB.onclick=send; inp.onkeydown=e=>{ if(e.key==='Enter') send(); };
  const mic=$('#mic2'); let rec=null, starting=null, t0=0, toggleMode=false, released=false;
  const clearInfo=()=>{ const ri=$('#recInfo'); if(ri) ri.remove(); };
  const stopRec=async()=>{ if(!rec) return; const h=rec; rec=null; mic.classList.remove('rec'); $('.wa-bar').classList.remove('recording'); clearInfo();
    const note=await h.stop(); if (note.empty || note.dur<0.6) { toast(micErrorText({name:'too-short'})); return; }
    if (note.blob.size > Voice.MAX_BYTES) { toast(tx('Voice note is too long. Keep it under about a minute.')); return; } reviewVoice(note); };
  // Must run inside the tap: Voice.start calls getUserMedia before any await.
  const startRec=()=>{ if (rec || starting) return; released=false;
    starting = Voice.start(me.lang, (l,s)=>{ const c=$('#recT'); if(c) c.textContent=Voice.fmt(s); }).then(h=>{ starting=null; rec=h; t0=Date.now(); mic.classList.add('rec'); $('.wa-bar').classList.add('recording');
      inp.insertAdjacentHTML('beforebegin', `<div class="wa-rec" id="recInfo"><i class="recdot"></i> ${tx('Recording')} <b id="recT">0:00</b> · ${tx('tap the mic to stop')}</div>`);
      if (released) { toggleMode=true; } // finger lifted during the permission prompt: keep recording, tap to stop
    }).catch(e=>{ starting=null; rec=null; toast(micErrorText(e)); }); };
  if (canRec){
    mic.addEventListener('contextmenu', e=>e.preventDefault());
    mic.onpointerdown=e=>{ e.preventDefault(); try{ mic.setPointerCapture(e.pointerId); }catch(_){}
      if (rec && toggleMode) { toggleMode=false; stopRec(); return; } startRec(); };
    const lift=e=>{ released=true; if(!rec) return; if (Date.now()-t0<500 && !toggleMode){ toggleMode=true; toast(tx('Recording. Tap the mic again to stop.')); return; } if (!toggleMode) stopRec(); };
    mic.onpointerup=lift; mic.onpointercancel=lift;
  } else if (recog) mic.onclick=async()=>{ try{ const a=await Speech.listen(me.lang); if(a[0]) { inp.value=a[0]; upd(); } }catch(e){ toast('Mic not available, please type.'); } };
  else mic.onclick=()=>toast('This browser can\'t record voice notes. Please type instead.');
  // Review before sending: hear it, see what was heard, and (if you typed a phrase first) a pronunciation check.
  async function reviewVoice(note){ const target=inp.value.trim(); const heard=note.heard||[];
    note.transcript = heard[0]||''; const r = target ? Pron.score(heard, target) : null; if (r && r.heard) note.transcript=r.heard;
    if (!recog) note.note='Sent from a browser that can\'t write down speech, so there are no words or translation. Tap play to listen.';
    const url=URL.createObjectURL(note.blob); const au=new Audio(url);
    $('#vPrev').innerHTML=`<div class="wa-prev"><div class="wa-vn"><button class="play" id="vPlay">${I('play')}</button>${Voice.waveHtml(note.wave)}<span class="dur">${Voice.fmt(note.dur)}</span></div>
      ${r?Pron.html(r):note.transcript?`<div class="sub">I heard: “${esc(note.transcript)}”</div>`:`<div class="sub">${recog?'I didn\'t catch any words, but the audio is ready to send.':'This browser can\'t write down speech. The audio still sends, with a note.'}</div>`}
      ${target?'':'<p class="muted small">Tip: type the phrase first, then hold the mic to check how you say it.</p>'}
      <div class="row"><button class="alt" id="vDel">${I('trash')} Delete</button><button class="alt" id="vRetry">${I('retry')} Try again</button><button id="vSend">${I('send')} Send</button></div></div>`;
    $('#vPlay').onclick=()=>{ if(au.paused){ au.play(); $('#vPlay').innerHTML=I('pause'); } else { au.pause(); $('#vPlay').innerHTML=I('play'); } }; au.onended=()=>{ const p=$('#vPlay'); if(p) p.innerHTML=I('play'); };
    if (r && r.pass) Speech.ding();
    $('#vDel').onclick=()=>{ $('#vPrev').innerHTML=''; };
    $('#vRetry').onclick=()=>{ $('#vPrev').innerHTML=''; startRec(); toggleMode=true; };
    $('#vSend').onclick=async()=>{ $('#vSend').disabled=true; try{
        note.tr={}; if (note.transcript) for (const l of otherLangs) { try{ note.tr[l]=(await Promise.race([Translate.run(note.transcript, me.lang, l), new Promise((_,j)=>setTimeout(()=>j(new Error('slow')),5000))])).text; }catch(e){} }
        const key=mk.keys[room.epoch], sealed=await Voice.seal(key, note);
        const meta=await E2E.encrypt(key, JSON.stringify({transcript:note.transcript||'', dur:note.dur, wave:note.wave, note:note.note||'', tr:note.tr}));
        const aid=await RoomServer.putAudio(code, me.id, sealed.audio);
        await RoomServer.send(code, me.id, meta, me.lang, room.epoch, 'voice', aid); window.__forceBottom=true; refresh(); }catch(e){ toast(e.message); $('#vSend').disabled=false; } };
  }
  const sheet=$('#mList'), keepSheet=id=>{ window.__openSheet = id ? code+'|'+id : null; if (!id && window.__pendingRender){ window.__pendingRender=false; roomView(code); } };
  const tog=()=>{ sheet.hidden=!sheet.hidden; if(!sheet.hidden){ const io=$('#invOut'); if(io) io.innerHTML=''; } keepSheet(sheet.hidden?null:'mList'); };
  // Re-renders (new message, block, remove) keep an open sheet open, so taps on it aren't lost.
  if (window.__openSheet===code+'|mList') sheet.hidden=false; else if (window.__openSheet===code+'|lSheet') $('#lSheet').hidden=false;
  const turnOnline=()=>{ Translate.setOnline(true); toast(tx('Online translator on. Messages are sent to MyMemory to translate.')); roomView(code); };
  app.querySelectorAll('.mm-on').forEach(b=>b.onclick=turnOnline);
  { const ls=$('#lShow'), lt=$('#lType'), la=$('#lAsk'); const upd=()=>{ la.hidden = Translate.allowOnline() || (ls.value===me.lang && !room.members.some(x=>x.lang!==ls.value)); }; ls.onchange=upd; lt.onchange=upd; upd(); }
  $('#mBar').onclick=tog; $('#mBar2').onclick=tog; $('#closeSheet').onclick=tog; $('#backList').onclick=()=>{ window.__openSheet=null; location.hash='chat'; };
  const who=$('#who'); if(who) who.onchange=()=>{ const r=myRooms(); r[code].active=who.value; store.set('myrooms',r); roomView(code); };
  app.querySelectorAll('[data-block]').forEach(b=>b.onclick=e=>{ e.stopPropagation(); const id=b.dataset.block, x=blocked(); if (x[id]) delete x[id]; else x[id]=true; store.set('blocked',x);
    // Right away on this phone: hide their bubbles and flip the button, then refresh with the sheet kept open.
    if (x[id]) box.querySelectorAll('.wb[data-from="'+id+'"]').forEach(el=>el.remove());
    b.textContent = x[id]?tx('Unblock'):tx('Block'); b.classList.toggle('on', !!x[id]);
    toast(x[id]?tx("Blocked. You won't see their messages."):tx('Unblocked.')); roomView(code); });
  app.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>reportMember(code, b.dataset.report, Object.values(plainOf).filter(p=>p.from===b.dataset.report).slice(-3).map(p=>p.text)));
  app.querySelectorAll('[data-remove]').forEach(b=>b.onclick=async e=>{ e.stopPropagation(); const who=(room.members.find(x=>x.id===b.dataset.remove)||{}).nick||'';
    if(!confirm(tx('Remove this person from the chat? They lose the key and can\'t come back with their old invite.')+(who?' ('+who+')':''))) return;
    b.disabled=true; try{ await RoomServer.removeMember(code, me.id, b.dataset.remove, true); }catch(err){ b.disabled=false; toast(tx(err.message)); return; }
    const row=b.closest('.mem'); if(row) row.remove();
    try{ await rotateRoomKey(code, me.id); toast(tx('Removed. The chat now has a new secret key.')); }catch(err){ console.warn('rotate', err); toast(tx('Removed. They can no longer open this chat.')); }
    roomView(code); });
  $('#inv').onclick=async()=>{ if (room.members.length>=ROOM_CAP) { toast(tx('This chat is full (15 people).')); return; } const inv=await RoomServer.createInvite(code, me.id); const link=location.origin+location.pathname+'#join/'+room.code+'/'+inv.token+'/'+mk.keys[room.epoch];
    $('#invOut').innerHTML=`<div class="invite"><b>${tx('Invite link for ONE person')}</b> ${tx('(works once, for 24 hours). It also carries the secret key, so share it only with that person:')}<input readonly value="${esc(link)}"><button class="chip" id="copy">${tx('Copy')}</button> <button class="chip" id="invNew">${tx('New link for another person')}</button><p class="muted small">${tx("Also tell them the passcode, in person or by a different way. You'll show as the one who added them.")}</p></div>`; $('#invOut').dataset.tok=inv.token; $('#invNew').onclick=()=>$('#inv').click();
    $('#copy').onclick=()=>{ (navigator.clipboard?navigator.clipboard.writeText(link):Promise.reject()).then(()=>toast(tx('Copied'))).catch(()=>{ $('#invOut input').select(); toast(tx('Select and copy the link')); }); }; };
  const np=$('#newPass'); if(np) np.onclick=async()=>{ const p=prompt(tx('New passcode (at least 4 characters):')); if(!p) return; try{ await RoomServer.changePasscode(code, me.id, p); await rotateRoomKey(code, me.id); toast(tx('Passcode and secret key changed. Old invite links no longer work.')); window.__openSheet=null; roomView(code); }catch(e){ toast(e.message); } };
  const cl=$('#close'); if(cl) cl.onclick=async e=>{ e.stopPropagation(); if(!confirm(tx('Close this chat for everyone? All messages and voice notes will be deleted.'))) return;
    cl.disabled=true; try{ await RoomServer.closeRoom(code, me.id); }catch(err){ cl.disabled=false; toast(tx(err.message)); if(!confirm(tx("Couldn't close the chat on the server:")+' '+tx(err.message)+'\n'+tx('Remove it from this phone anyway?'))) return; }
    window.__openSheet=null; roomUnsubscribe();
    const r=myRooms(); delete r[code]; store.set('myrooms',r); toast(tx('Chat closed for everyone.')); location.hash='chat'; };
  $('#leave').onclick=()=>{ if(!confirm(tx('Leave this chat?'))) return; window.__openSheet=null; const r=myRooms(); delete r[code]; store.set('myrooms',r); location.hash='chat'; };
}
// A report carries a copy of the reported messages, unlocked on the reporter's phone (the server can't read them).
function reportMember(code, member, texts){ const why=prompt(tx('What happened? (A short note helps.)')); if(why===null) return; const r=store.get('reports',[]); r.push({room:code, member, why, copy:texts, at:Date.now()}); store.set('reports',r); toast(tx('Report saved on this phone. Use Block now. Reports will reach the host once chat works across phones.')); }
function terms(part){
  app.innerHTML=`<h2>${tx('Terms, Disclaimer and Privacy')}</h2>
  ${UI_LANG()==='es'?`<div class="card" id="t-es">${I18N.es.terms_summary}</div>`:''}
  <div class="card" id="t-terms"><b>Terms of Use</b><ul>
   <li>Talvoya is free and provided "as is", with no warranty of any kind.</li>
   <li>Chat is for people aged 13 and older only.</li>
   <li>You are responsible for what you send. Follow the chat safety rules: be kind, no bullying, hate or sexual content, and don't share personal info.</li>
   <li>Report abuse with the Report button in any chat. Right now reports are saved only on your phone, so also use Block. Once chat works across phones, reports will reach the chat host (and an app moderator), and reported people can be removed.</li>
   <li>We may change or stop the app at any time.</li></ul></div>
  <div class="card" id="t-disclaimer"><b>Disclaimer</b><ul>
   <li>The app owner is not liable for messages that users send, or for translation mistakes.</li>
   <li>Translations and pronunciation checks are made by machines and may be wrong. Don't rely on them for medical, legal or emergency use.</li>
   <li>Practice characters are made up, not real people.</li>
   <li>Talvoya is an independent project, with no official link to any company, brand or translation service it mentions.</li></ul></div>
  <div class="card" id="t-privacy"><b>Privacy Notice</b><ul>
   <li>We collect no personal info. No email, phone number, birthday or real name.</li>
   <li>Chat uses only a random ID, the nickname you choose, and your yes/no answer to "Are you 13 or older?" (kept on your phone).</li>
   <li>Messages and voice notes are end-to-end encrypted and deleted after ${MSG_DAYS} days, or when the host closes the chat.</li>
   <li>Practice progress stays on your phone.</li>
   <li>The online backup translator (MyMemory) is off for chat unless you turn it on. <a href="#privacy">More privacy details</a></li></ul></div>
  <button class="big alt" onclick="history.back()">${I('back')} Back</button>`;
  const el=part&&$('#t-'+part); if(el) setTimeout(()=>el.scrollIntoView(),0);
}
function privacy(){
  app.innerHTML=`<h2>${tx('Your privacy')}</h2>
  <div class="card"><b>${tx('Practice (scenes and cards)')}</b><p>${tx('Your progress, stars, streak and saved phrases stay <b>only on this device</b>. Nobody else sees them. Clearing your browser removes them.')}</p></div>
  <div class="card"><b>${tx('Practice characters')}</b><p>${tx('Anna, Leo, Mia and the others are pretend characters. You are not talking to real people there.')}</p></div>
  <div class="card"><b>${tx('Talk to a real person')}</b><p>${tx('We only ask for a <b>nickname</b>, never your phone number, email or real name. Messages are end-to-end encrypted: they are locked on your device, and only people in the chat (who got the secret key in their invite link) can unlock them. The server only keeps locked text.')} ${tx('Messages are deleted after')} <b>${MSG_DAYS} ${tx('days')}</b>${tx(', or straight away when the owner closes the chat. You can block, report or leave at any time, and the owner can remove anyone. When the owner removes someone or changes the passcode, the chat gets a <b>new secret key</b> that is sent only to the people still in the chat, so a removed person can\'t read new messages. They can still keep anything they already saw, and old invite links stop working.')}</p></div>
  <div class="card"><b>${tx('Translation')}</b><p>${tx('Your browser\'s own translator is used first, on your device. Some phones, like iPhone, don\'t have one. For chat messages, the free online MyMemory service is <b>off by default</b>. It turns on when you turn it on below, tap Turn on in a chat, or pick a different \'Show messages in\' language. When it\'s on, messages your phone can\'t translate are sent as plain text to MyMemory.')}</p>${onlineToggle()}</div>
  <div class="card"><b>${tx('Auto-translated languages')}</b><p>${tx('To build lessons for a new language, the app\'s English lesson lines (not your messages) are sent to the translator once.')}</p>${packToggle()}</div>
  <div class="card"><b>${tx('Connection')}</b><p>${tx('The app only runs over a secure (HTTPS) connection.')}</p></div>
  <button class="big alt" onclick="history.back()">${I('back')} ${tx('Back')}</button>`; bindOnline();
}
boot();
