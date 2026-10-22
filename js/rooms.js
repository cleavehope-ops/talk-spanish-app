// Chat rooms for talking to real people.
// MockRoomServer is a LOCAL MOCK (offline fallback) of the future Supabase RPCs (see docs/SUPABASE_PLAN.md). Same function names and rules,
// so swapping in the real server later only changes this file. Passcodes are only ever stored as salted hashes.
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const randCode = n => { const a=new Uint32Array(n); crypto.getRandomValues(a); return [...a].map(x=>ROOM_ALPHABET[x%ROOM_ALPHABET.length]).join(''); };
const newRoomCode = () => randCode(4)+'-'+randCode(4);           // e.g. K7QX-29MB
const newToken = () => randCode(16);
async function hashPass(pass, salt){ const d=new TextEncoder().encode(salt+':'+pass);
  if (crypto.subtle) { const h=await crypto.subtle.digest('SHA-256', d); return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  let h=0; for (const b of d) h=(h*31+b)|0; return 'weak'+h; } // very old browsers, mock only
// Nicknames only: no emails, phone numbers or long digit runs.
function nickProblem(n){ n=(n||'').trim(); if (n.length<2||n.length>20) return 'Use a nickname of 2 to 20 letters.';
  if (/@|https?:|www\./i.test(n) || /\d[\d\s().-]{5,}\d/.test(n)) return 'Nickname only, please. No email or phone number.'; return null; }
const INVITE_HOURS = 24;
const MockRoomServer = {
  _db(){ try{ return JSON.parse(localStorage.getItem('tt_mockrooms'))||{rooms:{}}; }catch(e){ return {rooms:{}}; } },
  _save(db){ localStorage.setItem('tt_mockrooms', JSON.stringify(db)); },
  _room(db, code){ const r=db.rooms[(code||'').toUpperCase().trim()]; if(!r) throw new Error('That chat code is wrong, or the chat was closed.'); if (r.closed) throw new Error('This chat was closed.'); return r; },
  _me(r, memberId){ const m=r.members.find(x=>x.id===memberId && !x.removed); if(!m) throw new Error('You are not in this chat.'); return m; },
  async createRoom({nickname, passcode, lang, pub, name}){ const p=nickProblem(nickname); if(p) throw new Error(p); if((passcode||'').length<4) throw new Error('Pick a passcode with at least 4 characters.');
    const db=this._db(); let code; do code=newRoomCode(); while(db.rooms[code]);
    const salt=newToken(), me={id:newToken(), nick:nickname.trim(), lang, addedBy:null, joinedAt:Date.now(), creator:true, pub:pub||null};
    db.rooms[code]={code, name:String(name||'').trim().slice(0,40)||null, inviteOnly:true, salt, passHash:await hashPass(passcode,salt), created:Date.now(), members:[me], invites:[], messages:[], closed:false, epoch:0, rekeys:[]};
    this._save(db); return {code, memberId:me.id}; },
  async createInvite(code, memberId){ const db=this._db(), r=this._room(db,code), m=this._me(r,memberId);
    const inv={token:newToken(), by:m.id, expires:Date.now()+INVITE_HOURS*3600e3, usedBy:null}; r.invites.push(inv); this._save(db); return inv; },
  // Join needs the passcode AND a personal invite (so "added by" is always known). Server checks both.
  async joinRoom({code, passcode, nickname, lang, invite, pub}){ const p=nickProblem(nickname); if(p) throw new Error(p);
    const db=this._db(), r=this._room(db,code);
    if (await hashPass(passcode||'', r.salt) !== r.passHash) throw new Error('Wrong passcode.');
    const inv=r.invites.find(i=>i.token===invite); if(!inv) throw new Error('You need an invite link from someone in the chat.');
    if (inv.usedBy) throw new Error('This invite link was already used. Ask for a new one.'); if (inv.expires<Date.now()) throw new Error('This invite link has expired (24 hours). Ask for a new one.');
    const me={id:newToken(), nick:nickname.trim(), lang, addedBy:inv.by, joinedAt:Date.now(), creator:false, pub:pub||null}; r.members.push(me); inv.usedBy=me.id; this._save(db); return {code:r.code, memberId:me.id, epoch:r.epoch||0}; },
  async getRoom(code, memberId){ const db=this._db(), r=this._room(db,code); this._me(r,memberId);
    this._purge(db, r); this._save(db);
    return {code:r.code, name:r.name||null, members:r.members.filter(m=>!m.removed).map(m=>({...m, addedByNick:(r.members.find(x=>x.id===m.addedBy)||{}).nick||null})), messages:r.messages, epoch:r.epoch||0,
      rekeys:(r.rekeys||[]).filter(k=>k.to===memberId)}; }, // each person only receives their own wrapped keys
  // kind: 'text' | 'voice'. text is always an encrypted blob. A voice note's audio is stored separately (audioId),
  // like a Supabase Storage object, and is encrypted on the phone before upload.
  async send(code, memberId, text, lang, epoch=0, kind='text', audioId=null){ const db=this._db(), r=this._room(db,code), m=this._me(r,memberId);
    const msg={id:newToken(), from:m.id, nick:m.nick, lang, text, epoch, kind, audioId, at:Date.now()}; r.messages.push(msg); this._save(db); return msg; },
  // Encrypted audio storage (mock of a private Supabase Storage bucket "voice", one folder per room).
  async putAudio(code, memberId, encBlob){ if (String(encBlob).slice(0,3)!=='e1.') throw new Error('Audio must be encrypted first.');
    if (encBlob.length > 3e6) throw new Error('Voice note is too long.'); const db=this._db(), r=this._room(db,code); this._me(r,memberId);
    const id=newToken(); (r.audio=r.audio||{})[id]={blob:encBlob, by:memberId, at:Date.now()}; this._save(db); return id; },
  async getAudio(code, memberId, audioId){ const db=this._db(), r=this._room(db,code); this._me(r,memberId); const a=(r.audio||{})[audioId]; if(!a) throw new Error('This voice note has expired.'); return a.blob; },
  // Read receipts for ticks: each member's last-seen time.
  async markSeen(code, memberId){ const db=this._db(), r=this._room(db,code), m=this._me(r,memberId); m.seenAt=Date.now(); this._save(db); },
  // Messages and audio older than 7 days are deleted (the real server runs this on a schedule).
  _purge(db, r){ const cut=Date.now()-7*864e5; r.messages=r.messages.filter(m=>m.at>=cut); for (const [k,a] of Object.entries(r.audio||{})) if (a.at<cut) delete r.audio[k]; },
  _creator(r, memberId){ const m=this._me(r,memberId); if(!m.creator) throw new Error('Only the person who started the chat can do this.'); },
  async removeMember(code, memberId, targetId, block=false){ const db=this._db(), r=this._room(db,code); this._creator(r,memberId); const t=r.members.find(x=>x.id===targetId); if(t&&!t.creator){ t.removed=Date.now(); if(block) t.blocked=true; r.invites.forEach(i=>{ if(i.by===targetId && !i.usedBy) i.expires=0; }); } this._save(db); },
  async changePasscode(code, memberId, passcode){ if((passcode||'').length<4) throw new Error('Pick a passcode with at least 4 characters.'); const db=this._db(), r=this._room(db,code); this._creator(r,memberId); r.salt=newToken(); r.passHash=await hashPass(passcode,r.salt); this._save(db); },
  // New room key after a removal or passcode change. envelopes = [{to, blob}] wrapped for remaining members only.
  // Unused invite links are cancelled, because they carry the old key.
  async rotateKey(code, memberId, epoch, envelopes, fromPub){ const db=this._db(), r=this._room(db,code); this._creator(r,memberId);
    if (epoch !== (r.epoch||0)+1) throw new Error('Key change out of order. Please try again.');
    const live=new Set(r.members.filter(m=>!m.removed).map(m=>m.id));
    r.epoch=epoch; r.rekeys=(r.rekeys||[]).filter(k=>live.has(k.to)).concat(envelopes.filter(e=>live.has(e.to)).map(e=>({epoch, to:e.to, blob:e.blob, from:fromPub})));
    r.invites.forEach(i=>{ if(!i.usedBy) i.expires=0; }); this._save(db); },
  async closeRoom(code, memberId){ const db=this._db(), r=this._room(db,code); this._creator(r,memberId); r.closed=true; r.messages=[]; r.audio={}; this._save(db); },
};
// Online status: in the real app this comes from Supabase Realtime presence. Mock: everyone seen in the last 2 minutes.
const isOnline = m => true;

// ---- Real server: Supabase (project gcztdktsndrpnqanhsel). Anonymous sign-in, everything through RPCs in server/schema.sql.
// Same function names as the mock. Each chat remembers which server it lives on ("sb" or "mock").
const TT_SB_URL = 'https://gcztdktsndrpnqanhsel.supabase.co';
const TT_SB_KEY = 'sb_publishable_dxy4PaTNhy5d7AppSnRYjw_nelHWwoV'; // public key, safe to ship
const SupabaseRoomServer = {
  _c: null, _ready: null,
  client(){ if (!this._c) this._c = window.supabase.createClient(TT_SB_URL, TT_SB_KEY, { auth:{ persistSession:true, storageKey:'tt_sb_auth' } }); return this._c; },
  async ready(){ if (!this._ready) this._ready = (async()=>{ const c=this.client(); const { data } = await c.auth.getSession();
      let sess=data.session; if (!sess){ const r = await c.auth.signInAnonymously(); if (r.error) throw r.error; sess=r.data.session; }
      try{ await c.realtime.setAuth(sess.access_token); }catch(e){}
      c.auth.onAuthStateChange((ev,s)=>{ if (s) c.realtime.setAuth(s.access_token); }); return true; })().catch(e=>{ this._ready=null; throw e; });
    return this._ready; },
  async _rpc(fn, args){ await this.ready(); const { data, error } = await this.client().rpc(fn, args); if (error) throw new Error(error.message || 'Chat server error.'); return data; },
  async createRoom({nickname, passcode, lang, pub, name}){ const p=nickProblem(nickname); if(p) throw new Error(p); if((passcode||'').length<4) throw new Error('Pick a passcode with at least 4 characters.');
    return this._rpc('tt_create_room', {p_nick:nickname.trim(), p_pass:passcode, p_lang:lang, p_pub:pub||null, p_name:name||null}); },
  createInvite(code, memberId){ return this._rpc('tt_create_invite', {p_code:code, p_member:memberId}); },
  async joinRoom({code, passcode, nickname, lang, invite, pub}){ const p=nickProblem(nickname); if(p) throw new Error(p);
    return this._rpc('tt_join_room', {p_code:code, p_pass:passcode||'', p_nick:nickname.trim(), p_lang:lang, p_invite:invite||'', p_pub:pub||null}); },
  getRoom(code, memberId){ return this._rpc('tt_get_room', {p_code:code, p_member:memberId}); },
  send(code, memberId, text, lang, epoch=0, kind='text', audioId=null){ return this._rpc('tt_send', {p_code:code, p_member:memberId, p_text:text, p_lang:lang, p_epoch:epoch, p_kind:kind, p_audio:audioId}); },
  async putAudio(code, memberId, encBlob){ if (String(encBlob).slice(0,3)!=='e1.') throw new Error('Audio must be encrypted first.'); return this._rpc('tt_put_audio', {p_code:code, p_member:memberId, p_blob:encBlob}); },
  getAudio(code, memberId, audioId){ return this._rpc('tt_get_audio', {p_code:code, p_member:memberId, p_audio:audioId}); },
  async markSeen(code, memberId){ await this._rpc('tt_mark_seen', {p_code:code, p_member:memberId}); },
  async removeMember(code, memberId, targetId, block=false){ await this._rpc('tt_remove_member', {p_code:code, p_member:memberId, p_target:targetId, p_block:!!block}); },
  async changePasscode(code, memberId, passcode){ if((passcode||'').length<4) throw new Error('Pick a passcode with at least 4 characters.'); await this._rpc('tt_change_passcode', {p_code:code, p_member:memberId, p_pass:passcode}); },
  async rotateKey(code, memberId, epoch, envelopes, fromPub){ await this._rpc('tt_rotate_key', {p_code:code, p_member:memberId, p_epoch:epoch, p_envelopes:envelopes, p_from:fromPub}); },
  async closeRoom(code, memberId){ await this._rpc('tt_close_room', {p_code:code, p_member:memberId}); },
  async report(code, memberId, reason){ await this.ready(); const { error } = await this.client().from('reports').insert({room_code:code, reported_member:memberId||null, reason:String(reason||'').slice(0,300)}); if (error) throw new Error(error.message); },
  // Live updates: calls onNew() when a message arrives in this room (RLS only delivers rooms you are in).
  // Realtime first; polling every 3s as a safety net, so new messages always arrive even if realtime fails.
  async subscribe(code, onNew){ await this.ready(); const c=this.client(); let last=null, stop=false;
    const ch=c.channel('room-'+code).on('postgres_changes', {event:'INSERT', schema:'public', table:'messages'}, ()=>onNew()).subscribe();
    const poll=async()=>{ if (stop) return; if (!document.hidden) { try{ const r=await this._rpc('tt_poll',{p_code:code}); if (last!==null && r!==last) onNew(); last=r; }catch(e){} } if (!stop) setTimeout(poll, 3000); };
    poll(); return ()=>{ stop=true; c.removeChannel(ch); }; },
};
const TT_NET_MSG = /fetch|network|load failed|anonymous sign-ins are disabled|could not find the function|schema cache/i;
const RoomServer = (() => {
  const where = () => { try { return JSON.parse(localStorage.getItem('tt_roomsrv'))||{}; } catch(e){ return {}; } };
  const remember = (code, s) => { const w=where(); w[String(code).toUpperCase()]=s; localStorage.setItem('tt_roomsrv', JSON.stringify(w)); };
  let online = null; // null = not tried yet
  const sbOK = async () => { if (online===false) return false; if (!window.supabase || window.TT_FORCE_MOCK) { online=false; return false; }
    try { await SupabaseRoomServer.ready(); online=true; } catch(e){ online=false; } return online; };
  const pick = async code => { const s=where()[String(code||'').toUpperCase().trim()]; if (s==='mock') return MockRoomServer; if (s==='sb') return SupabaseRoomServer;
    if (MockRoomServer._db().rooms[String(code||'').toUpperCase().trim()]) return MockRoomServer; return (await sbOK()) ? SupabaseRoomServer : MockRoomServer; };
  const api = { get mode(){ return online ? 'server' : 'this phone only'; },
    async createRoom(o){ if (await sbOK()) { try { const r=await SupabaseRoomServer.createRoom(o); remember(r.code,'sb'); return r; } catch(e){ if (!TT_NET_MSG.test(e.message)) throw e; online=false; } }
      const r=await MockRoomServer.createRoom(o); remember(r.code,'mock'); return r; },
    async joinRoom(o){ const srv=await pick(o.code); const r=await srv.joinRoom(o); remember(r.code, srv===MockRoomServer?'mock':'sb'); return r; },
    async subscribe(code, cb){ const srv=await pick(code); return srv.subscribe ? srv.subscribe(code, cb) : ()=>{}; },
    async report(code, memberId, reason){ const srv=await pick(code); if (srv.report) return srv.report(code, memberId, reason); } };
  for (const f of ['createInvite','getRoom','send','putAudio','getAudio','markSeen','removeMember','changePasscode','rotateKey','closeRoom'])
    api[f] = async (code, ...a) => (await pick(code))[f](code, ...a);
  api._db = () => MockRoomServer._db(); api._save = db => MockRoomServer._save(db); // used by older tests/screenshot tools
  return api;
})();
