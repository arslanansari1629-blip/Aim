import * as THREE from 'three';

const WORLD = 1600;
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const BOT_NAMES = ['Raze', 'Karma', 'Vex', 'Nomad', 'Talon', 'Riot', 'Hex', 'Wraith', 'Rook', 'Sable', 'Falcon', 'Knox', 'Jinx', 'Blitz', 'Onyx', 'Drift', 'Reaper', 'Echo', 'Cobra', 'Frost', 'Havoc', 'Mako', 'Ronin', 'Zero'];
const WEAPONS = {
  raven: { id: 'raven', name: 'RAVEN AR', damage: 24, rate: .111, mag: 30, speed: 270, range: 190, spread: .018, reload: 1.65, auto: true, color: '#ffd083' },
  viper: { id: 'viper', name: 'VIPER SMG', damage: 17, rate: .077, mag: 36, speed: 245, range: 125, spread: .032, reload: 1.4, auto: true, color: '#8de1d8' },
  longbow: { id: 'longbow', name: 'LONGBOW DMR', damage: 52, rate: .285, mag: 12, speed: 360, range: 330, spread: .005, reload: 2.05, auto: false, color: '#efc976' },
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
  shot(kind) { this.tone(kind === 'longbow' ? 150 : 105, .09, 'sawtooth', .04, -65); this.tone(850, .035, 'square', .01, -500); }
  hit() { this.tone(560, .045, 'square', .025, -140); }
  pickup() { this.tone(520, .08, 'sine', .04, 220); setTimeout(() => this.tone(790, .1, 'sine', .025, 100), 65); }
  reload() { this.tone(240, .04, 'square', .018, 50); }
  ability() { this.tone(220, .3, 'sawtooth', .035, 650); }
  eliminate() { this.tone(360, .09, 'square', .035, 160); setTimeout(() => this.tone(640, .15, 'square', .025, 180), 90); }
}

function groundTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d'); c.fillStyle = '#56604a'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i++) { const v = Math.floor(rand(40, 105)); c.fillStyle = `rgba(${v},${v + 8},${Math.max(20, v - 15)},${rand(.03, .12)})`; c.fillRect(rand(0, 256), rand(0, 256), rand(1, 4), rand(1, 4)); }
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(70, 70); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function createCharacter(color = '#ff6038', enemy = false) {
  const g = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: enemy ? '#4c3130' : '#273632', roughness: .72, metalness: .28 });
  const cloth = new THREE.MeshStandardMaterial({ color: enemy ? '#292625' : '#252d2a', roughness: .95 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: .45, metalness: .35, emissive: new THREE.Color(color), emissiveIntensity: .07 });
  const skin = new THREE.MeshStandardMaterial({ color: '#171e1d', roughness: .4, metalness: .65 });
  const gunMat = new THREE.MeshStandardMaterial({ color: '#181d1d', roughness: .35, metalness: .8 });
  const box = (w, h, d, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  const leftLeg = box(.64, 1.65, .72, cloth, -.43, .88, 0), rightLeg = box(.64, 1.65, .72, cloth, .43, .88, 0);
  box(.75, .25, 1.05, skin, -.43, .16, -.13); box(.75, .25, 1.05, skin, .43, .16, -.13);
  box(1.65, 1.8, .88, armor, 0, 2.45, 0); box(1.74, .32, .99, accent, 0, 2.75, -.02);
  box(.55, .8, .22, armor, -.48, 2.25, -.55); box(.55, .8, .22, armor, .48, 2.25, -.55);
  const leftArm = box(.46, 1.55, .5, cloth, -1.03, 2.43, -.22), rightArm = box(.46, 1.55, .5, cloth, 1.03, 2.43, -.22);
  leftArm.rotation.x = rightArm.rotation.x = -.65;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.65, 12, 8), armor); helmet.position.y = 3.85; helmet.scale.y = .9; helmet.castShadow = true; g.add(helmet);
  box(1.02, .34, .16, skin, 0, 3.89, -.57); box(.76, .10, .04, accent, 0, 3.92, -.67);
  box(.42, .32, .45, armor, 0, 4.40, .05);
  const weapon = new THREE.Group(); weapon.position.set(.58, 2.60, -.68); weapon.rotation.x = -.08; g.add(weapon);
  box(.32, .38, 2.5, gunMat, 0, 0, -1.0, weapon); box(.20, .20, 1.5, skin, 0, .02, -2.7, weapon);
  box(.48, .45, .7, armor, 0, .03, -.2, weapon); box(.22, .72, .48, gunMat, 0, -.48, -.7, weapon);
  box(.18, .22, .6, accent, 0, .30, -.8, weapon);
  g.userData = { leftLeg, rightLeg, leftArm, rightArm, weapon, armor, accent };
  return g;
}

export class Battleground {
  constructor(root, config, callbacks) {
    this.root = root; this.config = config; this.cb = callbacks; this.sound = new SoundEngine(config.muted);
    this.abort = new AbortController(); this.keys = {}; this.mouse = { down: false, clicked: false, ads: false };
    this.running = true; this.paused = false; this.ended = false; this.time = 0; this.last = performance.now(); this.kills = 0; this.feed = [];
    this.bullets = []; this.particles = []; this.obstacles = []; this.loot = []; this.cameraBlockers = []; this.yaw = 0; this.pitch = -.12; this.cameraShake = 0;
    this.zone = { x: 0, z: 0, r: 1100, fromR: 1100, targetR: 1100, fromX: 0, fromZ: 0, targetX: 0, targetZ: 0, phase: 0, timer: config.mode === 'blitz' ? 15 : 25, shrinking: false };
    this.buildDOM(); this.initThree(); this.buildWorld(); this.bind(); this.resize();
    this.announce('3D DROP COMPLETE', 'CLICK THE BATTLEGROUND TO AIM', 'BLACKOUT ISLAND // THIRD-PERSON COMBAT');
    this.frame = requestAnimationFrame(t => this.loop(t));
  }

