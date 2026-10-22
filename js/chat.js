// Chat "transport". LocalTransport = both people on one screen (demo).
// Later: SupabaseTransport with the same send/onMessage API using a Realtime channel per room.
class LocalTransport {
  constructor(room){ this.room=room; this.subs=[]; }
  onMessage(fn){ this.subs.push(fn); }
  async send(msg){ msg.id = Date.now()+Math.random(); msg.at = new Date().toISOString(); this.subs.forEach(f=>f(msg)); }
}
/* Sketch for later (not active, needs a Supabase project URL + public anon key):
class SupabaseTransport {
  constructor(sb, room){ this.ch = sb.channel('room:'+room); this.subs=[];
    this.ch.on('broadcast',{event:'msg'},({payload})=>this.subs.forEach(f=>f(payload))).subscribe(); }
  onMessage(fn){ this.subs.push(fn); }
  async send(msg){ await this.ch.send({type:'broadcast',event:'msg',payload:msg}); this.subs.forEach(f=>f(msg)); }
}*/
// A message carries only the original text + language; each reader translates into THEIR language.
// TODO (before real rooms): random unguessable room codes, private Realtime channels (RLS / auth),
// a way to block or leave a person, and no listing of open rooms.
