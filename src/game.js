const WORLD = 3000;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const BOT_NAMES = ['Raze', 'Karma', 'Vex', 'Nomad', 'Talon', 'Riot', 'Hex', 'Wraith', 'Rook', 'Sable', 'Falcon', 'Knox', 'Jinx', 'Blitz', 'Onyx', 'Drift', 'Reaper', 'Echo', 'Cobra', 'Frost', 'Havoc', 'Mako', 'Ronin', 'Zero'];
const WEAPONS = {
  raven: { id: 'raven', name: 'RAVEN AR', damage: 24, rate: .111, mag: 30, speed: 1250, range: 780, spread: .045, reload: 1.65, auto: true, color: '#ffd083' },
  viper: { id: 'viper', name: 'VIPER SMG', damage: 17, rate: .077, mag: 36, speed: 1150, range: 540, spread: .075, reload: 1.4, auto: true, color: '#8de1d8' },
  longbow: { id: 'longbow', name: 'LONGBOW DMR', damage: 52, rate: .285, mag: 12, speed: 1600, range: 1150, spread: .016, reload: 2.05, auto: false, color: '#efc976' },
};
const cloneWeapon = id => ({ ...WEAPONS[id], ammo: WEAPONS[id].mag, reserve: id === 'longbow' ? 48 : 120 });

class SoundEngine {
  constructor(muted) { this.muted = muted; this.ctx = null; }
  init() { if (!this.ctx && !this.muted) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } }
  tone(freq, duration, type = 'sine', volume = .04, slide = 0) {
    if (this.muted) return; this.init(); if (!this.ctx) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + duration);
  }
  shot(kind) { this.tone(kind === 'longbow' ? 150 : 110, .09, 'sawtooth', .045, -65); this.tone(850, .035, 'square', .012, -500); }
  hit() { this.tone(560, .045, 'square', .025, -140); }
  pickup() { this.tone(520, .08, 'sine', .04, 220); setTimeout(() => this.tone(790, .1, 'sine', .025, 100), 65); }
  reload() { this.tone(240, .04, 'square', .018, 50); }
  ability() { this.tone(220, .3, 'sawtooth', .035, 650); }
  eliminate() { this.tone(360, .09, 'square', .035, 160); setTimeout(() => this.tone(640, .15, 'square', .025, 180), 90); }
}

export class Battleground {
  constructor(root, config, callbacks) {
    this.root = root; this.config = config; this.cb = callbacks; this.sound = new SoundEngine(config.muted);
    this.abort = new AbortController(); this.keys = {}; this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.running = true; this.paused = false; this.ended = false; this.time = 0; this.last = performance.now(); this.kills = 0; this.feed = []; this.particles = []; this.bullets = []; this.floaters = []; this.obstacles = []; this.decor = []; this.loot = [];
    this.zone = { x: WORLD / 2, y: WORLD / 2, r: 1780, fromR: 1780, targetR: 1780, fromX: WORLD / 2, fromY: WORLD / 2, targetX: WORLD / 2, targetY: WORLD / 2, phase: 0, timer: config.mode === 'blitz' ? 15 : 25, shrinking: false };
    this.camera = { x: WORLD / 2, y: WORLD / 2, shake: 0 };
    this.buildDOM(); this.buildWorld(); this.bind(); this.resize(); this.announce('DROP COMPLETE', 'LOOT. HUNT. SURVIVE.', 'BLACKOUT ISLAND // SOLO');
    this.frame = requestAnimationFrame(t => this.loop(t));
  }

  buildDOM() {
    const { icon, operator } = { icon: this.cb.icon, operator: this.config.operator };
    this.root.innerHTML = `<canvas class="game-canvas" aria-label="Ashfall battleground"></canvas><div class="game-ui">
      <div class="match-top"><div class="match-brand"><svg viewBox="0 0 42 42"><path d="M4 34 17 6h9l12 28H27l-2-6h-9l-3 6zm15-14h4l-2-7z"/></svg><span><b>ASHFALL</b><small>BLACKOUT ISLAND</small></span></div><div class="match-stats"><div class="match-stat"><small>ALIVE</small><b id="alive-count">24</b></div><div class="match-stat"><small>ELIMINATIONS</small><b id="kill-count">0</b></div><div class="match-stat"><small>MATCH TIME</small><b id="match-time">00:00</b></div></div><button class="pause-button" aria-label="Pause">Ⅱ</button></div>
      <div class="zone-status">${icon('shield')}<small id="zone-label">SAFE ZONE STABLE</small><b id="zone-time">00:25</b></div>
      <div class="minimap-wrap"><canvas class="minimap" width="180" height="180"></canvas><span class="map-label">BLACKOUT ISLAND</span><span class="map-coords">N 34° // E 118°</span></div><div class="kill-feed"></div>
      <div class="match-announcement"><small></small><h2></h2><p></p></div><div class="outside-zone">⚠ RETURN TO THE SAFE ZONE</div><div class="damage-vignette"></div>
      <div class="player-status"><div class="player-name"><span class="player-op-icon">${operator.letter}</span><span><b>${operator.name}</b><small>YOU // LEVEL ${1 + Math.floor(this.kills / 3)}</small></span></div><div class="health-row"><span class="health-number">100</span><div class="health-bars"><div class="armor-track"><i></i></div><div class="health-track"><i></i></div></div></div><div class="status-effects"><span id="armor-label">50 ARMOR</span><span id="dash-label">DASH READY</span></div></div>
      <div class="weapon-hud"><div class="ability-status"><button class="ability-button" title="Operator ability">${icon('bolt')}<kbd>Q</kbd><i class="cooldown"></i></button><small>${operator.skill.toUpperCase()}</small></div><div class="ammo-block"><small>PRIMARY // <span class="fire-mode">AUTO</span></small><div class="ammo-numbers"><b>30</b><span> / 120</span></div><div class="weapon-name">RAVEN AR</div><div class="reload-label"></div><div class="weapon-slots"><button class="weapon-slot active" data-slot="0">1 // ${this.config.weapon.name}</button><button class="weapon-slot" data-slot="1" style="display:none">2 // EMPTY</button></div></div></div>
      <div class="interaction-prompt"><kbd>E</kbd><span>COLLECT SUPPLIES</span></div><div class="desktop-hints"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SHIFT</kbd> DASH</span><span><kbd>Q</kbd> ABILITY</span><span><kbd>E</kbd> LOOT</span><span><kbd>R</kbd> RELOAD</span></div>
      <div class="mobile-controls"><div class="move-stick"><i class="stick-knob"></i></div><button class="mobile-fire" aria-label="Fire">${icon('crosshair')}</button><button class="mobile-action dash">DASH</button><button class="mobile-action interact">LOOT</button><button class="mobile-action reload">R</button></div>
    </div>`;
    this.canvas = this.root.querySelector('.game-canvas'); this.ctx = this.canvas.getContext('2d'); this.map = this.root.querySelector('.minimap'); this.mctx = this.map.getContext('2d');
    this.ui = {};
    ['alive-count','kill-count','match-time','zone-label','zone-time','armor-label','dash-label'].forEach(id => this.ui[id] = this.root.querySelector('#' + id));
    this.ui.health = this.root.querySelector('.health-number'); this.ui.healthBar = this.root.querySelector('.health-track i'); this.ui.armorBar = this.root.querySelector('.armor-track i');
    this.ui.ammo = this.root.querySelector('.ammo-numbers b'); this.ui.reserve = this.root.querySelector('.ammo-numbers span'); this.ui.weapon = this.root.querySelector('.weapon-name'); this.ui.reload = this.root.querySelector('.reload-label'); this.ui.mode = this.root.querySelector('.fire-mode');
    this.ui.feed = this.root.querySelector('.kill-feed'); this.ui.announce = this.root.querySelector('.match-announcement'); this.ui.interact = this.root.querySelector('.interaction-prompt'); this.ui.damage = this.root.querySelector('.damage-vignette'); this.ui.outside = this.root.querySelector('.outside-zone'); this.ui.cooldown = this.root.querySelector('.cooldown');
  }

