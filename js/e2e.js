// End-to-end encryption for chat rooms (Web Crypto, AES-GCM 256).
// The room key is made on the creator's device and shared ONLY inside invite links, after the "#"
// (the part of a link browsers never send to any server). The server only ever stores encrypted text.
const E2E = {
  b64u: buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  unb64u: s => { s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; return Uint8Array.from(atob(s), c=>c.charCodeAt(0)); },
  supported(){ return !!(window.crypto && crypto.subtle); },
  async newKey(){ const k = await crypto.subtle.generateKey({name:'AES-GCM', length:256}, true, ['encrypt','decrypt']); return this.b64u(await crypto.subtle.exportKey('raw', k)); },
  _keys:{},
  async _import(k){ return this._keys[k] || (this._keys[k] = await crypto.subtle.importKey('raw', this.unb64u(k), {name:'AES-GCM'}, false, ['encrypt','decrypt'])); },
  async encrypt(keyStr, text){ const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, await this._import(keyStr), new TextEncoder().encode(text));
    return 'e1.'+this.b64u(iv)+'.'+this.b64u(ct); },
  async decrypt(keyStr, blob){ const [v, iv, ct] = String(blob).split('.'); if (v!=='e1') throw new Error('not encrypted');
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv:this.unb64u(iv)}, await this._import(keyStr), this.unb64u(ct)); return new TextDecoder().decode(pt); },
  // Key rotation: every member device has its own ECDH key pair. When the creator removes someone or changes the
  // passcode, a NEW room key is wrapped separately for each remaining member's public key. Removed people get nothing.
  async newPair(){ const k=await crypto.subtle.generateKey({name:'ECDH', namedCurve:'P-256'}, true, ['deriveKey']);
    return {pub: await crypto.subtle.exportKey('jwk', k.publicKey), priv: await crypto.subtle.exportKey('jwk', k.privateKey)}; },
  async _shared(privJwk, pubJwk){ const priv=await crypto.subtle.importKey('jwk', privJwk, {name:'ECDH', namedCurve:'P-256'}, false, ['deriveKey']);
    const pub=await crypto.subtle.importKey('jwk', {kty:pubJwk.kty, crv:pubJwk.crv, x:pubJwk.x, y:pubJwk.y}, {name:'ECDH', namedCurve:'P-256'}, false, []);
    return crypto.subtle.deriveKey({name:'ECDH', public:pub}, priv, {name:'AES-GCM', length:256}, true, ['encrypt','decrypt']); },
  async wrap(myPriv, theirPub, text){ return this.encrypt(this.b64u(await crypto.subtle.exportKey('raw', await this._shared(myPriv, theirPub))), text); },
  async unwrap(myPriv, theirPub, blob){ return this.decrypt(this.b64u(await crypto.subtle.exportKey('raw', await this._shared(myPriv, theirPub))), blob); },
};