  buildDOM() {
    const icon = this.cb.icon, operator = this.config.operator;
    this.root.innerHTML = `<div class="three-mount"></div><div class="game-ui">
      <div class="match-top"><div class="match-brand"><svg viewBox="0 0 42 42"><path d="M4 34 17 6h9l12 28H27l-2-6h-9l-3 6zm15-14h4l-2-7z"/></svg><span><b>ASHFALL</b><small>BLACKOUT ISLAND // 3D</small></span></div><div class="match-stats"><div class="match-stat"><small>ALIVE</small><b id="alive-count">24</b></div><div class="match-stat"><small>ELIMINATIONS</small><b id="kill-count">0</b></div><div class="match-stat"><small>MATCH TIME</small><b id="match-time">00:00</b></div></div><button class="pause-button" aria-label="Pause">Ⅱ</button></div>
      <div class="zone-status">${icon('shield')}<small id="zone-label">SAFE ZONE STABLE</small><b id="zone-time">00:25</b></div>
      <div class="minimap-wrap"><canvas class="minimap" width="180" height="180"></canvas><span class="map-label">BLACKOUT ISLAND // 3D</span><span class="map-coords">TACTICAL UPLINK</span></div><div class="kill-feed"></div>
      <div class="aim-crosshair"><i></i><i></i><i></i><i></i><b></b></div><div class="aim-mode">HIP FIRE</div>
      <div class="match-announcement"><small></small><h2></h2><p></p></div><div class="outside-zone">⚠ RETURN TO THE SAFE ZONE</div><div class="damage-vignette"></div>
      <div class="player-status"><div class="player-name"><span class="player-op-icon">${operator.letter}</span><span><b>${operator.name}</b><small>YOU // 3D COMBAT READY</small></span></div><div class="health-row"><span class="health-number">100</span><div class="health-bars"><div class="armor-track"><i></i></div><div class="health-track"><i></i></div></div></div><div class="status-effects"><span id="armor-label">50 ARMOR</span><span id="dash-label">DASH READY</span></div></div>
      <div class="weapon-hud"><div class="ability-status"><button class="ability-button" title="Operator ability">${icon('bolt')}<kbd>Q</kbd><i class="cooldown"></i></button><small>${operator.skill.toUpperCase()}</small></div><div class="ammo-block"><small>PRIMARY // <span class="fire-mode">AUTO</span></small><div class="ammo-numbers"><b>30</b><span> / 120</span></div><div class="weapon-name">RAVEN AR</div><div class="reload-label"></div><div class="weapon-slots"><button class="weapon-slot active" data-slot="0">1 // ${this.config.weapon.name}</button><button class="weapon-slot" data-slot="1" style="display:none">2 // EMPTY</button></div></div></div>
      <div class="interaction-prompt"><kbd>E</kbd><span>COLLECT SUPPLIES</span></div><div class="desktop-hints"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>RMB</kbd> ADS</span><span><kbd>SHIFT</kbd> DASH</span><span><kbd>Q</kbd> ABILITY</span><span><kbd>E</kbd> LOOT</span></div>
      <div class="mobile-controls"><div class="move-stick"><i class="stick-knob"></i></div><button class="mobile-fire" aria-label="Fire">${icon('crosshair')}</button><button class="mobile-action dash">DASH</button><button class="mobile-action interact">LOOT</button><button class="mobile-action reload">R</button></div>
    </div>`;
    this.map = this.root.querySelector('.minimap'); this.mctx = this.map.getContext('2d'); this.ui = {};
    ['alive-count','kill-count','match-time','zone-label','zone-time','armor-label','dash-label'].forEach(id => this.ui[id] = this.root.querySelector('#' + id));
    this.ui.health = this.root.querySelector('.health-number'); this.ui.healthBar = this.root.querySelector('.health-track i'); this.ui.armorBar = this.root.querySelector('.armor-track i');
    this.ui.ammo = this.root.querySelector('.ammo-numbers b'); this.ui.reserve = this.root.querySelector('.ammo-numbers span'); this.ui.weapon = this.root.querySelector('.weapon-name'); this.ui.reload = this.root.querySelector('.reload-label'); this.ui.mode = this.root.querySelector('.fire-mode');
    this.ui.feed = this.root.querySelector('.kill-feed'); this.ui.announce = this.root.querySelector('.match-announcement'); this.ui.interact = this.root.querySelector('.interaction-prompt'); this.ui.damage = this.root.querySelector('.damage-vignette'); this.ui.outside = this.root.querySelector('.outside-zone'); this.ui.cooldown = this.root.querySelector('.cooldown');
    this.ui.crosshair = this.root.querySelector('.aim-crosshair'); this.ui.aimMode = this.root.querySelector('.aim-mode');
  }