  buildWorld() {
    const spawn = { x: WORLD / 2 + rand(-250, 250), y: WORLD / 2 + rand(-250, 250) };
    // Buildings are added below; the exact spawn is validated after map generation.
    this.player = { ...spawn, r: 16, hp: 100, armor: 50, maxArmor: 100, angle: 0, speed: 235, dead: false, weapons: [cloneWeapon(this.config.weapon.id)], slot: 0, fireCd: 0, reload: 0, dashCd: 0, dashTime: 0, abilityCd: 0, effect: 0, ghost: false, barrier: false, hitFlash: 0 };
    // Named districts give the island readable tactical landmarks.
    const districts = [
      { x: 450, y: 420, name: 'RELAY STATION' }, { x: 2150, y: 430, name: 'DRYDOCK' },
      { x: 420, y: 2050, name: 'ASH QUARRY' }, { x: 2110, y: 2070, name: 'THE FOUNDRY' },
      { x: 1290, y: 1270, name: 'CENTRAL ARRAY' },
    ];
    this.districts = districts;
    districts.forEach((d, di) => {
      for (let i = 0; i < 5; i++) {
        const w = rand(120, 230), h = rand(80, 170), x = d.x + (i % 3) * 235 + rand(-20, 20), y = d.y + Math.floor(i / 3) * 250 + rand(-15, 15);
        this.obstacles.push({ x, y, w, h, type: 'building', tone: di % 2 });
        for (let j = 0; j < 2; j++) this.loot.push(this.makeLoot(x + rand(20, w - 20), y + h + rand(30, 65)));
      }
    });
    for (let i = 0; i < 32; i++) {
      const x = rand(150, WORLD - 250), y = rand(150, WORLD - 250);
      if (Math.hypot(x - spawn.x, y - spawn.y) < 220) continue;
      this.obstacles.push({ x, y, w: rand(45, 75), h: rand(35, 55), type: 'crate' });
    }
    for (let i = 0; i < 210; i++) {
      const x = rand(60, WORLD - 60), y = rand(60, WORLD - 60);
      if (this.obstacles.some(o => x > o.x - 30 && x < o.x + o.w + 30 && y > o.y - 30 && y < o.y + o.h + 30)) continue;
      this.decor.push({ x, y, r: rand(12, 24), type: Math.random() < .68 ? 'tree' : 'rock', shade: Math.random() });
    }
    for (let i = 0; i < 48; i++) {
      let x = rand(100, WORLD - 100), y = rand(100, WORLD - 100), tries = 0;
      while (this.collides(x, y, 16) && tries++ < 20) { x = rand(100, WORLD - 100); y = rand(100, WORLD - 100); }
      this.loot.push(this.makeLoot(x, y));
    }
    const count = this.config.mode === 'blitz' ? 11 : 23;
    this.bots = [];
    for (let i = 0; i < count; i++) {
      let p; do { p = { x: rand(150, WORLD - 150), y: rand(150, WORLD - 150) }; } while (this.collides(p.x, p.y, 20) || dist(p, this.player) < 450);
      this.bots.push({ ...p, r: 15, hp: 100, armor: Math.random() < .55 ? 25 : 0, name: BOT_NAMES[i], dead: false, angle: rand(0, TAU), speed: rand(145, 185), weapon: cloneWeapon(pick(['raven','raven','viper','longbow'])), fireCd: rand(0, 1), reload: 0, think: 0, target: null, wander: rand(0, TAU), skill: rand(.45, .85), strafe: Math.random() < .5 ? -1 : 1, hitFlash: 0 });
    }
    // Keep the drop point clear of generated structures.
    while (this.collides(this.player.x, this.player.y, this.player.r)) {
      this.player.x += 90;
      if (this.player.x > WORLD - 100) { this.player.x = 150; this.player.y += 90; }
    }
    this.planZone();
    // Ensure the opening area immediately offers a useful pickup.
    this.loot.push({ x: this.player.x + 70, y: this.player.y + 30, type: 'armor', amount: 35, bob: 0 });
  }

  makeLoot(x, y) {
    const roll = Math.random();
    if (roll < .20) return { x, y, type: 'medkit', amount: 45, bob: rand(0, TAU) };
    if (roll < .40) return { x, y, type: 'armor', amount: 40, bob: rand(0, TAU) };
    if (roll < .72) return { x, y, type: 'ammo', amount: 60, bob: rand(0, TAU) };
    return { x, y, type: 'weapon', weapon: pick(Object.keys(WEAPONS).filter(w => w !== this.config.weapon.id)), bob: rand(0, TAU) };
  }

