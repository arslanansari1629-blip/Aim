import Peer from 'peerjs';

export const normalizeCallsign = name => String(name || '').trim().toUpperCase().replace(/[^A-Z0-9_ -]/g, '').slice(0, 18);
export const peerIdFor = name => 'ashfall-v1-' + normalizeCallsign(name).toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

/** Serverless WebRTC social graph. PeerJS is only signaling; gameplay data travels peer-to-peer. */
export class SocialNetwork {
  constructor(name, callbacks = {}) {
    this.name = normalizeCallsign(name); this.id = peerIdFor(name); this.cb = callbacks; this.connections = new Map(); this.requests = []; this.matchHandler = null; this.destroyed = false;
    const options = import.meta.env.DEV ? { host: location.hostname, port: 9000, path: '/peerjs', secure: false } : { host: '0.peerjs.com', port: 443, path: '/', secure: true };
    this.peer = new Peer(this.id, options);
    this.peer.on('open', () => this.status('ONLINE', 'connected'));
    this.peer.on('connection', conn => this.attach(conn));
    this.peer.on('disconnected', () => this.status('RECONNECTING', 'warning'));
    this.peer.on('error', error => { const message = error.type === 'unavailable-id' ? 'CALLSIGN ALREADY ONLINE' : error.type === 'peer-unavailable' ? 'PLAYER NOT FOUND OR OFFLINE' : 'NETWORK CONNECTION ISSUE'; this.status(message, 'error'); this.cb.onError?.(message); });
    this.status('CONNECTING', 'connecting');
  }
  status(text, state) { this.state = state; this.cb.onStatus?.(text, state); }
  attach(conn) {
    if (!conn || this.destroyed) return;
    this.connections.set(conn.peer, conn);
    conn.on('data', data => this.receive(conn, data));
    conn.on('close', () => { this.connections.delete(conn.peer); this.cb.onPresence?.(); });
    conn.on('error', () => { this.connections.delete(conn.peer); });
  }
  connect(name) {
    const id = peerIdFor(name); if (id === this.id) throw new Error('THAT IS YOUR CALLSIGN');
    const existing = this.connections.get(id); if (existing?.open) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(id, { reliable: true, serialization: 'json' }); this.attach(conn);
      const timer = setTimeout(() => reject(new Error('PLAYER NOT FOUND OR OFFLINE')), 8000);
      conn.on('open', () => { clearTimeout(timer); resolve(conn); });
      conn.on('error', error => { clearTimeout(timer); reject(error); });
    });
  }
  async sendRequest(name, profile) {
    const conn = await this.connect(name); conn.send({ type: 'friend-request', from: { id: this.id, name: this.name, operator: profile.operator } }); return normalizeCallsign(name);
  }
  receive(conn, data) {
    if (!data?.type) return;
    if (data.type === 'friend-request') {
      if (!this.requests.some(r => r.from.id === data.from.id)) this.requests.push(data); this.cb.onRequests?.(this.requests); return;
    }
    if (data.type === 'friend-accept') { this.cb.onFriendAccepted?.(data.from); return; }
    if (data.type === 'friend-decline') { this.cb.onError?.(`${data.from.name} DECLINED THE REQUEST`); return; }
    if (data.type === 'match-invite') { this.cb.onInvite?.(data); return; }
    if (data.type === 'match-accept') { this.cb.onMatchAccepted?.(data); return; }
    if (data.type.startsWith('match-') || data.type === 'player-state' || data.type === 'bot-hit' || data.type === 'bots-state' || data.type === 'zone-state' || data.type === 'remote-shot' || data.type === 'player-hit') this.matchHandler?.(data);
  }
  async respond(request, accepted, profile) {
    this.requests = this.requests.filter(r => r.from.id !== request.from.id); this.cb.onRequests?.(this.requests);
    const conn = await this.connect(request.from.name); conn.send({ type: accepted ? 'friend-accept' : 'friend-decline', from: { id: this.id, name: this.name, operator: profile.operator } });
  }
  async invite(name, match) { const conn = await this.connect(name); conn.send({ type: 'match-invite', from: { id: this.id, name: this.name, operator: match.operator, weapon: match.weapon }, seed: match.seed, mode: match.mode }); }
  async acceptInvite(invite, profile) { const conn = await this.connect(invite.from.name); conn.send({ type: 'match-accept', from: { id: this.id, name: this.name, operator: profile.operator, weapon: profile.weapon }, seed: invite.seed, mode: invite.mode }); }
  sendMatch(data) { for (const conn of this.connections.values()) if (conn.open) conn.send(data); }
  setMatchHandler(handler) { this.matchHandler = handler; }
  reconnect(name) { this.destroy(); return new SocialNetwork(name, this.cb); }
  destroy() { this.destroyed = true; this.matchHandler = null; for (const conn of this.connections.values()) try { conn.close(); } catch {} this.connections.clear(); try { this.peer.destroy(); } catch {} }
}