  initThree() {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#82928b'); this.scene.fog = new THREE.FogExp2('#7b8980', .00215);
    this.camera = new THREE.PerspectiveCamera(62, 1, .1, 2200);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'game-canvas'; this.renderer.domElement.setAttribute('aria-label', 'Real-time 3D Ashfall battleground');
    this.root.querySelector('.three-mount').append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#d7e6dc', '#313b2c', 2.2));
    const sun = new THREE.DirectionalLight('#ffe4bc', 3.4); sun.position.set(-160, 240, 90); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -150; sun.shadow.camera.right = sun.shadow.camera.top = 150; sun.shadow.camera.far = 650; sun.shadow.bias = -.00035;
    this.scene.add(sun); this.sun = sun;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1800, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color('#334c5c') }, bottom: { value: new THREE.Color('#e0b27c') } }, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vPos;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.12,0.65,h)),1.0);}' }));
    this.scene.add(sky);
    this.raycaster = new THREE.Raycaster(); this.sharedParticleGeo = new THREE.BoxGeometry(.16, .16, .16); this.bulletGeo = new THREE.BoxGeometry(.07, .07, 2.4);
  }

  buildWorld() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD), new THREE.MeshStandardMaterial({ map: groundTexture(), color: '#859078', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const roadMat = new THREE.MeshStandardMaterial({ color: '#4a4c43', roughness: .97 });
    const road1 = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 28), roadMat); road1.rotation.x = -Math.PI / 2; road1.position.y = .025; road1.receiveShadow = true; this.scene.add(road1);
    const road2 = road1.clone(); road2.rotation.z = Math.PI / 2; this.scene.add(road2);
    // Districts: solid structures, rooftops, doors, windows, and cover.
    const districts = [{ x: -480, z: -430, name: 'RELAY' }, { x: 390, z: -460, name: 'DRYDOCK' }, { x: -450, z: 360, name: 'QUARRY' }, { x: 410, z: 390, name: 'FOUNDRY' }, { x: -80, z: -70, name: 'ARRAY' }];
    this.districts = districts;
    districts.forEach((d, di) => {
      for (let i = 0; i < 5; i++) {
        const w = rand(18, 32), dep = rand(16, 28), h = rand(9, 18), x = d.x + (i % 3) * 50, z = d.z + Math.floor(i / 3) * 65;
        this.addBuilding(x, z, w, dep, h, di % 2);
        for (let j = 0; j < 2; j++) this.addLoot(x + rand(-w / 3, w / 3), z + dep / 2 + rand(5, 10));
      }
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2, 35, 8), new THREE.MeshStandardMaterial({ color: '#59625b', metalness: .65, roughness: .5 })); tower.position.set(d.x - 25, 17.5, d.z - 30); tower.castShadow = true; this.scene.add(tower);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#899188', side: THREE.DoubleSide, metalness: .5, roughness: .55 })); dish.scale.y = .25; dish.rotation.x = -.5; dish.position.set(d.x - 25, 36, d.z - 30); this.scene.add(dish);
    });
    for (let i = 0; i < 60; i++) this.addCrate(rand(-740, 740), rand(-740, 740));
    this.addNature();
    this.addMountains();
    for (let i = 0; i < 48; i++) this.addLoot(rand(-720, 720), rand(-720, 720));
    this.player = { x: 25, z: 35, r: 1.05, hp: 100, armor: 50, angle: 0, speed: 18, dead: false, weapons: [cloneWeapon(this.config.weapon.id)], slot: 0, fireCd: 0, reload: 0, dashCd: 0, dashTime: 0, abilityCd: 0, effect: 0, ghost: false, barrier: false, hitFlash: 0, jumpY: 0, vy: 0, moving: 0 };
    this.player.mesh = createCharacter(this.config.operator.color); this.scene.add(this.player.mesh);
    this.bots = [];
    const count = this.config.mode === 'blitz' ? 11 : 23;
    for (let i = 0; i < count; i++) {
      let p; do { p = { x: rand(-730, 730), z: rand(-730, 730) }; } while (this.collides(p.x, p.z, 2) || dist(p, this.player) < 100);
      const b = { ...p, r: 1.05, hp: 100, armor: Math.random() < .55 ? 25 : 0, name: BOT_NAMES[i], dead: false, angle: rand(0, TAU), speed: rand(10, 13), weapon: cloneWeapon(pick(['raven','raven','viper','longbow'])), fireCd: rand(0, 1), reload: 0, think: 0, target: null, wander: rand(0, TAU), skill: rand(.45, .85), strafe: Math.random() < .5 ? -1 : 1, hitFlash: 0, moving: 0 };
      b.mesh = createCharacter('#d16650', true); b.mesh.scale.setScalar(.96); this.scene.add(b.mesh); this.addNameplate(b); this.bots.push(b);
    }
    this.addLoot(this.player.x + 7, this.player.z + 3, 'armor');
    this.createZone(); this.planZone(); this.syncActor(this.player, 0); this.updateCamera(1);
  }

  addBuilding(x, z, w, d, h, tone) {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.scene.add(group);
    const wallMat = new THREE.MeshStandardMaterial({ color: tone ? '#777a6e' : '#6d6c5e', roughness: .9, metalness: .05 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); wall.position.y = h / 2; wall.castShadow = wall.receiveShadow = true; group.add(wall); this.cameraBlockers.push(wall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, .7, d + 1), new THREE.MeshStandardMaterial({ color: '#353d39', roughness: .75, metalness: .3 })); roof.position.y = h + .2; roof.castShadow = true; group.add(roof);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + .2, .35, d + .2), new THREE.MeshStandardMaterial({ color: '#b07043', roughness: .7 })); trim.position.y = h * .7; group.add(trim);
    const windowMat = new THREE.MeshStandardMaterial({ color: '#182b2e', emissive: '#38605d', emissiveIntensity: .25, metalness: .7, roughness: .2 });
    for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), windowMat); win.position.set(i * w * .25, h * .55, side * (d / 2 + .01)); if (side < 0) win.rotation.y = Math.PI; group.add(win); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshStandardMaterial({ color: '#2c3430', roughness: .8 })); door.position.set(0, 2.5, d / 2 + .02); group.add(door);
    this.obstacles.push({ x, z, w, d, h });
  }
  addCrate(x, z) {
    if (this.collides(x, z, 4) || Math.hypot(x - 25, z - 35) < 25) return;
    const w = rand(2.5, 4.5), h = rand(2.5, 4), m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: '#706448', roughness: .82, metalness: .15 })); m.position.set(x, h / 2, z); m.rotation.y = rand(0, TAU); m.castShadow = m.receiveShadow = true; this.scene.add(m);
    this.obstacles.push({ x, z, w: w * 1.2, d: w * 1.2, h });
  }
  addNature() {
    const count = 260, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .5, 4, 6), new THREE.MeshStandardMaterial({ color: '#3d3325', roughness: 1 }), count);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(2.8, 8, 7), new THREE.MeshStandardMaterial({ color: '#263e2c', roughness: .95 }), count);
    const dummy = new THREE.Object3D(); let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = rand(-780, 780), z = rand(-780, 780); if (this.collides(x, z, 5) || Math.abs(x) < 24 || Math.abs(z) < 24 || Math.hypot(x - 25, z - 35) < 35) continue;
      const s = rand(.7, 1.5); dummy.position.set(x, 2 * s, z); dummy.scale.setScalar(s); dummy.rotation.y = rand(0, TAU); dummy.updateMatrix(); trunk.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = 6 * s; dummy.updateMatrix(); crown.setMatrixAt(placed, dummy.matrix); placed++;
    }
    trunk.count = crown.count = placed; trunk.castShadow = crown.castShadow = true; trunk.receiveShadow = true; this.scene.add(trunk, crown);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.5, 0), new THREE.MeshStandardMaterial({ color: '#646b5e', roughness: 1 }), 100);
    for (let i = 0; i < 100; i++) { dummy.position.set(rand(-770,770), rand(.2,.8), rand(-770,770)); dummy.scale.set(rand(.5,2.5),rand(.5,1.5),rand(.5,2.3)); dummy.rotation.set(rand(0,1),rand(0,TAU),0); dummy.updateMatrix(); rocks.setMatrixAt(i,dummy.matrix); } rocks.castShadow = true; this.scene.add(rocks);
  }
  addMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: '#46534b', roughness: 1, flatShading: true });
    for (let i = 0; i < 40; i++) { const a = i / 40 * TAU, r = rand(900, 1150), h = rand(90, 230); const m = new THREE.Mesh(new THREE.ConeGeometry(rand(70,150), h, 7), mat); m.position.set(Math.cos(a)*r,h/2-8,Math.sin(a)*r); m.rotation.y=rand(0,TAU); this.scene.add(m); }
  }
  addNameplate(bot) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 48; const c = canvas.getContext('2d'); c.font = '600 20px monospace'; c.textAlign = 'center'; c.fillStyle = '#f0e9df'; c.fillText(bot.name.toUpperCase(),128,22); c.fillStyle = '#251713'; c.fillRect(48,31,160,7); c.fillStyle = '#e16b54'; c.fillRect(48,31,160,7);
    const texture = new THREE.CanvasTexture(canvas); const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })); sprite.position.y = 5.5; sprite.scale.set(6,1.15,1); bot.mesh.add(sprite); bot.nameplate = sprite; bot.nameCanvas = canvas;
  }
  addLoot(x, z, forced) {
    if (this.collides(x,z,1)) return;
    const roll = Math.random(), type = forced || (roll < .2 ? 'medkit' : roll < .4 ? 'armor' : roll < .72 ? 'ammo' : 'weapon');
    const l = { x, z, type, amount: type === 'medkit' ? 45 : type === 'armor' ? 40 : 60, weapon: type === 'weapon' ? pick(Object.keys(WEAPONS).filter(w => w !== this.config.weapon.id)) : null, bob: rand(0,TAU) };
    const colors = { medkit:'#79d59c', armor:'#72bcd3', ammo:'#e8c469', weapon:'#df8cff' }, color = colors[type];
    const group = new THREE.Group(); group.position.set(x,.8,z);
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, metalness:.4,roughness:.3 })); core.rotation.set(.3,.4,0); group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4,.045,6,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18,.7,8,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=3.5;group.add(beam);
    l.mesh=group;l.core=core;this.scene.add(group);this.loot.push(l);
  }
  createZone() {
    this.zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1,1,75,96,1,true),new THREE.MeshBasicMaterial({color:'#d25b77',transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));this.zoneMesh.position.y=37.5;this.scene.add(this.zoneMesh);
    const ringGeo = new THREE.RingGeometry(.992,1,128);ringGeo.rotateX(-Math.PI/2);
    this.zoneRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#ff8390',side:THREE.DoubleSide,transparent:true,opacity:.8}));this.zoneRing.position.y=.15;this.scene.add(this.zoneRing);
    this.nextRing=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:'#e6f2dd',side:THREE.DoubleSide,transparent:true,opacity:.55}));this.nextRing.position.y=.12;this.scene.add(this.nextRing);
  }

  bind() {
    const s = { signal: this.abort.signal }, canvas = this.renderer.domElement;
    window.addEventListener('resize', () => this.resize(), s);
    window.addEventListener('keydown', e => {
      if (['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault(); this.keys[e.code]=true;
      if(e.repeat)return;if(e.code==='Escape')this.togglePause();if(!this.running||this.paused)return;
      if(e.code==='KeyR')this.reload();if(e.code==='KeyQ')this.ability();if(e.code==='KeyE')this.interact();if(e.code==='Digit1')this.switchWeapon(0);if(e.code==='Digit2')this.switchWeapon(1);if(e.code==='ShiftLeft'||e.code==='ShiftRight')this.dash();
      if(e.code==='Space'&&this.player.jumpY<=.01){this.player.vy=8.5;this.sound.tone(140,.08,'sine',.015,50);}
    },s);
    window.addEventListener('keyup',e=>this.keys[e.code]=false,s);
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!this.paused){this.yaw-=e.movementX*.0023;this.pitch=clamp(this.pitch-e.movementY*.0019,-.65,.48);}},s);
    canvas.addEventListener('pointerdown',e=>{this.sound.init();if(e.pointerType==='mouse'){if(e.button===0){this.mouse.down=true;this.mouse.clicked=true;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();}if(e.button===2)this.mouse.ads=true;}else{this.touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}},s);
    canvas.addEventListener('pointermove',e=>{if(this.touchLook&&this.touchLook.id===e.pointerId){this.yaw-=(e.clientX-this.touchLook.x)*.006;this.pitch=clamp(this.pitch-(e.clientY-this.touchLook.y)*.004,-.65,.48);this.touchLook.x=e.clientX;this.touchLook.y=e.clientY;}},s);
    window.addEventListener('pointerup',e=>{if(e.button===0)this.mouse.down=false;if(e.button===2)this.mouse.ads=false;if(this.touchLook?.id===e.pointerId)this.touchLook=null;},s);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),s);
    this.root.querySelector('.pause-button').onclick=()=>this.togglePause();this.root.querySelector('.ability-button').onclick=()=>this.ability();this.root.querySelectorAll('.weapon-slot').forEach(b=>b.onclick=()=>this.switchWeapon(+b.dataset.slot));
    const stick=this.root.querySelector('.move-stick'),knob=stick.querySelector('.stick-knob');
    const moveStick=e=>{const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.hypot(x,y),max=r.width*.32,nx=len?x/Math.max(len,max):0,ny=len?y/Math.max(len,max):0;this.touchMove={x:nx,y:ny};knob.style.transform=`translate(${nx*max}px,${ny*max}px)`;};
    stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);moveStick(e);},s);stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture(e.pointerId))moveStick(e);},s);
    const endStick=()=>{this.touchMove={x:0,y:0};knob.style.transform='';};stick.addEventListener('pointerup',endStick,s);stick.addEventListener('pointercancel',endStick,s);
    const fire=this.root.querySelector('.mobile-fire');fire.addEventListener('pointerdown',e=>{e.preventDefault();this.mouse.down=true;this.mouse.clicked=true;this.mobileFire=true;this.sound.init();},s);fire.addEventListener('pointerup',()=>{this.mouse.down=false;this.mobileFire=false;},s);fire.addEventListener('pointercancel',()=>{this.mouse.down=false;this.mobileFire=false;},s);
    this.root.querySelector('.mobile-action.dash').onclick=()=>this.dash();this.root.querySelector('.mobile-action.interact').onclick=()=>this.interact();this.root.querySelector('.mobile-action.reload').onclick=()=>this.reload();
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&!this.ended&&!this.paused)this.togglePause();},s);
  }
  resize(){this.width=this.root.clientWidth;this.height=this.root.clientHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);}
  collides(x,z,r){if(x<-WORLD/2+r+5||z<-WORLD/2+r+5||x>WORLD/2-r-5||z>WORLD/2-r-5)return true;return this.obstacles.some(o=>x+r>o.x-o.w/2&&x-r<o.x+o.w/2&&z+r>o.z-o.d/2&&z-r<o.z+o.d/2);}
  move(e,dx,dz){if(!this.collides(e.x+dx,e.z,e.r))e.x+=dx;if(!this.collides(e.x,e.z+dz,e.r))e.z+=dz;}
  lineClear(a,b){const steps=Math.ceil(dist(a,b)/8);for(let i=1;i<steps;i++){const t=i/steps,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);if(this.obstacles.some(o=>x>o.x-o.w/2&&x<o.x+o.w/2&&z>o.z-o.d/2&&z<o.z+o.d/2))return false;}return true;}

  loop(now){if(!this.running)return;const dt=Math.min((now-this.last)/1000,.04);this.last=now;if(!this.paused&&!this.ended)this.update(dt);this.render(dt);this.frame=requestAnimationFrame(t=>this.loop(t));}
  update(dt){
    this.time+=dt;const p=this.player;p.fireCd-=dt;p.dashCd-=dt;p.abilityCd-=dt;p.effect-=dt;p.hitFlash-=dt;if(p.effect<=0){p.ghost=false;p.barrier=false;}
    if(p.reload>0){p.reload-=dt;if(p.reload<=0)this.finishReload(p,p.weapons[p.slot]);}
    let dx=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0),dz=(this.keys.KeyS?1:0)-(this.keys.KeyW?1:0);if(this.touchMove){dx=this.touchMove.x;dz=this.touchMove.y;}
    const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);let mx=dx*cos+dz*sin,mz=dz*cos-dx*sin;
    let speed=p.speed*(this.config.operator.id==='volt'&&p.effect>0?1.55:1)*(this.mouse.ads?.72:1);if(p.dashTime>0){p.dashTime-=dt;speed*=3.2;if(!mx&&!mz){mx=sin;mz=-cos;}}
    p.moving=Math.hypot(mx,mz);this.move(p,mx*speed*dt,mz*speed*dt);p.angle=this.yaw;
    if(p.jumpY>0||p.vy>0){p.vy-=20*dt;p.jumpY+=p.vy*dt;if(p.jumpY<0){p.jumpY=0;p.vy=0;}}
    if(this.mobileFire){const target=this.bots.filter(b=>!b.dead&&dist(p,b)<p.weapons[p.slot].range&&this.lineClear(p,b)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(target){this.yaw=Math.atan2(target.x-p.x,-(target.z-p.z));p.angle=this.yaw;}}
    const weapon=p.weapons[p.slot];if((this.mouse.down&&weapon.auto)||this.mouse.clicked)this.shoot(p,weapon,true);this.mouse.clicked=false;
    this.updateBots(dt);this.updateBullets(dt);this.updateZone(dt);this.updateParticles(dt);this.syncActor(p,dt);
    for(const l of this.loot){l.bob+=dt;l.mesh.position.y=.85+Math.sin(l.bob*2)*.18;l.core.rotation.y+=dt*.8;l.mesh.rotation.y+=dt*.25;}
    const nearby=this.loot.filter(l=>dist(l,p)<4.5).sort((a,b)=>dist(a,p)-dist(b,p))[0];this.nearbyLoot=nearby||null;this.ui.interact.classList.toggle('show',!!nearby);if(nearby)this.ui.interact.querySelector('span').textContent=nearby.type==='weapon'?`PICK UP ${WEAPONS[nearby.weapon].name}`:`COLLECT ${nearby.type.toUpperCase()}`;
    this.updateCamera(dt);this.updateUI();
  }
  syncActor(a,dt){a.mesh.position.set(a.x,a.jumpY||0,a.z);a.mesh.rotation.y=a.angle;const parts=a.mesh.userData,walk=a.moving?Math.sin(this.time*10)*.55:0;parts.leftLeg.rotation.x=walk;parts.rightLeg.rotation.x=-walk;parts.weapon.rotation.x=-this.pitch*.45;if(a.hitFlash>0)parts.armor.emissive.set('#ffffff');else parts.armor.emissive.set('#000000');if(a===this.player){a.mesh.visible=!a.ghost||Math.floor(this.time*10)%2===0;}}
  updateCamera(dt){
    const p=this.player,target=new THREE.Vector3(p.x,3.1+p.jumpY,p.z),dir=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    const distance=this.mouse.ads?4.8:9.5,desired=target.clone().addScaledVector(dir,-distance).add(new THREE.Vector3(this.mouse.ads?1.1:1.5,2.0,0));
    this.raycaster.set(target,desired.clone().sub(target).normalize());this.raycaster.far=target.distanceTo(desired);const hits=this.raycaster.intersectObjects(this.cameraBlockers,false);if(hits.length)desired.copy(hits[0].point).addScaledVector(dir,.4);
    const smooth=dt===1?1:1-Math.pow(.00008,dt);this.camera.position.lerp(desired,smooth);if(this.cameraShake>0){this.camera.position.x+=rand(-this.cameraShake,this.cameraShake);this.camera.position.y+=rand(-this.cameraShake,this.cameraShake);this.cameraShake*=Math.pow(.02,dt);}
    this.camera.lookAt(target.clone().addScaledVector(dir,80));this.camera.fov=lerp(this.camera.fov,this.mouse.ads?44:62,1-Math.pow(.002,dt));this.camera.updateProjectionMatrix();
    this.sun.position.set(p.x-160,240,p.z+90);this.sun.target.position.set(p.x,0,p.z);this.sun.target.updateMatrixWorld();
  }

  shoot(owner,weapon,playerOwned=false){
    if(owner.fireCd>0||owner.reload>0||owner.dead)return;if(weapon.ammo<=0){if(playerOwned)this.reload();return;}weapon.ammo--;owner.fireCd=weapon.rate*(playerOwned&&this.config.operator.id==='volt'&&owner.effect>0?.72:1);
    const spread=weapon.spread*(playerOwned?(this.mouse.ads?.35:1):2.1-owner.skill),a=owner.angle+rand(-spread,spread);let dir;
    if(playerOwned){dir=new THREE.Vector3();this.camera.getWorldDirection(dir);dir.x+=rand(-spread,spread);dir.z+=rand(-spread,spread);dir.normalize();}
    else dir=new THREE.Vector3(Math.sin(a),rand(-.015,.015),-Math.cos(a)).normalize();
    const pos=new THREE.Vector3(owner.x,2.7+(owner.jumpY||0),owner.z).addScaledVector(dir,2.3);
    const mat=new THREE.MeshBasicMaterial({color:weapon.color});const mesh=new THREE.Mesh(this.bulletGeo,mat);mesh.position.copy(pos);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);this.scene.add(mesh);
    this.bullets.push({pos,vel:dir.multiplyScalar(weapon.speed),life:weapon.range/weapon.speed,damage:weapon.damage*(playerOwned&&owner.ghost?1.5:1),owner,playerOwned,mesh});
    if(playerOwned){owner.ghost=false;this.sound.shot(weapon.id);this.cameraShake=weapon.id==='longbow'?.14:.055;}
    this.impact(pos,weapon.color,3,.6);
  }
  reload(){const p=this.player,w=p.weapons[p.slot];if(p.reload>0||w.ammo>=w.mag||w.reserve<=0)return;p.reload=w.reload;this.sound.reload();}
  finishReload(e,w){const n=Math.min(w.mag-w.ammo,w.reserve);w.ammo+=n;w.reserve-=n;e.reload=0;}
  switchWeapon(slot){if(this.player.weapons[slot]&&slot!==this.player.slot){this.player.slot=slot;this.player.reload=0;this.updateUI();this.sound.tone(300,.05,'square',.02,80);}}
  dash(){const p=this.player;if(p.dashCd<=0&&!p.dead&&!this.paused){p.dashCd=4;p.dashTime=.18;this.sound.tone(180,.16,'sawtooth',.025,180);}}
  ability(){const p=this.player;if(p.abilityCd>0||p.dead||this.paused)return;p.abilityCd=this.config.operator.id==='aegis'?22:18;p.effect=this.config.operator.id==='phantom'?5:6;if(this.config.operator.id==='phantom')p.ghost=true;if(this.config.operator.id==='aegis'){p.armor=Math.min(100,p.armor+50);p.barrier=true;}this.sound.ability();this.announce(this.config.operator.skill.toUpperCase(),'TACTICAL ABILITY ACTIVE',this.config.operator.name+' // PROTOCOL');this.impact(new THREE.Vector3(p.x,2,p.z),this.config.operator.color,25,8);}
  interact(){const l=this.nearbyLoot;if(!l)return;const p=this.player;if(l.type==='medkit'){if(p.hp>=100)return;p.hp=Math.min(100,p.hp+l.amount);}if(l.type==='armor'){if(p.armor>=100)return;p.armor=Math.min(100,p.armor+l.amount);}if(l.type==='ammo')p.weapons.forEach(w=>w.reserve+=l.amount);if(l.type==='weapon'){const w=cloneWeapon(l.weapon);if(p.weapons[1]){const old=p.weapons[1];p.weapons[1]=w;l.weapon=old.id;p.slot=1;this.sound.pickup();this.updateUI();return;}p.weapons.push(w);p.slot=1;}this.removeLoot(l);this.nearbyLoot=null;this.sound.pickup();this.updateUI();}
  removeLoot(l){this.scene.remove(l.mesh);this.loot.splice(this.loot.indexOf(l),1);}

  updateBots(dt){
    const actors=[this.player,...this.bots];for(const b of this.bots){if(b.dead)continue;b.fireCd-=dt;b.think-=dt;b.hitFlash-=dt;if(b.reload>0){b.reload-=dt;if(b.reload<=0)this.finishReload(b,b.weapon);}
      if(b.think<=0){b.think=rand(.18,.35);b.target=actors.filter(a=>a!==b&&!a.dead&&!(a===this.player&&a.ghost)&&dist(a,b)<b.weapon.range*.82&&this.lineClear(a,b)).sort((a,c)=>dist(a,b)-dist(c,b))[0]||null;if(Math.random()<.15)b.strafe*=-1;}
      let dx=0,dz=0;if(b.target&&!b.target.dead){const d=dist(b,b.target),a=Math.atan2(b.target.x-b.x,-(b.target.z-b.z));b.angle=a;if(d>35){dx+=Math.sin(a);dz-=Math.cos(a);}if(d<16){dx-=Math.sin(a);dz+=Math.cos(a);}dx+=Math.cos(a)*b.strafe*.55;dz+=Math.sin(a)*b.strafe*.55;if(Math.random()<b.skill*.92)this.shoot(b,b.weapon);if(b.weapon.ammo<=0&&b.reload<=0)b.reload=b.weapon.reload;}
      else{const zd=Math.hypot(b.x-this.zone.x,b.z-this.zone.z);if(zd>this.zone.r*.76)b.wander=Math.atan2(this.zone.x-b.x,-(this.zone.z-b.z))+rand(-.25,.25);else if(Math.random()<.015)b.wander+=rand(-1,1);dx=Math.sin(b.wander);dz=-Math.cos(b.wander);b.angle=b.wander;}
      const l=Math.hypot(dx,dz)||1;b.moving=Math.hypot(dx,dz);this.move(b,dx/l*b.speed*dt,dz/l*b.speed*dt);this.syncActor(b,dt);b.mesh.visible=dist(b,this.player)<300;if(Math.hypot(b.x-this.zone.x,b.z-this.zone.z)>this.zone.r)this.damage(b,(2.5+this.zone.phase*1.7)*dt,null,false);
    }
  }
  updateBullets(dt){const actors=[this.player,...this.bots];for(let i=this.bullets.length-1;i>=0;i--){const b=this.bullets[i];b.pos.addScaledVector(b.vel,dt);b.life-=dt;b.mesh.position.copy(b.pos);let remove=b.life<=0||Math.abs(b.pos.x)>900||Math.abs(b.pos.z)>900;
      if(!remove&&this.obstacles.some(o=>b.pos.x>o.x-o.w/2&&b.pos.x<o.x+o.w/2&&b.pos.z>o.z-o.d/2&&b.pos.z<o.z+o.d/2&&b.pos.y<o.h)){remove=true;this.impact(b.pos,'#b9ad91',4,3);}
      if(!remove)for(const a of actors){if(a.dead||a===b.owner)continue;const dx=a.x-b.pos.x,dz=a.z-b.pos.z,dy=1.9+(a.jumpY||0)-b.pos.y;if(dx*dx+dz*dz<1.5&&Math.abs(dy)<2.3){this.damage(a,b.damage,b.owner,true);remove=true;this.impact(b.pos,a===this.player?'#ff6b4c':'#e9c699',7,4);break;}}
      if(remove){this.scene.remove(b.mesh);b.mesh.material.dispose();this.bullets.splice(i,1);}
    }}
  damage(target,amount,attacker,feedback){if(target.dead)return;if(target===this.player&&target.barrier)amount*=.55;if(target.armor>0){const absorbed=Math.min(target.armor,amount*.7);target.armor-=absorbed;amount-=absorbed;}target.hp-=amount;target.hitFlash=.12;
    if(target===this.player&&feedback){this.ui.damage.style.opacity=.42;setTimeout(()=>{if(this.ui)this.ui.damage.style.opacity=0;},100);this.cameraShake=.22;}if(attacker===this.player&&feedback){this.sound.hit();this.hitMarker=.12;this.ui.crosshair.classList.add('hit');setTimeout(()=>this.ui?.crosshair.classList.remove('hit'),100);}if(target.hp<=0)this.eliminate(target,attacker);
  }
  eliminate(target,attacker){target.dead=true;target.hp=0;this.impact(new THREE.Vector3(target.x,2,target.z),target===this.player?'#ff6343':'#b5bdaf',25,8);
    if(target!==this.player){target.mesh.visible=false;this.addLoot(target.x,target.z);}if(attacker===this.player){this.kills++;this.sound.eliminate();this.addFeed(`YOU <b>ELIMINATED</b> ${target.name}`,true);}else if(attacker&&target!==this.player)this.addFeed(`${attacker.name} <b>ELIMINATED</b> ${target.name}`,false);else if(target!==this.player)this.addFeed(`${target.name} <b>LOST TO THE STORM</b>`,false);
    if(target===this.player){this.addFeed(`${attacker?.name||'THE STORM'} <b>ELIMINATED</b> YOU`,false);setTimeout(()=>this.finish(false),700);}else if(this.bots.every(b=>b.dead)&&!this.player.dead)setTimeout(()=>this.finish(true),700);
  }
  addFeed(html,player){this.feed.unshift({html,player});this.feed=this.feed.slice(0,5);this.ui.feed.innerHTML=this.feed.map(f=>`<div class="kill-line ${f.player?'player':''}">${f.html}</div>`).join('');}
  updateZone(dt){const z=this.zone,p=this.player;z.timer-=dt;if(z.timer<=0){if(!z.shrinking){z.shrinking=true;z.timer=this.config.mode==='blitz'?12:18;z.fromR=z.r;z.fromX=z.x;z.fromZ=z.z;this.announce('ZONE COLLAPSING','MOVE TO THE SAFE AREA',`PHASE ${z.phase+1} // STORM SURGE`);}else{z.shrinking=false;z.phase++;z.r=z.targetR;z.x=z.targetX;z.z=z.targetZ;z.timer=this.config.mode==='blitz'?10:Math.max(10,23-z.phase*2);if(z.r<45)z.targetR=0;else this.planZone();}}
    if(z.shrinking){const duration=this.config.mode==='blitz'?12:18,t=clamp(1-z.timer/duration,0,1);z.r=lerp(z.fromR,z.targetR,t);z.x=lerp(z.fromX,z.targetX,t);z.z=lerp(z.fromZ,z.targetZ,t);}if(Math.hypot(p.x-z.x,p.z-z.z)>z.r){this.damage(p,(2.5+z.phase*1.7)*dt,null,false);this.ui.outside.classList.add('show');}else this.ui.outside.classList.remove('show');
  }
  planZone(){const z=this.zone;z.targetR=Math.max(35,z.r*.66);const max=Math.max(0,z.r-z.targetR)*.65,a=rand(0,TAU),d=rand(0,max);z.targetX=clamp(z.x+Math.cos(a)*d,-WORLD/2+z.targetR,WORLD/2-z.targetR);z.targetZ=clamp(z.z+Math.sin(a)*d,-WORLD/2+z.targetR,WORLD/2-z.targetR);}
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.vel.y-=8*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.material.opacity=clamp(p.life/p.max,0,1);p.life-=dt;if(p.life<=0){this.scene.remove(p.mesh);p.mesh.material.dispose();this.particles.splice(i,1);}}}
  impact(pos,color,n,speed){for(let i=0;i<n;i++){const mesh=new THREE.Mesh(this.sharedParticleGeo,new THREE.MeshBasicMaterial({color,transparent:true}));mesh.position.copy(pos);this.scene.add(mesh);this.particles.push({mesh,vel:new THREE.Vector3(rand(-speed,speed),rand(-speed,speed),rand(-speed,speed)),life:rand(.15,.45),max:.45});}}

  updateUI(){const p=this.player,w=p.weapons[p.slot],alive=this.bots.filter(b=>!b.dead).length+(p.dead?0:1);this.ui['alive-count'].textContent=alive;this.ui['kill-count'].textContent=this.kills;this.ui['match-time'].textContent=fmt(this.time);this.ui.health.textContent=Math.ceil(p.hp);this.ui.healthBar.style.width=p.hp+'%';this.ui.armorBar.style.width=p.armor+'%';this.ui['armor-label'].textContent=Math.ceil(p.armor)+' ARMOR';this.ui['dash-label'].textContent=p.dashCd<=0?'DASH READY':`DASH ${p.dashCd.toFixed(1)}S`;this.ui.ammo.textContent=w.ammo;this.ui.reserve.textContent=' / '+w.reserve;this.ui.weapon.textContent=w.name;this.ui.mode.textContent=w.auto?'AUTO':'SEMI';this.ui.reload.textContent=p.reload>0?`RELOADING ${Math.ceil(p.reload*10)/10}s`:'';this.ui['zone-label'].textContent=this.zone.shrinking?'ZONE COLLAPSING':this.zone.r<80?'FINAL ZONE':'NEXT COLLAPSE';this.ui['zone-time'].textContent=fmt(this.zone.timer);this.root.querySelector('.zone-status').classList.toggle('danger',this.zone.shrinking);this.ui.cooldown.style.transform=`scaleY(${clamp(p.abilityCd/(this.config.operator.id==='aegis'?22:18),0,1)})`;this.ui.aimMode.textContent=this.mouse.ads?'ADS // PRECISION':'HIP FIRE';this.ui.crosshair.classList.toggle('ads',this.mouse.ads);this.root.querySelectorAll('.weapon-slot').forEach((el,i)=>{el.classList.toggle('active',i===p.slot);if(i===1){el.style.display=p.weapons[1]?'block':'none';if(p.weapons[1])el.textContent='2 // '+p.weapons[1].name;}});}
  announce(title,subtitle,eyebrow){const el=this.ui.announce;el.querySelector('h2').textContent=title;el.querySelector('p').textContent=subtitle;el.querySelector('small').textContent=eyebrow;el.classList.add('show');clearTimeout(this.announceTimer);this.announceTimer=setTimeout(()=>el.classList.remove('show'),3000);}

  render(dt){const z=this.zone;this.zoneMesh.position.x=this.zoneRing.position.x=z.x;this.zoneMesh.position.z=this.zoneRing.position.z=z.z;this.zoneMesh.scale.set(z.r,1,z.r);this.zoneRing.scale.setScalar(z.r);this.nextRing.position.x=z.targetX;this.nextRing.position.z=z.targetZ;this.nextRing.scale.setScalar(z.targetR);this.zoneMesh.material.opacity=.10+Math.sin(this.time*2)*.025;this.renderer.render(this.scene,this.camera);this.drawMinimap();}
  drawMinimap(){const c=this.mctx,w=this.map.width,h=this.map.height,s=w/WORLD,conv=v=>(v+WORLD/2)*s;c.clearRect(0,0,w,h);c.fillStyle='#1d2922';c.fillRect(0,0,w,h);c.strokeStyle='#4b574477';c.lineWidth=5;c.beginPath();c.moveTo(0,conv(0));c.lineTo(w,conv(0));c.moveTo(conv(0),0);c.lineTo(conv(0),h);c.stroke();c.fillStyle='#778074';for(const o of this.obstacles)if(o.h>6)c.fillRect(conv(o.x-o.w/2),conv(o.z-o.d/2),Math.max(1,o.w*s),Math.max(1,o.d*s));c.strokeStyle='#e47671';c.lineWidth=1.5;c.beginPath();c.arc(conv(this.zone.x),conv(this.zone.z),this.zone.r*s,0,TAU);c.stroke();c.strokeStyle='#e8eee0';c.setLineDash([3,3]);c.beginPath();c.arc(conv(this.zone.targetX),conv(this.zone.targetZ),this.zone.targetR*s,0,TAU);c.stroke();c.setLineDash([]);for(const b of this.bots){if(!b.dead&&dist(b,this.player)<85){c.fillStyle='#e26b53';c.beginPath();c.arc(conv(b.x),conv(b.z),2,0,TAU);c.fill();}}for(const l of this.loot){if(dist(l,this.player)<45){c.fillStyle='#d9ca72';c.fillRect(conv(l.x)-1,conv(l.z)-1,2,2);}}c.save();c.translate(conv(this.player.x),conv(this.player.z));c.rotate(this.player.angle);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-6);c.lineTo(-4,4);c.lineTo(4,4);c.closePath();c.fill();c.restore();}

  togglePause(){if(this.ended)return;this.paused=!this.paused;this.mouse.down=false;if(this.paused){document.exitPointerLock?.();const el=document.createElement('div');el.className='game-pause';el.innerHTML=`<div class="pause-panel"><span class="eyebrow-text">3D MATCH SUSPENDED</span><h2>TACTICAL PAUSE</h2><p>The simulation is paused.<br/>Click the battleground after resuming to capture your aim.</p><button class="deploy-button resume"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>BACK TO THE ISLAND</small><b>RESUME MATCH</b></span>${this.cb.icon('arrow')}</button><button class="outline-button quit">ABANDON MATCH</button></div>`;this.root.querySelector('.game-ui').append(el);this.pauseEl=el;el.querySelector('.resume').onclick=()=>this.togglePause();el.querySelector('.quit').onclick=()=>this.cb.onExit();}else{this.pauseEl?.remove();this.pauseEl=null;this.last=performance.now();}}
  finish(win){if(this.ended)return;this.ended=true;this.mouse.down=false;document.exitPointerLock?.();const placement=win?1:this.bots.filter(b=>!b.dead).length+1,xp=this.kills*(this.config.mode==='blitz'?200:100)+(win?1000:Math.max(50,350-placement*10)),result={win,kills:this.kills,placement,xp};this.cb.onFinish(result);const el=document.createElement('div');el.className='game-result';el.innerHTML=`<div class="result-panel"><span class="eyebrow-text">${win?'LAST ONE STANDING':'3D COMBAT RECORD // MATCH COMPLETE'}</span><h2>${win?'BOOYAH!':'ELIMINATED'}</h2><p>${win?'The island is yours. Outstanding work, operator.':'Every defeat sharpens the next deployment.'}</p><div class="result-placement">#${placement} <small>/ ${this.config.mode==='blitz'?12:24}</small></div><div class="result-stats"><div><small>ELIMINATIONS</small><b>${this.kills}</b></div><div><small>SURVIVED</small><b>${fmt(this.time)}</b></div><div><small>XP MULTIPLIER</small><b>1.0×</b></div></div><div class="result-xp">+ ${xp.toLocaleString()} CAREER XP</div><button class="deploy-button redeploy"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>ONE MORE RUN</small><b>REDEPLOY</b></span>${this.cb.icon('arrow')}</button><button class="outline-button lobby">RETURN TO LOBBY</button></div>`;this.root.querySelector('.game-ui').append(el);el.querySelector('.redeploy').onclick=()=>this.cb.onRestart();el.querySelector('.lobby').onclick=()=>this.cb.onExit();}
  destroy(){this.running=false;cancelAnimationFrame(this.frame);clearTimeout(this.announceTimer);this.abort.abort();document.exitPointerLock?.();this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.map?.dispose?.();m.dispose?.();});}});this.renderer.dispose();this.renderer.domElement.remove();this.ui=null;}
}