  bind() {
    const s = { signal: this.abort.signal };
    window.addEventListener('resize', () => this.resize(), s);
    window.addEventListener('keydown', e => {
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === 'Escape') this.togglePause();
      if (!this.running || this.paused) return;
      if (e.code === 'KeyR') this.reload();
      if (e.code === 'KeyQ') this.ability();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'Digit1') this.switchWeapon(0);
      if (e.code === 'Digit2') this.switchWeapon(1);
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.dash();
    }, s);
    window.addEventListener('keyup', e => this.keys[e.code] = false, s);
    this.canvas.addEventListener('pointermove', e => { const r = this.canvas.getBoundingClientRect(); this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top; }, s);
    this.canvas.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; this.sound.init(); } }, s);
    window.addEventListener('pointerup', e => { if (e.button === 0) this.mouse.down = false; }, s);
    this.canvas.addEventListener('contextmenu', e => e.preventDefault(), s);
    this.root.querySelector('.pause-button').onclick = () => this.togglePause();
    this.root.querySelector('.ability-button').onclick = () => this.ability();
    this.root.querySelectorAll('.weapon-slot').forEach(b => b.onclick = () => this.switchWeapon(+b.dataset.slot));
    const stick = this.root.querySelector('.move-stick'), knob = stick.querySelector('.stick-knob');
    const moveStick = e => { const r = stick.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2, len = Math.hypot(x,y), max = r.width * .32, nx = len ? x / Math.max(len,max) : 0, ny = len ? y / Math.max(len,max) : 0; this.touchMove = { x: nx, y: ny }; knob.style.transform = `translate(${nx * max}px,${ny * max}px)`; };
    stick.addEventListener('pointerdown', e => { stick.setPointerCapture(e.pointerId); moveStick(e); }, s);
    stick.addEventListener('pointermove', e => { if (stick.hasPointerCapture(e.pointerId)) moveStick(e); }, s);
    const endStick = () => { this.touchMove = { x:0, y:0 }; knob.style.transform = ''; };
    stick.addEventListener('pointerup', endStick, s); stick.addEventListener('pointercancel', endStick, s);
    const fire = this.root.querySelector('.mobile-fire');
    fire.addEventListener('pointerdown', e => { e.preventDefault(); this.mouse.down = true; this.mouse.clicked = true; this.mobileFire = true; this.sound.init(); }, s);
    fire.addEventListener('pointerup', () => { this.mouse.down = false; this.mobileFire = false; }, s);
    fire.addEventListener('pointercancel', () => { this.mouse.down = false; this.mobileFire = false; }, s);
    this.root.querySelector('.mobile-action.dash').onclick = () => this.dash();
    this.root.querySelector('.mobile-action.interact').onclick = () => this.interact();
    this.root.querySelector('.mobile-action.reload').onclick = () => this.reload();
    document.addEventListener('visibilitychange', () => { if (document.hidden && !this.ended && !this.paused) this.togglePause(); }, s);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75); this.dpr = dpr;
    this.width = this.root.clientWidth; this.height = this.root.clientHeight;
    this.canvas.width = Math.round(this.width * dpr); this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  collides(x, y, r) {
    if (x < r + 25 || y < r + 25 || x > WORLD - r - 25 || y > WORLD - r - 25) return true;
    return this.obstacles.some(o => x + r > o.x && x - r < o.x + o.w && y + r > o.y && y - r < o.y + o.h);
  }

  move(entity, dx, dy) {
    if (!this.collides(entity.x + dx, entity.y, entity.r)) entity.x += dx;
    if (!this.collides(entity.x, entity.y + dy, entity.r)) entity.y += dy;
  }

  lineClear(a, b) {
    const steps = Math.ceil(dist(a,b) / 45);
    for (let i = 1; i < steps; i++) { const t = i / steps; if (this.obstacles.some(o => lerp(a.x,b.x,t) > o.x && lerp(a.x,b.x,t) < o.x+o.w && lerp(a.y,b.y,t) > o.y && lerp(a.y,b.y,t) < o.y+o.h)) return false; }
    return true;
  }

  loop(now) {
    if (!this.running) return;
    const dt = Math.min((now - this.last) / 1000, .035); this.last = now;
    if (!this.paused && !this.ended) this.update(dt);
    this.draw(); this.frame = requestAnimationFrame(t => this.loop(t));
  }

  update(dt) {
    this.time += dt; const p = this.player;
    p.fireCd -= dt; p.dashCd -= dt; p.abilityCd -= dt; p.effect -= dt; p.hitFlash -= dt;
    if (p.effect <= 0) { p.ghost = false; p.barrier = false; }
    if (p.reload > 0) { p.reload -= dt; if (p.reload <= 0) this.finishReload(p, p.weapons[p.slot]); }
    let dx = (this.keys.KeyD ? 1 : 0) - (this.keys.KeyA ? 1 : 0), dy = (this.keys.KeyS ? 1 : 0) - (this.keys.KeyW ? 1 : 0);
    if (this.touchMove) { dx = this.touchMove.x; dy = this.touchMove.y; }
    const len = Math.hypot(dx,dy) || 1; dx /= len; dy /= len;
    let speed = p.speed * (this.config.operator.id === 'volt' && p.effect > 0 ? 1.55 : 1);
    if (p.dashTime > 0) { p.dashTime -= dt; speed *= 3.4; if (!dx && !dy) { dx = Math.cos(p.angle); dy = Math.sin(p.angle); } }
    this.move(p, dx * speed * dt, dy * speed * dt);
    if (this.mobileFire) {
      const target = this.bots.filter(b => !b.dead && dist(p,b) < p.weapons[p.slot].range && this.lineClear(p,b)).sort((a,b) => dist(p,a)-dist(p,b))[0];
      if (target) p.angle = Math.atan2(target.y-p.y,target.x-p.x);
    } else {
      const wx = this.mouse.x - this.width / 2 + this.camera.x, wy = this.mouse.y - this.height / 2 + this.camera.y;
      p.angle = Math.atan2(wy-p.y, wx-p.x);
    }
    const weapon = p.weapons[p.slot];
    if ((this.mouse.down && weapon.auto) || this.mouse.clicked) this.shoot(p, weapon, true);
    this.mouse.clicked = false;
    this.updateBots(dt); this.updateBullets(dt); this.updateZone(dt); this.updateParticles(dt);
    this.camera.x = lerp(this.camera.x, p.x, 1 - Math.pow(.0003, dt)); this.camera.y = lerp(this.camera.y, p.y, 1 - Math.pow(.0003, dt)); this.camera.shake *= Math.pow(.03, dt);
    const nearby = this.loot.filter(l => dist(l,p) < 60).sort((a,b) => dist(a,p)-dist(b,p))[0]; this.nearbyLoot = nearby || null;
    this.ui.interact.classList.toggle('show', !!nearby);
    if (nearby) this.ui.interact.querySelector('span').textContent = nearby.type === 'weapon' ? `PICK UP ${WEAPONS[nearby.weapon].name}` : `COLLECT ${nearby.type.toUpperCase()}`;
    this.updateUI();
  }

  shoot(owner, weapon, playerOwned = false) {
    if (owner.fireCd > 0 || owner.reload > 0 || owner.dead) return;
    if (weapon.ammo <= 0) { if (playerOwned) this.reload(); return; }
    weapon.ammo--; owner.fireCd = weapon.rate * (playerOwned && this.config.operator.id === 'volt' && owner.effect > 0 ? .72 : 1);
    const spread = weapon.spread * (playerOwned ? 1 : 2.1 - owner.skill), a = owner.angle + rand(-spread,spread);
    this.bullets.push({ x: owner.x + Math.cos(a)*23, y: owner.y + Math.sin(a)*23, px: owner.x, py: owner.y, vx: Math.cos(a)*weapon.speed, vy: Math.sin(a)*weapon.speed, life: weapon.range/weapon.speed, damage: weapon.damage * (playerOwned && owner.ghost ? 1.5 : 1), owner, playerOwned, color: weapon.color });
    if (playerOwned) { owner.ghost = false; this.sound.shot(weapon.id); this.camera.shake = weapon.id === 'longbow' ? 5 : 2; }
    for (let i=0;i<4;i++) this.particles.push({x:owner.x+Math.cos(a)*25,y:owner.y+Math.sin(a)*25,vx:Math.cos(a)*rand(50,130)+rand(-40,40),vy:Math.sin(a)*rand(50,130)+rand(-40,40),life:rand(.05,.14),max:.14,color:'#ffd99a',size:rand(2,5)});
  }

  reload() {
    const p = this.player, w = p.weapons[p.slot];
    if (p.reload > 0 || w.ammo >= w.mag || w.reserve <= 0) return;
    p.reload = w.reload; p.reloadTotal = w.reload; this.sound.reload();
  }
  finishReload(entity, w) { const amount = Math.min(w.mag-w.ammo,w.reserve); w.ammo += amount; w.reserve -= amount; entity.reload = 0; }
  switchWeapon(slot) { if (this.player.weapons[slot] && slot !== this.player.slot) { this.player.slot = slot; this.player.reload = 0; this.updateUI(); this.sound.tone(300,.05,'square',.02,80); } }
  dash() { const p = this.player; if (p.dashCd <= 0 && !p.dead && !this.paused) { p.dashCd = 4; p.dashTime = .18; this.sound.tone(180,.16,'sawtooth',.025,180); for(let i=0;i<12;i++) this.particles.push({x:p.x,y:p.y,vx:rand(-90,90),vy:rand(-90,90),life:.35,max:.35,color:'#a9b9ad',size:rand(2,5)}); } }
  ability() {
    const p = this.player; if (p.abilityCd > 0 || p.dead || this.paused) return;
    p.abilityCd = this.config.operator.id === 'aegis' ? 22 : 18; p.effect = this.config.operator.id === 'phantom' ? 5 : 6;
    if (this.config.operator.id === 'phantom') p.ghost = true;
    if (this.config.operator.id === 'aegis') { p.armor = Math.min(100,p.armor+50); p.barrier = true; }
    this.sound.ability(); this.announce(this.config.operator.skill.toUpperCase(), 'TACTICAL ABILITY ACTIVE', this.config.operator.name + ' // PROTOCOL'); 
    for(let i=0;i<25;i++) this.particles.push({x:p.x,y:p.y,vx:Math.cos(i/25*TAU)*rand(70,170),vy:Math.sin(i/25*TAU)*rand(70,170),life:.6,max:.6,color:this.config.operator.color,size:3});
  }
  interact() {
    const l = this.nearbyLoot; if (!l) return; const p = this.player;
    if (l.type === 'medkit') { if (p.hp >= 100) return; p.hp = Math.min(100,p.hp+l.amount); }
    if (l.type === 'armor') { if (p.armor >= 100) return; p.armor = Math.min(100,p.armor+l.amount); }
    if (l.type === 'ammo') p.weapons.forEach(w => w.reserve += l.amount);
    if (l.type === 'weapon') {
      const w = cloneWeapon(l.weapon);
      if (p.weapons[1]) { const old = p.weapons[1]; p.weapons[1] = w; l.type = 'weapon'; l.weapon = old.id; p.slot = 1; this.sound.pickup(); this.updateUI(); return; }
      p.weapons.push(w); p.slot = 1;
    }
    this.loot.splice(this.loot.indexOf(l),1); this.nearbyLoot = null; this.sound.pickup(); this.updateUI();
  }

  updateBots(dt) {
    const actors = [this.player,...this.bots];
    for (const b of this.bots) {
      if (b.dead) continue; b.fireCd -= dt; b.think -= dt; b.hitFlash -= dt;
      if (b.reload > 0) { b.reload -= dt; if (b.reload <= 0) this.finishReload(b,b.weapon); }
      if (b.think <= 0) {
        b.think = rand(.18,.35);
        const candidates = actors.filter(a => a !== b && !a.dead && !(a === this.player && a.ghost) && dist(a,b) < b.weapon.range*.85 && this.lineClear(a,b));
        b.target = candidates.sort((a,c) => dist(a,b)-dist(c,b))[0] || null;
        if (Math.random()<.15) b.strafe *= -1;
      }
      let dx=0,dy=0;
      if (b.target && !b.target.dead) {
        const d=dist(b,b.target), a=Math.atan2(b.target.y-b.y,b.target.x-b.x); b.angle=a;
        if (d>260) { dx+=Math.cos(a); dy+=Math.sin(a); }
        if (d<130) { dx-=Math.cos(a); dy-=Math.sin(a); }
        dx+=Math.cos(a+Math.PI/2)*b.strafe*.6; dy+=Math.sin(a+Math.PI/2)*b.strafe*.6;
        if (Math.random() < b.skill*.92) this.shoot(b,b.weapon);
        if (b.weapon.ammo<=0 && b.reload<=0) { b.reload=b.weapon.reload; }
      } else {
        const zd = Math.hypot(b.x-this.zone.x,b.y-this.zone.y);
        if (zd > this.zone.r*.76) b.wander = Math.atan2(this.zone.y-b.y,this.zone.x-b.x)+rand(-.25,.25);
        else if (Math.random()<.015) b.wander += rand(-1,1);
        dx=Math.cos(b.wander);dy=Math.sin(b.wander);b.angle=b.wander;
      }
      const l=Math.hypot(dx,dy)||1; this.move(b,dx/l*b.speed*dt,dy/l*b.speed*dt);
      if (this.collides(b.x+Math.cos(b.wander)*30,b.y+Math.sin(b.wander)*30,b.r)) b.wander+=Math.PI*.65;
      const outside=Math.hypot(b.x-this.zone.x,b.y-this.zone.y)>this.zone.r;
      if(outside) this.damage(b,(2.5+this.zone.phase*1.7)*dt,null,false);
    }
  }

  updateBullets(dt) {
    const actors = [this.player,...this.bots];
    for (let i=this.bullets.length-1;i>=0;i--) {
      const b=this.bullets[i]; b.px=b.x;b.py=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
      let remove=b.life<=0 || b.x<0||b.y<0||b.x>WORLD||b.y>WORLD;
      if(!remove && this.obstacles.some(o=>b.x>o.x&&b.x<o.x+o.w&&b.y>o.y&&b.y<o.y+o.h)) { remove=true;this.impact(b.x,b.y,'#a9a48e',4); }
      if(!remove) for(const a of actors) {
        if(a.dead||a===b.owner)continue;
        if(Math.hypot(a.x-b.x,a.y-b.y)<a.r+4) {
          this.damage(a,b.damage,b.owner,true);remove=true;this.impact(b.x,b.y,a===this.player?'#ff6b4c':'#e9c699',7);break;
        }
      }
      if(remove)this.bullets.splice(i,1);
    }
  }

  damage(target, amount, attacker, feedback) {
    if(target.dead)return;
    if(target===this.player&&target.barrier)amount*=.55;
    if(target.armor>0){const absorbed=Math.min(target.armor,amount*.7);target.armor-=absorbed;amount-=absorbed;}
    target.hp-=amount;target.hitFlash=.12;
    if(target===this.player&&feedback){this.ui.damage.style.opacity=.42;setTimeout(()=>{if(this.ui)this.ui.damage.style.opacity=0;},100);this.camera.shake=6;}
    if(attacker===this.player&&feedback){this.sound.hit();this.hitMarker=.12;this.floaters.push({x:target.x,y:target.y-22,text:Math.round(amount),life:.65,color:'#ffe0a1'});}
    if(target.hp<=0)this.eliminate(target,attacker);
  }

  eliminate(target, attacker) {
    target.dead=true;target.hp=0;
    for(let i=0;i<22;i++)this.particles.push({x:target.x,y:target.y,vx:rand(-150,150),vy:rand(-150,150),life:rand(.35,.8),max:.8,color:target===this.player?'#ff6343':'#a9b5a6',size:rand(2,5)});
    if(target!==this.player){this.loot.push(this.makeLoot(target.x+rand(-15,15),target.y+rand(-15,15)));}
    if(attacker===this.player){this.kills++;this.sound.eliminate();this.addFeed(`YOU <b>ELIMINATED</b> ${target.name}`,true);}
    else if(attacker&&target!==this.player)this.addFeed(`${attacker===this.player?'YOU':attacker.name} <b>ELIMINATED</b> ${target.name}`,false);
    else if(target!==this.player)this.addFeed(`${target.name} <b>LOST TO THE STORM</b>`,false);
    if(target===this.player){this.addFeed(`${attacker?.name||'THE STORM'} <b>ELIMINATED</b> YOU`,false);setTimeout(()=>this.finish(false),700);}
    else if(this.bots.every(b=>b.dead)&&!this.player.dead)setTimeout(()=>this.finish(true),700);
  }

  addFeed(html,player){this.feed.unshift({html,player,time:this.time});this.feed=this.feed.slice(0,5);this.ui.feed.innerHTML=this.feed.map(f=>`<div class="kill-line ${f.player?'player':''}">${f.html}</div>`).join('');}

  updateZone(dt) {
    const z=this.zone,p=this.player;z.timer-=dt;
    if(z.timer<=0){
      if(!z.shrinking){z.shrinking=true;z.timer=this.config.mode==='blitz'?12:18;z.fromR=z.r;z.fromX=z.x;z.fromY=z.y;this.announce('ZONE COLLAPSING', 'MOVE TO THE SAFE AREA', `PHASE ${z.phase+1} // STORM SURGE`);}
      else {z.shrinking=false;z.phase++;z.r=z.targetR;z.x=z.targetX;z.y=z.targetY;z.timer=this.config.mode==='blitz'?10:Math.max(10,23-z.phase*2);if(z.r<80){z.targetR=0;}else this.planZone();}
    }
    if(z.shrinking){const duration=this.config.mode==='blitz'?12:18,t=clamp(1-z.timer/duration,0,1);z.r=lerp(z.fromR,z.targetR,t);z.x=lerp(z.fromX,z.targetX,t);z.y=lerp(z.fromY,z.targetY,t);}
    if(Math.hypot(p.x-z.x,p.y-z.y)>z.r){this.damage(p,(2.5+z.phase*1.7)*dt,null,false);this.ui.outside.classList.add('show');}else this.ui.outside.classList.remove('show');
  }
  planZone(){const z=this.zone;z.targetR=Math.max(55,z.r*.66);const max=Math.max(0,z.r-z.targetR)*.65,a=rand(0,TAU),d=rand(0,max);z.targetX=clamp(z.x+Math.cos(a)*d,z.targetR,WORLD-z.targetR);z.targetY=clamp(z.y+Math.sin(a)*d,z.targetR,WORLD-z.targetR);}

  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.pow(.06,dt);p.vy*=Math.pow(.06,dt);p.life-=dt;if(p.life<=0)this.particles.splice(i,1);}for(let i=this.floaters.length-1;i>=0;i--){this.floaters[i].y-=25*dt;this.floaters[i].life-=dt;if(this.floaters[i].life<=0)this.floaters.splice(i,1);}this.hitMarker=Math.max(0,(this.hitMarker||0)-dt);}
  impact(x,y,color,n){for(let i=0;i<n;i++)this.particles.push({x,y,vx:rand(-120,120),vy:rand(-120,120),life:rand(.15,.4),max:.4,color,size:rand(1,3)});}

  updateUI() {
    const p=this.player,w=p.weapons[p.slot],alive=this.bots.filter(b=>!b.dead).length+(p.dead?0:1);
    this.ui['alive-count'].textContent=alive;this.ui['kill-count'].textContent=this.kills;this.ui['match-time'].textContent=fmt(this.time);
    this.ui.health.textContent=Math.ceil(p.hp);this.ui.healthBar.style.width=p.hp+'%';this.ui.armorBar.style.width=p.armor+'%';this.ui['armor-label'].textContent=Math.ceil(p.armor)+' ARMOR';
    this.ui['dash-label'].textContent=p.dashCd<=0?'DASH READY':`DASH ${p.dashCd.toFixed(1)}S`;
    this.ui.ammo.textContent=w.ammo;this.ui.reserve.textContent=' / '+w.reserve;this.ui.weapon.textContent=w.name;this.ui.mode.textContent=w.auto?'AUTO':'SEMI';
    this.ui.reload.textContent=p.reload>0?`RELOADING ${Math.ceil(p.reload*10)/10}s`:'';
    this.ui['zone-label'].textContent=this.zone.shrinking?'ZONE COLLAPSING':this.zone.r<100?'FINAL ZONE':'NEXT COLLAPSE';this.ui['zone-time'].textContent=fmt(this.zone.timer);
    this.root.querySelector('.zone-status').classList.toggle('danger',this.zone.shrinking);
    this.ui.cooldown.style.transform=`scaleY(${clamp(p.abilityCd/(this.config.operator.id==='aegis'?22:18),0,1)})`;
    this.root.querySelectorAll('.weapon-slot').forEach((el,i)=>{el.classList.toggle('active',i===p.slot);if(i===1){el.style.display=p.weapons[1]?'block':'none';if(p.weapons[1])el.textContent='2 // '+p.weapons[1].name;}});
  }

  announce(title, subtitle, eyebrow) { const el=this.ui.announce;el.querySelector('h2').textContent=title;el.querySelector('p').textContent=subtitle;el.querySelector('small').textContent=eyebrow;el.classList.add('show');clearTimeout(this.announceTimer);this.announceTimer=setTimeout(()=>el.classList.remove('show'),2600); }

  draw() {
    const c=this.ctx,w=this.width,h=this.height,p=this.player;
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);c.fillStyle='#18211d';c.fillRect(0,0,w,h);
    const shake=this.camera.shake, sx=rand(-shake,shake),sy=rand(-shake,shake);
    c.save();c.translate(w/2-this.camera.x+sx,h/2-this.camera.y+sy);
    this.drawTerrain(c);
    // Next-zone target and safe-zone boundaries.
    if(this.zone.targetR<this.zone.fromR||this.zone.targetR<this.zone.r){c.beginPath();c.arc(this.zone.targetX,this.zone.targetY,this.zone.targetR,0,TAU);c.strokeStyle='#d9eee3aa';c.lineWidth=3;c.setLineDash([12,12]);c.stroke();c.setLineDash([]);}
    this.drawLoot(c);
    const sorted=[...this.decor.filter(d=>d.type==='tree'),...this.bots.filter(b=>!b.dead),p].sort((a,b)=>a.y-b.y);
    for(const e of sorted){if(e.type==='tree')this.drawTree(c,e);else this.drawActor(c,e,e===p);}
    this.drawBullets(c);this.drawParticles(c);
    // Ash storm outside the current circle.
    c.beginPath();c.rect(this.camera.x-w/2-100,this.camera.y-h/2-100,w+200,h+200);c.arc(this.zone.x,this.zone.y,this.zone.r,0,TAU,true);c.fillStyle='rgba(101,38,52,.32)';c.fill('evenodd');
    c.beginPath();c.arc(this.zone.x,this.zone.y,this.zone.r,0,TAU);c.strokeStyle='#f0767388';c.lineWidth=5;c.stroke();
    c.restore();this.drawCrosshair(c);this.drawMinimap();
  }

  visible(x,y,pad=100){return Math.abs(x-this.camera.x)<this.width/2+pad&&Math.abs(y-this.camera.y)<this.height/2+pad;}
  drawTerrain(c) {
    const left=this.camera.x-this.width/2-100,top=this.camera.y-this.height/2-100;
    c.fillStyle='#222d26';c.fillRect(0,0,WORLD,WORLD);
    c.strokeStyle='#ffffff05';c.lineWidth=1;const grid=100;for(let x=Math.max(0,Math.floor(left/grid)*grid);x<Math.min(WORLD,left+this.width+200);x+=grid){c.beginPath();c.moveTo(x,Math.max(0,top));c.lineTo(x,Math.min(WORLD,top+this.height+200));c.stroke();}for(let y=Math.max(0,Math.floor(top/grid)*grid);y<Math.min(WORLD,top+this.height+200);y+=grid){c.beginPath();c.moveTo(Math.max(0,left),y);c.lineTo(Math.min(WORLD,left+this.width+200),y);c.stroke();}
    c.strokeStyle='#343d32';c.lineWidth=100;c.beginPath();c.moveTo(0,1500);c.lineTo(WORLD,1500);c.moveTo(1500,0);c.lineTo(1500,WORLD);c.stroke();c.strokeStyle='#a4a48315';c.lineWidth=2;c.setLineDash([25,25]);c.beginPath();c.moveTo(0,1500);c.lineTo(WORLD,1500);c.moveTo(1500,0);c.lineTo(1500,WORLD);c.stroke();c.setLineDash([]);
    for(const d of this.districts){if(!this.visible(d.x+200,d.y+100,400))continue;c.fillStyle='#c5cec312';c.font='700 20px "Barlow Condensed"';c.fillText(d.name,d.x,d.y-35);c.fillStyle='#b5c0b522';c.font='8px "JetBrains Mono"';c.fillText('RESTRICTED COMBAT AREA',d.x,d.y-20);}
    for(const o of this.obstacles){if(!this.visible(o.x+o.w/2,o.y+o.h/2,250))continue;
      c.fillStyle='#0005';c.fillRect(o.x+12,o.y+14,o.w,o.h);
      if(o.type==='building'){c.fillStyle=o.tone?'#414945':'#4a4a42';c.fillRect(o.x,o.y,o.w,o.h);c.strokeStyle='#70746a';c.lineWidth=2;c.strokeRect(o.x,o.y,o.w,o.h);c.fillStyle='#252d29';c.fillRect(o.x+10,o.y+10,o.w-20,o.h-20);c.strokeStyle='#ffffff12';c.lineWidth=1;for(let x=o.x+18;x<o.x+o.w-10;x+=24){c.beginPath();c.moveTo(x,o.y+10);c.lineTo(x,o.y+o.h-10);c.stroke();}c.fillStyle='#7b5e43';c.fillRect(o.x+o.w*.45,o.y+o.h-5,28,8);c.fillStyle='#aeb5a440';c.font='7px "JetBrains Mono"';c.fillText('SECTOR '+Math.floor(o.x/100),o.x+13,o.y+23);
      }else{c.fillStyle='#5c5845';c.fillRect(o.x,o.y,o.w,o.h);c.strokeStyle='#8c8060';c.strokeRect(o.x,o.y,o.w,o.h);c.beginPath();c.moveTo(o.x,o.y);c.lineTo(o.x+o.w,o.y+o.h);c.moveTo(o.x+o.w,o.y);c.lineTo(o.x,o.y+o.h);c.stroke();}
    }
    for(const d of this.decor){if(d.type==='rock'&&this.visible(d.x,d.y)){c.fillStyle='#10171366';c.beginPath();c.ellipse(d.x+6,d.y+8,d.r,d.r*.7,0,0,TAU);c.fill();c.fillStyle=d.shade>.5?'#596057':'#454e47';c.beginPath();c.moveTo(d.x-d.r,d.y+d.r*.4);c.lineTo(d.x-d.r*.6,d.y-d.r*.6);c.lineTo(d.x+d.r*.3,d.y-d.r);c.lineTo(d.x+d.r,d.y+d.r*.5);c.closePath();c.fill();}}
    c.strokeStyle='#667066';c.lineWidth=5;c.strokeRect(15,15,WORLD-30,WORLD-30);
  }
  drawTree(c,d){c.fillStyle='#0c140e66';c.beginPath();c.ellipse(d.x+8,d.y+10,d.r*1.1,d.r*.7,0,0,TAU);c.fill();c.fillStyle='#3d3225';c.fillRect(d.x-3,d.y-2,6,d.r);for(let i=0;i<3;i++){c.fillStyle=['#233b2b','#2c4732','#35503a'][i];c.beginPath();c.arc(d.x+(i-1)*d.r*.35,d.y-i*5,d.r*(1-i*.14),0,TAU);c.fill();}}
  drawLoot(c){for(const l of this.loot){if(!this.visible(l.x,l.y))continue;const colors={medkit:'#79d59c',armor:'#72bcd3',ammo:'#e8c469',weapon:'#df8cff'},color=colors[l.type];const pulse=1+Math.sin(this.time*3+l.bob)*.15;c.strokeStyle=color+'55';c.lineWidth=1;c.beginPath();c.arc(l.x,l.y,17*pulse,0,TAU);c.stroke();c.fillStyle=color+'22';c.beginPath();c.arc(l.x,l.y,12,0,TAU);c.fill();c.fillStyle=color;c.fillRect(l.x-5,l.y-5,10,10);c.fillStyle='#102018';c.font='700 7px "JetBrains Mono"';c.textAlign='center';c.fillText(l.type==='medkit'?'+':l.type==='armor'?'A':l.type==='ammo'?'•':'W',l.x,l.y+2);c.textAlign='left';}}
  drawActor(c,a,isPlayer){if(!this.visible(a.x,a.y))return;c.save();c.translate(a.x,a.y);c.rotate(a.angle);if(isPlayer&&a.ghost)c.globalAlpha=.28;c.fillStyle='#0007';c.beginPath();c.ellipse(3,7,19,13,0,0,TAU);c.fill();if(isPlayer){c.strokeStyle=this.config.operator.color;c.lineWidth=2;c.beginPath();c.arc(0,0,22,0,TAU);c.stroke();}c.fillStyle=a.hitFlash>0?'#fff':isPlayer?'#d7ddd3':'#8b5145';c.beginPath();c.arc(0,0,a.r,0,TAU);c.fill();c.fillStyle=isPlayer?'#34443d':'#492f2c';c.beginPath();c.arc(-3,0,10,0,TAU);c.fill();c.fillStyle=isPlayer?this.config.operator.color:'#d5b8a4';c.fillRect(3,-5,25,10);c.fillStyle='#252b29';c.fillRect(14,-3,20,6);c.restore();if(!isPlayer){c.fillStyle='#07100bbb';c.fillRect(a.x-22,a.y-34,44,4);c.fillStyle='#e16b54';c.fillRect(a.x-22,a.y-34,44*a.hp/100,4);c.fillStyle='#d6d8cf';c.font='7px "JetBrains Mono"';c.textAlign='center';c.fillText(a.name.toUpperCase(),a.x,a.y-40);c.textAlign='left';}else if(a.barrier){c.strokeStyle='#e9bf6588';c.lineWidth=3;c.beginPath();c.arc(a.x,a.y,27,0,TAU);c.stroke();}}
  drawBullets(c){c.lineCap='round';for(const b of this.bullets){c.strokeStyle=b.color;c.lineWidth=2;c.beginPath();c.moveTo(b.px,b.py);c.lineTo(b.x,b.y);c.stroke();}c.lineCap='butt';}
  drawParticles(c){for(const p of this.particles){c.globalAlpha=clamp(p.life/p.max,0,1);c.fillStyle=p.color;c.fillRect(p.x-p.size/2,p.y-p.size/2,p.size,p.size);}c.globalAlpha=1;for(const f of this.floaters){c.globalAlpha=clamp(f.life/.3,0,1);c.fillStyle=f.color;c.font='700 13px "Barlow Condensed"';c.textAlign='center';c.fillText(f.text,f.x,f.y);}c.globalAlpha=1;c.textAlign='left';}
  drawCrosshair(c){if(matchMedia('(pointer:coarse)').matches)return;const x=this.mouse.x,y=this.mouse.y;c.strokeStyle=this.hitMarker>0?'#ff6445':'#e8eee4bb';c.lineWidth=1.5;const gap=this.hitMarker>0?4:7,len=6;c.beginPath();c.moveTo(x-gap-len,y);c.lineTo(x-gap,y);c.moveTo(x+gap,y);c.lineTo(x+gap+len,y);c.moveTo(x,y-gap-len);c.lineTo(x,y-gap);c.moveTo(x,y+gap);c.lineTo(x,y+gap+len);c.stroke();if(this.hitMarker>0){c.beginPath();c.moveTo(x-7,y-7);c.lineTo(x-2,y-2);c.moveTo(x+7,y-7);c.lineTo(x+2,y-2);c.moveTo(x-7,y+7);c.lineTo(x-2,y+2);c.moveTo(x+7,y+7);c.lineTo(x+2,y+2);c.stroke();}}
  drawMinimap(){const c=this.mctx,w=this.map.width,h=this.map.height,s=w/WORLD;c.clearRect(0,0,w,h);c.fillStyle='#1d2922';c.fillRect(0,0,w,h);c.strokeStyle='#4b574455';c.lineWidth=7*s*10;c.beginPath();c.moveTo(0,1500*s);c.lineTo(w,1500*s);c.moveTo(1500*s,0);c.lineTo(1500*s,h);c.stroke();c.fillStyle='#667066';for(const o of this.obstacles)if(o.type==='building')c.fillRect(o.x*s,o.y*s,Math.max(1,o.w*s),Math.max(1,o.h*s));c.strokeStyle='#e4767199';c.lineWidth=1.5;c.beginPath();c.arc(this.zone.x*s,this.zone.y*s,this.zone.r*s,0,TAU);c.stroke();c.strokeStyle='#e8eee0';c.setLineDash([3,3]);c.beginPath();c.arc(this.zone.targetX*s,this.zone.targetY*s,this.zone.targetR*s,0,TAU);c.stroke();c.setLineDash([]);for(const b of this.bots){if(!b.dead&&dist(b,this.player)<500){c.fillStyle='#e26b53';c.beginPath();c.arc(b.x*s,b.y*s,2,0,TAU);c.fill();}}c.save();c.translate(this.player.x*s,this.player.y*s);c.rotate(this.player.angle);c.fillStyle='#fff';c.beginPath();c.moveTo(6,0);c.lineTo(-4,-4);c.lineTo(-4,4);c.closePath();c.fill();c.restore();}

  togglePause(){if(this.ended)return;this.paused=!this.paused;this.mouse.down=false;if(this.paused){const el=document.createElement('div');el.className='game-pause';el.innerHTML=`<div class="pause-panel"><span class="eyebrow-text">MATCH SUSPENDED</span><h2>TACTICAL PAUSE</h2><p>The simulation is paused.<br/>Return when you're ready, operator.</p><button class="deploy-button resume"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>BACK TO THE ISLAND</small><b>RESUME MATCH</b></span>${this.cb.icon('arrow')}</button><button class="outline-button quit">ABANDON MATCH</button></div>`;this.root.querySelector('.game-ui').append(el);this.pauseEl=el;el.querySelector('.resume').onclick=()=>this.togglePause();el.querySelector('.quit').onclick=()=>{this.cb.onExit();};}else{this.pauseEl?.remove();this.pauseEl=null;this.last=performance.now();}}

  finish(win){if(this.ended)return;this.ended=true;this.mouse.down=false;const placement=win?1:this.bots.filter(b=>!b.dead).length+1;const xp=this.kills*(this.config.mode==='blitz'?200:100)+(win?1000:Math.max(50,350-placement*10));const result={win,kills:this.kills,placement,xp};this.cb.onFinish(result);const el=document.createElement('div');el.className='game-result';el.innerHTML=`<div class="result-panel"><span class="eyebrow-text">${win?'LAST ONE STANDING':'COMBAT RECORD // MATCH COMPLETE'}</span><h2>${win?'BOOYAH!':'ELIMINATED'}</h2><p>${win?'The island is yours. Outstanding work, operator.':'Every defeat sharpens the next deployment.'}</p><div class="result-placement">#${placement} <small>/ ${this.config.mode==='blitz'?12:24}</small></div><div class="result-stats"><div><small>ELIMINATIONS</small><b>${this.kills}</b></div><div><small>SURVIVED</small><b>${fmt(this.time)}</b></div><div><small>DAMAGE DEALT</small><b>${Math.round(this.kills*115+this.time*.8)}</b></div></div><div class="result-xp">+ ${xp.toLocaleString()} CAREER XP</div><button class="deploy-button redeploy"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>ONE MORE RUN</small><b>REDEPLOY</b></span>${this.cb.icon('arrow')}</button><button class="outline-button lobby">RETURN TO LOBBY</button></div>`;this.root.querySelector('.game-ui').append(el);el.querySelector('.redeploy').onclick=()=>this.cb.onRestart();el.querySelector('.lobby').onclick=()=>this.cb.onExit();}

  destroy(){this.running=false;cancelAnimationFrame(this.frame);clearTimeout(this.announceTimer);this.abort.abort();this.ui=null;}
}
