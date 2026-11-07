import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const WORLD = 2400;
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
  const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(110, 110); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

function concreteTexture() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#aaa99b';c.fillRect(0,0,256,256);
  for(let i=0;i<5000;i++){const v=Math.floor(rand(60,180));c.fillStyle=`rgba(${v},${v},${v-8},${rand(.02,.10)})`;c.fillRect(rand(0,256),rand(0,256),rand(1,5),rand(1,3));}
  c.strokeStyle='#55594c35';c.lineWidth=1;for(let i=0;i<10;i++){c.beginPath();let x=rand(0,256),y=rand(0,256);c.moveTo(x,y);for(let j=0;j<4;j++){x+=rand(-15,15);y+=rand(5,18);c.lineTo(x,y);}c.stroke();}
  const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,1);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function createCharacter(color = '#ff6038', enemy = false) {
  const g = new THREE.Group();
  const armor = new THREE.MeshStandardMaterial({ color: enemy ? '#563632' : '#2d4039', roughness: .62, metalness: .38 });
  const cloth = new THREE.MeshStandardMaterial({ color: enemy ? '#302927' : '#28312d', roughness: .96 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: .35, metalness: .42, emissive: new THREE.Color(color), emissiveIntensity: .16 });
  const skin = new THREE.MeshStandardMaterial({ color: '#151c1b', roughness: .32, metalness: .72 });
  const gunMat = new THREE.MeshStandardMaterial({ color: '#171d1c', roughness: .28, metalness: .86 });
  const box = (w, h, d, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; };
  // Articulated hips and shoulders make rotation and locomotion visibly natural.
  const makeLeg = x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 1.72, 0); g.add(pivot);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(.31, .92, 4, 8), cloth); limb.position.y = -.73; limb.castShadow = true; pivot.add(limb);
    box(.66, .48, .28, armor, 0, -.62, -.31, pivot);
    box(.72, .30, 1.08, skin, 0, -1.52, -.17, pivot);
    return pivot;
  };
  const makeArm = x => {
    const pivot = new THREE.Group(); pivot.position.set(x, 3.12, -.05); g.add(pivot);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(.22, .85, 4, 8), cloth); limb.position.y = -.67; limb.castShadow = true; pivot.add(limb);
    box(.57, .45, .62, armor, 0, -.10, 0, pivot); box(.38, .35, .40, skin, 0, -1.35, 0, pivot);
    pivot.rotation.x = -.92; pivot.rotation.z = x > 0 ? .18 : -.18; return pivot;
  };
  const leftLeg = makeLeg(-.43), rightLeg = makeLeg(.43);
  const leftArm = makeArm(-1.0), rightArm = makeArm(1.0);
  const chest = box(1.65, 1.65, .90, armor, 0, 2.50, 0);
  box(1.82, .28, 1.02, accent, 0, 2.88, -.02); box(1.15, .28, .96, skin, 0, 1.72, 0);
  // Independent vest plates, magazine pouches, backpack and shoulder lights.
  box(.58, .72, .23, armor, -.43, 2.32, -.56); box(.58, .72, .23, armor, .43, 2.32, -.56);
  for (let i = -1; i <= 1; i++) box(.30, .48, .25, cloth, i * .36, 1.96, -.61);
  box(1.22, 1.30, .52, cloth, 0, 2.53, .69); box(.83, .22, .12, accent, 0, 2.72, .98);
  box(.15, .15, .15, accent, -1.06, 3.12, -.36); box(.15, .15, .15, accent, 1.06, 3.12, -.36);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(.65, 16, 10), armor); helmet.position.y = 3.88; helmet.scale.y = .91; helmet.castShadow = true; g.add(helmet);
  box(1.03, .35, .17, skin, 0, 3.91, -.57); box(.79, .10, .045, accent, 0, 3.95, -.67);
  box(.43, .30, .47, armor, 0, 4.40, .05); box(.12, .65, .12, skin, .47, 4.25, .23);
  const weapon = new THREE.Group(); weapon.position.set(.58, 2.62, -.68); weapon.rotation.x = -.08; g.add(weapon);
  box(.34, .38, 2.5, gunMat, 0, 0, -1.0, weapon); box(.19, .19, 1.5, skin, 0, .02, -2.7, weapon);
  box(.49, .46, .72, armor, 0, .03, -.2, weapon); box(.23, .72, .48, gunMat, 0, -.48, -.7, weapon);
  box(.18, .22, .60, accent, 0, .30, -.8, weapon); box(.10, .20, .48, skin, 0, .37, -1.45, weapon);
  g.userData = { leftLeg, rightLeg, leftArm, rightArm, weapon, armor, accent, chest, helmet };
  return g;
}

function createRifle(color = '#ff6038') {
  const g=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:'#202725',metalness:.88,roughness:.24}),polymer=new THREE.MeshStandardMaterial({color:'#343d38',metalness:.18,roughness:.68}),glow=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:1.5,metalness:.4,roughness:.3});
  const add=(geo,mat,x,y,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  add(new THREE.BoxGeometry(.32,.38,2.2),polymer,0,0,-.7);add(new THREE.BoxGeometry(.26,.26,1.4),metal,0,.02,-2.25);
  const barrel=add(new THREE.CylinderGeometry(.075,.075,1.7,12),metal,0,.03,-3.35);barrel.rotation.x=Math.PI/2;
  const muzzle=add(new THREE.CylinderGeometry(.13,.13,.38,12),metal,0,.03,-4.22);muzzle.rotation.x=Math.PI/2;
  add(new THREE.BoxGeometry(.44,.50,.82),polymer,0,.02,.65);add(new THREE.BoxGeometry(.20,.75,.48),metal,0,-.49,-.55).rotation.x=-.16;
  add(new THREE.BoxGeometry(.18,.55,.40),polymer,0,-.40,.35).rotation.x=.28;
  add(new THREE.BoxGeometry(.13,.16,1.25),metal,0,.30,-.75);add(new THREE.BoxGeometry(.30,.28,.52),metal,0,.49,-.78);
  add(new THREE.CylinderGeometry(.14,.14,.45,16),metal,0,.53,-1.12).rotation.x=Math.PI/2;
  add(new THREE.CircleGeometry(.11,16),glow,0,.53,-1.36);
  for(let i=0;i<7;i++)add(new THREE.BoxGeometry(.37,.055,.07),metal,0,.23,-1.55+i*.20);
  return g;
}

function mergeBuildingParts(group,material){
  const parts=group.children.filter(o=>o.isMesh&&o.material===material);if(parts.length<2)return;const geometries=parts.map(o=>{o.updateMatrix();return o.geometry.clone().applyMatrix4(o.matrix);}),geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)return;parts.forEach(o=>group.remove(o));const merged=new THREE.Mesh(geometry,material);merged.castShadow=merged.receiveShadow=true;group.add(merged);
}

function createTransportPlane(){
  const g=new THREE.Group(),skin=new THREE.MeshStandardMaterial({color:'#596763',metalness:.72,roughness:.34}),dark=new THREE.MeshStandardMaterial({color:'#26322f',metalness:.76,roughness:.28}),glass=new THREE.MeshStandardMaterial({color:'#6fa5aa',emissive:'#315e65',emissiveIntensity:.45,metalness:.8,roughness:.12});
  const add=(geo,material,x,y,z)=>{const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;};
  const body=add(new THREE.CylinderGeometry(1.65,1.85,17,20),skin,0,0,0);body.rotation.x=Math.PI/2;
  const nose=add(new THREE.SphereGeometry(1.67,20,12),skin,0,0,-8.35);nose.scale.z=1.5;
  add(new THREE.SphereGeometry(1.3,16,8,0,TAU,0,Math.PI*.48),glass,0,.55,-9.15).rotation.x=-.4;
  const wing=add(new THREE.BoxGeometry(25,.34,4.2),skin,0,.25,-.4);wing.rotation.z=.018;
  add(new THREE.BoxGeometry(10,.25,2.7),skin,0,1.15,7.0);add(new THREE.BoxGeometry(.3,4.5,3.4),dark,0,2.5,7.2).rotation.x=-.22;
  for(const x of [-7,-3.8,3.8,7]){const engine=add(new THREE.CylinderGeometry(.65,.82,2.8,14),dark,x,-.25,-.7);engine.rotation.x=Math.PI/2;const prop=add(new THREE.BoxGeometry(3.8,.09,.18),dark,x,-.25,-2.2);prop.userData.propeller=true;}
  for(const side of [-1,1])for(let i=0;i<5;i++)add(new THREE.BoxGeometry(.06,.48,.65),glass,side*1.68,.45,-3+i*1.4);
  const stripe=new THREE.MeshStandardMaterial({color:'#d57a45',emissive:'#7d351b',emissiveIntensity:.3,roughness:.5});add(new THREE.BoxGeometry(3.5,.04,.65),stripe,0,1.76,1.8);
  for(const [x,color] of [[-12.4,'#ff463c'],[12.4,'#57e39b']]){const light=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),new THREE.MeshBasicMaterial({color}));light.position.set(x,.25,-.4);g.add(light);}
  g.userData.propellers=g.children.filter(o=>o.userData.propeller);return g;
}

function createParachuteRig(){
  const group=new THREE.Group(),canopy=new THREE.Group();group.add(canopy);const colors=['#d86c43','#e6ded0','#424f4a','#e6ded0','#d86c43'];
  for(let i=0;i<10;i++){const panel=new THREE.Mesh(new THREE.SphereGeometry(4.8,24,10,i/10*TAU,TAU/10+.012,0,Math.PI/2),new THREE.MeshStandardMaterial({color:colors[i%colors.length],side:THREE.DoubleSide,roughness:.88}));panel.scale.y=.38;canopy.add(panel);}
  const ropes=new THREE.Group(),material=new THREE.LineBasicMaterial({color:'#d8d5c7',transparent:true,opacity:.85});group.add(ropes);
  for(let i=0;i<8;i++){const a=i/8*TAU,geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(Math.cos(a)*1,.3,Math.sin(a)*1),new THREE.Vector3(Math.cos(a)*4.3,-.25,Math.sin(a)*4.3)]);ropes.add(new THREE.Line(geo,material));}
  group.userData={canopy,ropes};return group;
}

export class Battleground {
  constructor(root, config, callbacks) {
    this.root = root; this.config = config; this.cb = callbacks; this.sound = new SoundEngine(config.muted);this.coarse=matchMedia('(pointer:coarse)').matches;this.lowShadows=false;
    this.abort = new AbortController(); this.keys = {}; this.mouse = { down: false, clicked: false, ads: false };
    this.running = true; this.paused = false; this.ended = false; this.phase = 'flight'; this.time = 0; this.last = performance.now(); this.kills = 0; this.feed = [];
    this.bullets = []; this.particles = []; this.obstacles = []; this.loot = []; this.cameraBlockers = []; this.airdrops = []; this.nextAirdrop = 38; this.yaw = 0; this.pitch = -.12; this.cameraShake = 0; this.qualityDpr=Math.min(devicePixelRatio||1,this.coarse?1.1:1.5);this.perfSample={time:0,frames:0};
    this.zone = { x: 0, z: 0, r: 1160, fromR: 1160, targetR: 1160, fromX: 0, fromZ: 0, targetX: 0, targetZ: 0, phase: 0, timer: config.mode === 'blitz' ? 15 : 25, shrinking: false };
    this.buildDOM(); this.initThree(); this.buildWorld(); this.setupDeployment(); this.loadAdvancedSoldiers(); this.bind(); this.resize();this.render(0);
    this.frame = requestAnimationFrame(t => this.loop(t));
  }

  buildDOM() {
    const icon = this.cb.icon, operator = this.config.operator;
    this.root.innerHTML = `<div class="three-mount"></div><div class="game-ui">
      <div class="match-top"><div class="match-brand"><svg viewBox="0 0 42 42"><path d="M4 34 17 6h9l12 28H27l-2-6h-9l-3 6zm15-14h4l-2-7z"/></svg><span><b>ASHFALL</b><small>BLACKOUT ISLAND // 3D</small></span></div><div class="match-stats"><div class="match-stat"><small>ALIVE</small><b id="alive-count">24</b></div><div class="match-stat"><small>ELIMINATIONS</small><b id="kill-count">0</b></div><div class="match-stat"><small>MATCH TIME</small><b id="match-time">00:00</b></div></div><button class="pause-button" aria-label="Pause">Ⅱ</button></div>
      <div class="zone-status">${icon('shield')}<small id="zone-label">SAFE ZONE STABLE</small><b id="zone-time">00:25</b></div>
      <div class="minimap-wrap"><canvas class="minimap" width="180" height="180"></canvas><span class="map-label">BLACKOUT ISLAND // 3D</span><span class="map-coords">TACTICAL UPLINK</span></div><div class="kill-feed"></div>
      <div class="aim-crosshair"><i></i><i></i><i></i><i></i><b></b></div><div class="aim-mode">HIP FIRE</div>
      <div class="match-announcement"><small></small><h2></h2><p></p></div><div class="outside-zone">⚠ RETURN TO THE SAFE ZONE</div><div class="damage-vignette"></div><div class="damage-direction"><i></i></div>
      <div class="player-status"><div class="player-name"><span class="player-op-icon">${operator.letter}</span><span><b>${operator.name}</b><small>YOU // 3D COMBAT READY</small></span></div><div class="health-row"><span class="health-number">100</span><div class="health-bars"><div class="armor-track"><i></i></div><div class="health-track"><i></i></div></div></div><div class="status-effects"><span id="armor-label">50 ARMOR</span><span id="dash-label">DASH READY</span></div></div>
      <div class="weapon-hud"><div class="ability-status"><button class="ability-button" title="Operator ability">${icon('bolt')}<kbd>Q</kbd><i class="cooldown"></i></button><small>${operator.skill.toUpperCase()}</small></div><div class="ammo-block"><small>PRIMARY // <span class="fire-mode">AUTO</span></small><div class="ammo-numbers"><b>30</b><span> / 120</span></div><div class="weapon-name">RAVEN AR</div><div class="reload-label"></div><div class="weapon-slots"><button class="weapon-slot active" data-slot="0">1 // ${this.config.weapon.name}</button><button class="weapon-slot" data-slot="1" style="display:none">2 // EMPTY</button></div></div></div>
      <div class="interaction-prompt"><kbd>E</kbd><span>COLLECT SUPPLIES</span></div><div class="desktop-hints"><span><kbd>WASD</kbd> MOVE</span><span><kbd>SPACE</kbd> JUMP</span><span><kbd>RMB</kbd> ADS</span><span><kbd>SHIFT</kbd> DASH</span><span><kbd>Q</kbd> ABILITY</span><span><kbd>E</kbd> LOOT</span></div>
      <div class="mobile-controls"><div class="move-stick" aria-label="Movement joystick"><i class="stick-knob"></i></div><button class="mobile-fire" aria-label="Fire weapon">${icon('crosshair')}</button><button class="mobile-action dash" aria-label="Combat dash">DASH</button><button class="mobile-action interact" aria-label="Collect loot">LOOT</button><button class="mobile-action reload" aria-label="Reload">R</button><button class="mobile-action jump" aria-label="Jump">↑</button><button class="mobile-action ability" aria-label="Operator ability">${icon('bolt')}<i class="mobile-cooldown"></i></button><button class="mobile-action ads" aria-label="Toggle aim down sights" aria-pressed="false">ADS</button><button class="mobile-action swap" aria-label="Switch weapon" style="display:none">1↔2</button></div>
      <div class="deployment-hud"><div class="deployment-route"><span>FLIGHT PATH // BLACKOUT ISLAND</span><b id="deployment-phase">TRANSPORT INBOUND</b></div><div class="deployment-data"><span><small>ALTITUDE</small><b id="deployment-altitude">120 M</b></span><span><small>AIR SPEED</small><b id="deployment-speed">280 KM/H</b></span></div><button class="deployment-action">JUMP FROM PLANE <kbd>SPACE</kbd></button><p>STEER WITH WASD · OPEN YOUR CHUTE ANYTIME</p></div>
    </div>`;
    this.map = this.root.querySelector('.minimap'); this.mctx = this.map.getContext('2d'); this.ui = {};
    ['alive-count','kill-count','match-time','zone-label','zone-time','armor-label','dash-label'].forEach(id => this.ui[id] = this.root.querySelector('#' + id));
    this.ui.health = this.root.querySelector('.health-number'); this.ui.healthBar = this.root.querySelector('.health-track i'); this.ui.armorBar = this.root.querySelector('.armor-track i');
    this.ui.ammo = this.root.querySelector('.ammo-numbers b'); this.ui.reserve = this.root.querySelector('.ammo-numbers span'); this.ui.weapon = this.root.querySelector('.weapon-name'); this.ui.reload = this.root.querySelector('.reload-label'); this.ui.mode = this.root.querySelector('.fire-mode');
    this.ui.feed = this.root.querySelector('.kill-feed'); this.ui.announce = this.root.querySelector('.match-announcement'); this.ui.interact = this.root.querySelector('.interaction-prompt'); this.ui.damage = this.root.querySelector('.damage-vignette'); this.ui.outside = this.root.querySelector('.outside-zone');this.ui.direction=this.root.querySelector('.damage-direction'); this.ui.cooldown = this.root.querySelector('.cooldown');
    this.ui.crosshair = this.root.querySelector('.aim-crosshair'); this.ui.aimMode = this.root.querySelector('.aim-mode');this.ui.mobileCooldown=this.root.querySelector('.mobile-cooldown');this.ui.mobileAds=this.root.querySelector('.mobile-action.ads');this.ui.mobileSwap=this.root.querySelector('.mobile-action.swap');
  }

  initThree() {
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#82928b'); this.scene.fog = new THREE.FogExp2('#7b8980', .00135);
    this.camera = new THREE.PerspectiveCamera(62, 1, .1, 3600);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.qualityDpr); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    this.renderer.domElement.className = 'game-canvas'; this.renderer.domElement.setAttribute('aria-label', 'Real-time 3D Ashfall battleground');
    this.root.querySelector('.three-mount').append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#d7e6dc', '#313b2c', 2.2));
    const sun = new THREE.DirectionalLight('#ffe4bc', 3.4); sun.position.set(-160, 240, 90); sun.castShadow = true;
    const shadowSize=matchMedia('(pointer:coarse)').matches?1024:2048;sun.shadow.mapSize.set(shadowSize,shadowSize); sun.shadow.camera.left = sun.shadow.camera.bottom = -150; sun.shadow.camera.right = sun.shadow.camera.top = 150; sun.shadow.camera.far = 650; sun.shadow.bias = -.00035;
    this.scene.add(sun); this.sun = sun;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 18), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color('#334c5c') }, bottom: { value: new THREE.Color('#e0b27c') } }, vertexShader: 'varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}', fragmentShader: 'varying vec3 vPos;uniform vec3 top;uniform vec3 bottom;void main(){float h=normalize(vPos).y;gl_FragColor=vec4(mix(bottom,top,smoothstep(-0.12,0.65,h)),1.0);}' }));
    this.scene.add(sky);this.sky=sky;
    this.raycaster = new THREE.Raycaster(); this.sharedParticleGeo = new THREE.BoxGeometry(.16, .16, .16); this.bulletGeo = new THREE.BoxGeometry(.07, .07, 2.4);
    const ashCount=650,ashPositions=new Float32Array(ashCount*3);for(let i=0;i<ashCount;i++){ashPositions[i*3]=rand(-85,85);ashPositions[i*3+1]=rand(0,55);ashPositions[i*3+2]=rand(-85,85);}
    const ashGeo=new THREE.BufferGeometry();ashGeo.setAttribute('position',new THREE.BufferAttribute(ashPositions,3));this.ash=new THREE.Points(ashGeo,new THREE.PointsMaterial({color:'#e4d4b7',size:.12,transparent:true,opacity:.48,depthWrite:false}));this.scene.add(this.ash);
  }

  buildWorld() {
    const ocean=new THREE.Mesh(new THREE.PlaneGeometry(6000,6000),new THREE.MeshStandardMaterial({color:'#294f58',metalness:.35,roughness:.24,transparent:true,opacity:.94}));ocean.rotation.x=-Math.PI/2;ocean.position.y=-1.6;this.scene.add(ocean);this.ocean=ocean;
    const beach=new THREE.Mesh(new THREE.PlaneGeometry(WORLD+42,WORLD+42),new THREE.MeshStandardMaterial({color:'#a99b72',roughness:1}));beach.rotation.x=-Math.PI/2;beach.position.y=-.12;this.scene.add(beach);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, WORLD,48,48), new THREE.MeshStandardMaterial({ map: groundTexture(), color: '#859078', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
    const fieldMats=['#697354','#7b7653','#52674d'].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,transparent:true,opacity:.24,depthWrite:false}));for(let i=0;i<28;i++){const field=new THREE.Mesh(new THREE.CircleGeometry(rand(35,110),24),pick(fieldMats));field.rotation.x=-Math.PI/2;field.position.set(rand(-1050,1050),.018,rand(-1050,1050));field.scale.y=rand(.45,.9);this.scene.add(field);}
    const roadMat = new THREE.MeshStandardMaterial({ color: '#4a4c43', roughness: .97 });
    const road1 = new THREE.Mesh(new THREE.PlaneGeometry(WORLD, 28), roadMat); road1.rotation.x = -Math.PI / 2; road1.position.y = .025; road1.receiveShadow = true; this.scene.add(road1);
    const road2 = road1.clone(); road2.rotation.z = Math.PI / 2; this.scene.add(road2);const road3=new THREE.Mesh(new THREE.PlaneGeometry(WORLD*1.25,16),roadMat);road3.rotation.x=-Math.PI/2;road3.rotation.z=Math.PI/4;road3.position.y=.022;this.scene.add(road3);
    // Districts: solid structures, rooftops, doors, windows, and cover.
    const districts = [{ x: -820, z: -760, name: 'RELAY' }, { x: 720, z: -790, name: 'DRYDOCK' }, { x: -790, z: 690, name: 'QUARRY' }, { x: 760, z: 720, name: 'FOUNDRY' }, { x: -80, z: -70, name: 'ARRAY' }, { x: -850, z: -40, name: 'HARBOR' }, { x: 790, z: -40, name: 'OUTPOST' }];
    this.districts = districts;
    districts.forEach((d, di) => {
      for (let i = 0; i < 6; i++) {
        const w = rand(18, 32), dep = rand(16, 28), h = rand(9, 18), x = d.x + (i % 3) * 50, z = d.z + Math.floor(i / 3) * 65;
        this.addBuilding(x, z, w, dep, h, di % 2);
        for (let j = 0; j < 2; j++) this.addLoot(x + rand(-w / 3, w / 3), z + dep / 2 + rand(5, 10));
      }
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 2, 35, 8), new THREE.MeshStandardMaterial({ color: '#59625b', metalness: .65, roughness: .5 })); tower.position.set(d.x - 25, 17.5, d.z - 30); tower.castShadow = true; this.scene.add(tower);
      const dish = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 8, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#899188', side: THREE.DoubleSide, metalness: .5, roughness: .55 })); dish.scale.y = .25; dish.rotation.x = -.5; dish.position.set(d.x - 25, 36, d.z - 30); this.scene.add(dish);
    });
    for (let i = 0; i < 110; i++) this.addCrate(rand(-1140, 1140), rand(-1140, 1140));
    this.addNature();
    this.addMountains();
    for (let i = 0; i < 90; i++) this.addLoot(rand(-1100, 1100), rand(-1100, 1100));
    this.player = { x: 25, z: 35, r: 1.05, hp: 100, armor: 50, angle: 0, speed: 18, dead: false, weapons: [cloneWeapon(this.config.weapon.id)], slot: 0, fireCd: 0, reload: 0, dashCd: 0, dashTime: 0, abilityCd: 0, effect: 0, ghost: false, barrier: false, hitFlash: 0, jumpY: 0, vy: 0, moving: 0 };
    this.player.mesh = createCharacter(this.config.operator.color); this.scene.add(this.player.mesh);
    this.bots = [];
    const count = this.config.mode === 'blitz' ? 11 : 23;
    for (let i = 0; i < count; i++) {
      let p; do { p = { x: rand(-1110, 1110), z: rand(-1110, 1110) }; } while (this.collides(p.x, p.z, 2) || dist(p, this.player) < 100);
      const b = { ...p, r: 1.05, hp: 100, armor: Math.random() < .55 ? 25 : 0, name: BOT_NAMES[i], dead: false, angle: rand(0, TAU), speed: rand(10, 13), weapon: cloneWeapon(pick(['raven','raven','viper','longbow'])), fireCd: rand(0, 1), reload: 0, think: 0, target: null, wander: rand(0, TAU), skill: rand(.45, .85), strafe: Math.random() < .5 ? -1 : 1, hitFlash: 0, moving: 0 };
      b.mesh = createCharacter('#d16650', true); b.mesh.scale.setScalar(.96); this.scene.add(b.mesh); this.addNameplate(b); this.bots.push(b);
    }
    this.addLoot(this.player.x + 7, this.player.z - 6, 'armor');
    this.createZone(); this.planZone(); this.syncActor(this.player, 0); this.updateCamera(1);
  }

  setupDeployment(){
    this.flightTime=0;this.transportPlane=createTransportPlane();this.transportPlane.position.set(-1080,125,-430);this.transportPlane.rotation.y=Math.atan2(2160,-860);this.scene.add(this.transportPlane);
    this.player.mesh.visible=false;this.root.classList.add('is-deploying');this.ui.deployment=this.root.querySelector('.deployment-hud');this.ui.deployPhase=this.root.querySelector('#deployment-phase');this.ui.deployAltitude=this.root.querySelector('#deployment-altitude');this.ui.deploySpeed=this.root.querySelector('#deployment-speed');this.ui.deployAction=this.root.querySelector('.deployment-action');
    this.camera.position.set(-1110,137,-405);this.camera.lookAt(this.transportPlane.position);if(matchMedia('(pointer:coarse)').matches)this.ui.deployment.querySelector('p').textContent='USE THE LEFT STICK TO STEER · TAP ABOVE TO CONTROL DESCENT';this.updateDeploymentUI();
  }
  startJump(){
    if(this.phase!=='flight')return;this.phase='freefall';const p=this.player;p.x=clamp(this.transportPlane.position.x,-WORLD/2+30,WORLD/2-30);p.z=clamp(this.transportPlane.position.z,-WORLD/2+30,WORLD/2-30);p.jumpY=this.transportPlane.position.y-5;p.vy=-8;p.mesh.visible=true;p.angle=this.transportPlane.rotation.y;this.yaw=p.angle;this.pitch=-.28;
    this.announce('FREEFALL',this.coarse?'USE THE LEFT STICK · TAP TO OPEN PARACHUTE':'STEER YOUR DROP · SPACE TO OPEN PARACHUTE','DEPLOYMENT // MANUAL CONTROL');this.sound.tone(90,.4,'sawtooth',.025,-35);this.updateDeploymentUI();
  }
  openParachute(){
    if(this.phase!=='freefall')return;this.phase='parachute';this.pitch=-.12;this.parachute=createParachuteRig();this.scene.add(this.parachute);this.announce('PARACHUTE DEPLOYED',this.coarse?'GUIDE YOUR LANDING WITH THE LEFT STICK':'GUIDE YOUR LANDING WITH WASD','DESCENT CONTROL // CANOPY OPEN');this.sound.tone(170,.22,'sine',.035,130);this.updateDeploymentUI();
  }
  landPlayer(){
    if(this.phase==='combat')return;const p=this.player;p.jumpY=0;p.vy=0;this.phase='combat';this.root.classList.remove('is-deploying');this.root.classList.add('is-combat');
    if(this.parachute){this.scene.remove(this.parachute);this.parachute=null;}if(this.transportPlane){this.scene.remove(this.transportPlane);this.transportPlane=null;}
    if(this.collides(p.x,p.z,p.r)){for(let r=4;r<35;r+=4){let found=false;for(let i=0;i<12;i++){const a=i/12*TAU,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;if(!this.collides(x,z,p.r)){p.x=x;p.z=z;found=true;break;}}if(found)break;}}
    this.addLoot(p.x+5,p.z-5,'armor');this.impact(new THREE.Vector3(p.x,.3,p.z),'#c6b68c',18,4);this.announce('BOOTS ON THE GROUND','LOOT · ENGAGE · SURVIVE','BLACKOUT ISLAND // COMBAT ACTIVE');this.updateCamera(1);this.updateDeploymentUI();
  }
  updateDeployment(dt){
    this.flightTime+=dt;const p=this.player;
    if(this.transportPlane){this.transportPlane.position.x=-1080+this.flightTime*92;this.transportPlane.position.z=-430+this.flightTime*36.5;this.transportPlane.userData.propellers.forEach((prop,i)=>prop.rotation.z+=dt*(28+i*2));}
    if(this.phase==='flight'){
      const plane=this.transportPlane,mobile=matchMedia('(pointer:coarse)').matches,offset=mobile?new THREE.Vector3(-43,23,39):new THREE.Vector3(-27,12,24);this.camera.position.lerp(plane.position.clone().add(offset),1-Math.pow(.002,dt));this.camera.lookAt(plane.position.x+4,plane.position.y,plane.position.z);if(this.flightTime>11.5)this.startJump();
    }else{
      let dx=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0),dz=(this.keys.KeyS?1:0)-(this.keys.KeyW?1:0);if(this.touchMove){dx=this.touchMove.x;dz=this.touchMove.y;}const len=Math.hypot(dx,dz)||1,sin=Math.sin(this.yaw),cos=Math.cos(this.yaw),speed=this.phase==='parachute'?15:25,mx=(dx/len)*cos-(dz/len)*sin,mz=(dx/len)*sin+(dz/len)*cos;
      p.x=clamp(p.x+mx*speed*dt,-WORLD/2+12,WORLD/2-12);p.z=clamp(p.z+mz*speed*dt,-WORLD/2+12,WORLD/2-12);p.moving=lerp(p.moving,Math.hypot(dx,dz)>.1?.35:0,dt*5);p.angle=this.yaw;
      if(this.phase==='freefall'){p.jumpY-=dt*Math.min(38,16+this.flightTime*.6);p.mesh.rotation.x=lerp(p.mesh.rotation.x,-.65,dt*3);if(p.jumpY<34)this.openParachute();}
      else{p.jumpY-=dt*6.8;p.mesh.rotation.x=lerp(p.mesh.rotation.x,0,dt*5);this.parachute.position.set(p.x,p.jumpY+7,p.z);this.parachute.rotation.y+=dt*.06;const pulse=1+Math.sin(this.flightTime*2)*.012;this.parachute.scale.set(pulse,1,pulse);}
      if(p.jumpY<=0)this.landPlayer();else{this.syncActor(p,dt);this.updateCamera(dt);}
    }
    this.updateAtmosphere(dt);this.updateParticles(dt);this.updateDeploymentUI();this.updateUI();
  }
  updateDeploymentUI(){
    if(!this.ui.deployment)return;const active=this.phase!=='combat';this.ui.deployment.classList.toggle('active',active);if(!active)return;const altitude=Math.max(0,Math.round(this.phase==='flight'?this.transportPlane?.position.y||120:this.player.jumpY));this.ui.deployAltitude.textContent=altitude+' M';this.ui.deploySpeed.textContent=this.phase==='flight'?'280 KM/H':this.phase==='freefall'?'164 KM/H':'32 KM/H';this.ui.deployPhase.textContent=this.phase==='flight'?'TRANSPORT INBOUND':this.phase==='freefall'?'FREEFALL // MANUAL':'PARACHUTE // STEER TO LAND';this.ui.deployAction.innerHTML=this.phase==='flight'?'JUMP FROM PLANE <kbd>SPACE</kbd>':this.phase==='freefall'?'OPEN PARACHUTE <kbd>SPACE</kbd>':(this.coarse?'PARACHUTE OPEN · USE LEFT STICK':'PARACHUTE OPEN · STEER WITH WASD');this.ui.deployAction.disabled=this.phase==='parachute';
  }

  loadAdvancedSoldiers(){
    new GLTFLoader().load('/models/soldier.glb',asset=>{
      if(!this.running)return;this.soldierAsset=asset;
      [this.player,...this.bots].forEach(actor=>this.upgradeSoldier(actor,asset));
      if(this.phase==='combat')this.announce('ELITE MODELS ONLINE','ADVANCED SKELETAL ANIMATION ACTIVE','ASHFALL // RENDERER UPGRADED');
    },undefined,()=>{/* Detailed procedural soldiers remain as an offline fallback. */});
  }
  upgradeSoldier(actor,asset){
    const old=actor.mesh,wrapper=new THREE.Group(),model=cloneSkeleton(asset.scene),enemy=actor!==this.player;
    // Soldier.glb uses a 0.01 root transform and skinned bounds are not world-space.
    // Calibrated scale produces a 4.4m operator without reading raw skinned bounds.
    model.scale.setScalar(2.45);model.position.set(0,0,0);model.rotation.y=0;wrapper.add(model);
    const materials=[];
    model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.roughness=.68;o.material.metalness=.16;o.material.color.multiply(new THREE.Color(enemy?'#e5b0a2':'#c7eee0'));materials.push(o.material);}});
    const rifle=createRifle(enemy?'#ef725b':this.config.operator.color);rifle.position.set(.62,2.55,-.55);rifle.scale.setScalar(.72);wrapper.add(rifle);
    // Emissive operator identifiers and shoulder armor add a distinct combat silhouette.
    const accentMat=new THREE.MeshStandardMaterial({color:enemy?'#ef725b':this.config.operator.color,emissive:enemy?'#ef725b':this.config.operator.color,emissiveIntensity:1.4,metalness:.5,roughness:.3});
    for(const side of [-1,1]){const light=new THREE.Mesh(new THREE.SphereGeometry(.09,10,8),accentMat);light.position.set(side*.82,3.35,-.28);wrapper.add(light);}
    // Independent high-detail equipment remains crisp behind the animated skeletal mesh.
    const gear=new THREE.Group(),plateMat=new THREE.MeshStandardMaterial({color:enemy?'#493631':'#33463f',metalness:.48,roughness:.5}),strapMat=new THREE.MeshStandardMaterial({color:'#171f1c',roughness:.9});
    const backpack=new THREE.Mesh(new THREE.CapsuleGeometry(.48,.65,5,10),plateMat);backpack.position.set(0,2.48,.49);backpack.scale.set(.75,.75,.35);backpack.castShadow=true;gear.add(backpack);
    const bedroll=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.05,12),strapMat);bedroll.rotation.z=Math.PI/2;bedroll.position.set(0,1.83,.67);gear.add(bedroll);
    for(const x of [-.34,.34]){const strap=new THREE.Mesh(new THREE.BoxGeometry(.10,1.25,.055),strapMat);strap.position.set(x,2.45,.91);gear.add(strap);const pouch=new THREE.Mesh(new THREE.BoxGeometry(.29,.48,.22),plateMat);pouch.position.set(x,1.92,-.52);gear.add(pouch);}
    const panel=new THREE.Mesh(new THREE.BoxGeometry(.72,.60,.16),plateMat);panel.position.set(0,2.52,-.55);gear.add(panel);const identifier=new THREE.Mesh(new THREE.BoxGeometry(.46,.055,.025),accentMat);identifier.position.set(0,2.63,-.65);gear.add(identifier);
    const antenna=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.75,6),strapMat);antenna.position.set(.37,3.18,.61);antenna.rotation.z=-.12;gear.add(antenna);wrapper.add(gear);
    wrapper.position.copy(old.position);wrapper.rotation.copy(old.rotation);wrapper.visible=old.visible;if(actor.nameplate){old.remove(actor.nameplate);wrapper.add(actor.nameplate);}
    this.scene.remove(old);this.scene.add(wrapper);actor.mesh=wrapper;
    const mixer=new THREE.AnimationMixer(model),actions={};
    asset.animations.forEach(clip=>{actions[clip.name]=mixer.clipAction(clip);});
    const idle=actions.Idle||asset.animations[0]&&mixer.clipAction(asset.animations[0]);if(idle)idle.play();
    wrapper.userData={advanced:true,mixer,actions,current:'Idle',weapon:rifle,materials,accent:accentMat};
  }

  addBuilding(x, z, w, d, h, tone) {
    const group = new THREE.Group(); group.position.set(x, 0, z); this.scene.add(group);
    const surface=concreteTexture(),wallMat = new THREE.MeshStandardMaterial({ map:surface,bumpMap:surface,bumpScale:.16,color: tone ? '#a0a494' : '#969383', roughness: .91, metalness: .04 });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); wall.position.y = h / 2; wall.castShadow = wall.receiveShadow = true; group.add(wall); this.cameraBlockers.push(wall);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, .7, d + 1), new THREE.MeshStandardMaterial({ color: '#353d39', roughness: .75, metalness: .3 })); roof.position.y = h + .2; roof.castShadow = true; group.add(roof);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w + .2, .35, d + .2), new THREE.MeshStandardMaterial({ color: '#b07043', roughness: .7 })); trim.position.y = h * .7; group.add(trim);
    const windowMat = new THREE.MeshStandardMaterial({ color: '#182b2e', emissive: '#38605d', emissiveIntensity: .25, metalness: .7, roughness: .2 });
    for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) { const win = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.1), windowMat); win.position.set(i * w * .25, h * .55, side * (d / 2 + .01)); if (side < 0) win.rotation.y = Math.PI; group.add(win); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(3, 5), new THREE.MeshStandardMaterial({ color: '#2c3430', roughness: .8 })); door.position.set(0, 2.5, d / 2 + .02); group.add(door);
    const metal=new THREE.MeshStandardMaterial({color:'#3e4844',metalness:.68,roughness:.38});
    // Roof parapets, HVAC, exhaust vents, access ladder and door framing.
    for(const side of [-1,1]){const p1=new THREE.Mesh(new THREE.BoxGeometry(w+1,1,.45),metal);p1.position.set(0,h+.8,side*d/2);group.add(p1);const p2=new THREE.Mesh(new THREE.BoxGeometry(.45,1,d),metal);p2.position.set(side*w/2,h+.8,0);group.add(p2);}
    const ac=new THREE.Mesh(new THREE.BoxGeometry(4,2,3),metal);ac.position.set(-w*.2,h+1.5,0);ac.castShadow=true;group.add(ac);
    for(let i=0;i<3;i++){const vent=new THREE.Mesh(new THREE.CylinderGeometry(.65,.65,.18,16),new THREE.MeshStandardMaterial({color:'#1e2927',metalness:.8,roughness:.3}));vent.position.set(-w*.2-1.2+i*1.2,h+2.52,0);group.add(vent);}
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.25,.25,h*.72,10),metal);pipe.position.set(w/2+.3,h*.38,-d*.25);group.add(pipe);
    for(let y=1;y<h-1;y+=1.1){const rung=new THREE.Mesh(new THREE.BoxGeometry(1.4,.10,.12),metal);rung.position.set(-w/2-.15,y,-d*.25);group.add(rung);}
    const frame=new THREE.Mesh(new THREE.BoxGeometry(3.6,5.5,.22),metal);frame.position.set(0,2.65,d/2-.03);group.add(frame);door.position.z=d/2+.10;mergeBuildingParts(group,metal);mergeBuildingParts(group,windowMat);
    this.obstacles.push({ x, z, w, d, h });
  }
  addCrate(x, z) {
    if (this.collides(x, z, 4) || Math.hypot(x - 25, z - 35) < 25) return;
    const w=rand(2.5,4.5),h=rand(2.5,4),group=new THREE.Group();group.position.set(x,0,z);group.rotation.y=rand(0,TAU);this.scene.add(group);
    const wood=new THREE.MeshStandardMaterial({color:'#776647',roughness:.83,metalness:.08}),steel=new THREE.MeshStandardMaterial({color:'#363e38',roughness:.42,metalness:.72});
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,w),wood);m.position.y=h/2;m.castShadow=m.receiveShadow=true;group.add(m);
    for(const side of [-1,1]){const band=new THREE.Mesh(new THREE.BoxGeometry(.18,h+.12,w+.12),steel);band.position.set(side*w*.32,h/2,0);group.add(band);const edge=new THREE.Mesh(new THREE.BoxGeometry(w+.15,.16,.18),steel);edge.position.set(0,side<0?.12:h-.12,w/2+.02);group.add(edge);}
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(w*.38,w*.38),new THREE.MeshBasicMaterial({color:'#d4b85b'}));mark.position.set(0,h*.55,w/2+.011);group.add(mark);
    this.obstacles.push({ x, z, w: w * 1.35, d: w * 1.35, h });
  }
  addNature() {
    const count = this.coarse?320:520, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .5, 4, 6), new THREE.MeshStandardMaterial({ color: '#3d3325', roughness: 1 }), count);
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(3.4, 1), new THREE.MeshStandardMaterial({ color: '#263e2c', roughness: .95 }), count);
    const crownTop = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(2.5, 0), new THREE.MeshStandardMaterial({ color: '#35543b', roughness: .92 }), count);
    const dummy = new THREE.Object3D(); let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = rand(-1160, 1160), z = rand(-1160, 1160); if (this.collides(x, z, 5) || Math.abs(x) < 24 || Math.abs(z) < 24 || Math.hypot(x - 25, z - 35) < 35) continue;
      const s = rand(.7, 1.5); dummy.position.set(x, 2 * s, z); dummy.scale.setScalar(s); dummy.rotation.y = rand(0, TAU); dummy.updateMatrix(); trunk.setMatrixAt(placed, dummy.matrix);
      dummy.position.y = 6 * s; dummy.updateMatrix(); crown.setMatrixAt(placed, dummy.matrix);dummy.position.y=9*s;dummy.scale.setScalar(s*.9);dummy.updateMatrix();crownTop.setMatrixAt(placed,dummy.matrix); placed++;
    }
    trunk.count = crown.count = crownTop.count = placed; trunk.castShadow = crown.castShadow = crownTop.castShadow = true; trunk.receiveShadow = true; this.scene.add(trunk, crown, crownTop);
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1.5, 1), new THREE.MeshStandardMaterial({ color: '#646b5e', roughness: 1 }), this.coarse?130:220);
    for (let i = 0; i < (this.coarse?130:220); i++) { dummy.position.set(rand(-1140,1140), rand(.2,.8), rand(-1140,1140)); dummy.scale.set(rand(.5,2.5),rand(.5,1.5),rand(.5,2.3)); dummy.rotation.set(rand(0,1),rand(0,TAU),0); dummy.updateMatrix(); rocks.setMatrixAt(i,dummy.matrix); } rocks.castShadow = true; this.scene.add(rocks);
    const grass=new THREE.InstancedMesh(new THREE.ConeGeometry(.32,1.4,3),new THREE.MeshStandardMaterial({color:'#71805a',roughness:1}),this.coarse?450:900);for(let i=0;i<(this.coarse?450:900);i++){dummy.position.set(rand(-1150,1150),.55,rand(-1150,1150));dummy.scale.set(rand(.5,1.4),rand(.5,1.3),rand(.5,1.4));dummy.rotation.set(0,rand(0,TAU),0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);}this.scene.add(grass);
  }
  addMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: '#46534b', roughness: 1, flatShading: true });
    const mountainCount=this.coarse?36:56;for (let i = 0; i < mountainCount; i++) { const a = i / mountainCount * TAU, r = rand(1320, 1580), h = rand(80, 180); const geo=new THREE.ConeGeometry(rand(55,115),h,9,4),positions=geo.attributes.position;for(let v=0;v<positions.count;v++){const y=positions.getY(v);if(Math.abs(y)<h*.48){positions.setX(v,positions.getX(v)*rand(.86,1.14));positions.setZ(v,positions.getZ(v)*rand(.86,1.14));}}geo.computeVertexNormals();const m = new THREE.Mesh(geo, mat);m.position.set(Math.cos(a)*r,h/2-8,Math.sin(a)*r); m.rotation.y=rand(0,TAU); this.scene.add(m); }
  }
  addNameplate(bot) {
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=48;const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
    sprite.position.y=5.5;sprite.scale.set(6,1.15,1);bot.mesh.add(sprite);bot.nameplate=sprite;bot.nameCanvas=canvas;bot.nameTexture=texture;this.refreshNameplate(bot);
  }
  refreshNameplate(bot){if(!bot.nameCanvas)return;const c=bot.nameCanvas.getContext('2d');c.clearRect(0,0,256,48);c.font='600 20px monospace';c.textAlign='center';c.fillStyle='#f0e9df';c.fillText(bot.name.toUpperCase(),128,21);c.fillStyle='#251713';c.fillRect(48,29,160,8);c.fillStyle=bot.hp<30?'#ff3f35':'#e16b54';c.fillRect(48,29,160*clamp(bot.hp/100,0,1),8);if(bot.armor>0){c.fillStyle='#75bfd2';c.fillRect(48,39,160*clamp(bot.armor/100,0,1),3);}bot.nameTexture.needsUpdate=true;}
  addLoot(x, z, forced) {
    if (this.collides(x,z,1)) return;
    const roll = Math.random(), type = forced || (roll < .2 ? 'medkit' : roll < .4 ? 'armor' : roll < .72 ? 'ammo' : 'weapon');
    const l = { x, z, type, amount: type === 'medkit' ? 45 : type === 'armor' ? 40 : 60, weapon: type === 'weapon' ? pick(Object.keys(WEAPONS).filter(w => w !== this.config.weapon.id)) : null, bob: rand(0,TAU) };
    const colors = { medkit:'#79d59c', armor:'#72bcd3', ammo:'#e8c469', weapon:'#df8cff' }, color = colors[type];
    const group = new THREE.Group(); group.position.set(x,.8,z);
    const core = new THREE.Mesh(new THREE.BoxGeometry(1.1,1.1,1.1), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.3, metalness:.4,roughness:.3 })); core.rotation.set(.3,.4,0); group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4,.045,6,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75}));ring.rotation.x=Math.PI/2;group.add(ring);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.18,.7,8,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=3.5;group.add(beam);
    if(type==='weapon'){core.visible=false;const gun=createRifle(color);gun.scale.setScalar(.32);gun.rotation.y=Math.PI/2;group.add(gun);l.core=gun;}
    else if(type==='medkit'){const crossMat=new THREE.MeshBasicMaterial({color:'#effff3'});const v=new THREE.Mesh(new THREE.BoxGeometry(.25,.8,1.14),crossMat),h=new THREE.Mesh(new THREE.BoxGeometry(.8,.25,1.14),crossMat);group.add(v,h);}
    else if(type==='ammo'){for(let i=-1;i<=1;i++){const round=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.85,10),new THREE.MeshStandardMaterial({color:'#f3d58a',metalness:.8,roughness:.25}));round.position.set(i*.32,.65,0);group.add(round);}}
    else{const shield=new THREE.Mesh(new THREE.OctahedronGeometry(.65,0),new THREE.MeshStandardMaterial({color:'#c5f4ff',emissive:color,emissiveIntensity:.55,metalness:.7,roughness:.2}));shield.position.y=.8;group.add(shield);}
    l.mesh=group;if(!l.core)l.core=core;this.scene.add(group);this.loot.push(l);
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
      if(e.code==='Space'){if(this.phase==='flight')this.startJump();else if(this.phase==='freefall')this.openParachute();else this.jump();}
    },s);
    window.addEventListener('keyup',e=>this.keys[e.code]=false,s);
    document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&!this.paused){this.yaw-=e.movementX*.0023;this.pitch=clamp(this.pitch-e.movementY*.0019,-.65,.48);}},s);
    canvas.addEventListener('pointerdown',e=>{this.sound.init();if(e.pointerType==='mouse'){if(e.button===0){this.mouse.down=true;this.mouse.clicked=true;if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();}if(e.button===2)this.mouse.ads=true;}else{this.touchLook={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}},s);
    canvas.addEventListener('pointermove',e=>{if(this.touchLook&&this.touchLook.id===e.pointerId){this.yaw-=(e.clientX-this.touchLook.x)*.006;this.pitch=clamp(this.pitch-(e.clientY-this.touchLook.y)*.004,-.65,.48);this.touchLook.x=e.clientX;this.touchLook.y=e.clientY;}},s);
    window.addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){if(e.button===0)this.mouse.down=false;if(e.button===2)this.mouse.ads=false;}if(this.touchLook?.id===e.pointerId)this.touchLook=null;if(this.mobileFirePointer===e.pointerId){this.mobileFirePointer=null;this.mouse.down=false;this.mobileFire=false;}},s);window.addEventListener('pointercancel',e=>{if(e.pointerType==='mouse'){this.mouse.down=false;this.mouse.ads=false;}if(this.touchLook?.id===e.pointerId)this.touchLook=null;if(this.mobileFirePointer===e.pointerId){this.mobileFirePointer=null;this.mouse.down=false;this.mobileFire=false;}},s);
    canvas.addEventListener('contextmenu',e=>e.preventDefault(),s);
    this.root.querySelector('.pause-button').onclick=()=>this.togglePause();this.root.querySelector('.deployment-action').onclick=()=>{if(this.phase==='flight')this.startJump();else if(this.phase==='freefall')this.openParachute();};this.root.querySelector('.ability-button').onclick=()=>this.ability();this.root.querySelectorAll('.weapon-slot').forEach(b=>b.onclick=()=>this.switchWeapon(+b.dataset.slot));
    const stick=this.root.querySelector('.move-stick'),knob=stick.querySelector('.stick-knob');
    const moveStick=e=>{const r=stick.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2,len=Math.hypot(x,y),max=r.width*.32,nx=len?x/Math.max(len,max):0,ny=len?y/Math.max(len,max):0;this.touchMove={x:nx,y:ny};knob.style.transform=`translate(${nx*max}px,${ny*max}px)`;};
    stick.addEventListener('pointerdown',e=>{stick.setPointerCapture(e.pointerId);moveStick(e);},s);stick.addEventListener('pointermove',e=>{if(stick.hasPointerCapture(e.pointerId))moveStick(e);},s);
    const endStick=()=>{this.touchMove={x:0,y:0};knob.style.transform='';};stick.addEventListener('pointerup',endStick,s);stick.addEventListener('pointercancel',endStick,s);
    const fire=this.root.querySelector('.mobile-fire');fire.addEventListener('pointerdown',e=>{e.preventDefault();this.mobileFirePointer=e.pointerId;fire.setPointerCapture?.(e.pointerId);this.mouse.down=true;this.mouse.clicked=true;this.mobileFire=true;this.sound.init();},s);const releaseFire=e=>{if(e.pointerId===this.mobileFirePointer){this.mobileFirePointer=null;this.mouse.down=false;this.mobileFire=false;}};fire.addEventListener('pointerup',releaseFire,s);fire.addEventListener('pointercancel',releaseFire,s);
    this.root.querySelector('.mobile-action.dash').onclick=()=>this.dash();this.root.querySelector('.mobile-action.interact').onclick=()=>this.interact();this.root.querySelector('.mobile-action.reload').onclick=()=>this.reload();this.root.querySelector('.mobile-action.jump').onclick=()=>this.jump();this.root.querySelector('.mobile-action.ability').onclick=()=>this.ability();this.ui.mobileAds.onclick=()=>{this.mouse.ads=!this.mouse.ads;this.ui.mobileAds.classList.toggle('active',this.mouse.ads);this.ui.mobileAds.setAttribute('aria-pressed',String(this.mouse.ads));};this.ui.mobileSwap.onclick=()=>this.switchWeapon(this.player.slot===0?1:0);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&!this.ended&&!this.paused)this.togglePause();},s);
  }
  resize(){this.width=this.root.clientWidth;this.height=this.root.clientHeight;this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);}
  collides(x,z,r){if(x<-WORLD/2+r+5||z<-WORLD/2+r+5||x>WORLD/2-r-5||z>WORLD/2-r-5)return true;return this.obstacles.some(o=>x+r>o.x-o.w/2&&x-r<o.x+o.w/2&&z+r>o.z-o.d/2&&z-r<o.z+o.d/2);}
  move(e,dx,dz){if(!this.collides(e.x+dx,e.z,e.r))e.x+=dx;if(!this.collides(e.x,e.z+dz,e.r))e.z+=dz;}
  lineClear(a,b){const steps=Math.ceil(dist(a,b)/8);for(let i=1;i<steps;i++){const t=i/steps,x=lerp(a.x,b.x,t),z=lerp(a.z,b.z,t);if(this.obstacles.some(o=>x>o.x-o.w/2&&x<o.x+o.w/2&&z>o.z-o.d/2&&z<o.z+o.d/2))return false;}return true;}

  loop(now){if(!this.running)return;const raw=Math.max(0,(now-this.last)/1000),dt=Math.min(raw,.04);this.last=now;if(!this.paused&&!this.ended)this.update(dt);this.render(dt);this.monitorPerformance(raw);this.frame=requestAnimationFrame(t=>this.loop(t));}
  monitorPerformance(dt){
    if(document.hidden||dt>2)return;const s=this.perfSample;s.time+=dt;s.frames++;if(s.time<4)return;const fps=s.frames/s.time,target=Math.min(devicePixelRatio||1,this.coarse?1.1:1.5);let next=this.qualityDpr;
    if(fps<28)next=Math.max(this.coarse?.6:.75,next-.15);else if(fps>56&&!this.lowShadows)next=Math.min(target,next+.08);
    if(Math.abs(next-this.qualityDpr)>.01){this.qualityDpr=next;this.renderer.setPixelRatio(next);this.renderer.setSize(this.width,this.height);}
    s.low=fps<24?(s.low||0)+1:0;if(this.coarse&&s.low>=2&&!this.lowShadows){this.lowShadows=true;this.sun.castShadow=false;this.renderer.shadowMap.enabled=false;this.ash.material.opacity=.25;}
    s.time=0;s.frames=0;
  }
  update(dt){
    if(this.phase!=='combat'){this.updateDeployment(dt);return;}
    this.time+=dt;const p=this.player;p.fireCd-=dt;p.dashCd-=dt;p.abilityCd-=dt;p.effect-=dt;p.hitFlash-=dt;if(p.effect<=0){p.ghost=false;p.barrier=false;}
    if(p.reload>0){p.reload-=dt;if(p.reload<=0)this.finishReload(p,p.weapons[p.slot]);}
    let dx=(this.keys.KeyD?1:0)-(this.keys.KeyA?1:0),dz=(this.keys.KeyS?1:0)-(this.keys.KeyW?1:0);if(this.touchMove){dx=this.touchMove.x;dz=this.touchMove.y;}
    const len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;const sin=Math.sin(this.yaw),cos=Math.cos(this.yaw);let mx=dx*cos-dz*sin,mz=dx*sin+dz*cos;
    let speed=p.speed*(this.config.operator.id==='volt'&&p.effect>0?1.55:1)*(this.mouse.ads?.72:1);if(p.dashTime>0){p.dashTime-=dt;speed*=3.2;if(!mx&&!mz){mx=sin;mz=-cos;}}
    const oldX=p.x,oldZ=p.z;this.move(p,mx*speed*dt,mz*speed*dt);p.angle=this.yaw;
    const actualSpeed=Math.hypot(p.x-oldX,p.z-oldZ)/Math.max(dt,.001);p.moving=lerp(p.moving,clamp(actualSpeed/p.speed,0,2),clamp(dt*16,0,1));p.localStrafe=dx;p.localForward=-dz;
    if(p.jumpY>0||p.vy>0){p.vy-=20*dt;p.jumpY+=p.vy*dt;if(p.jumpY<0){p.jumpY=0;p.vy=0;this.impact(new THREE.Vector3(p.x,.15,p.z),'#a89e7c',5,1.5);}}
    if(this.mobileFire){const target=this.bots.filter(b=>!b.dead&&dist(p,b)<p.weapons[p.slot].range&&this.lineClear(p,b)).sort((a,b)=>dist(p,a)-dist(p,b))[0];if(target){this.yaw=Math.atan2(target.x-p.x,-(target.z-p.z));p.angle=this.yaw;}}
    const weapon=p.weapons[p.slot];if((this.mouse.down&&weapon.auto)||this.mouse.clicked)this.shoot(p,weapon,true);this.mouse.clicked=false;
    this.updateBots(dt);this.updateBullets(dt);this.updateZone(dt);this.updateAirdrops(dt);this.updateAtmosphere(dt);this.updateParticles(dt);this.syncActor(p,dt);
    for(const l of this.loot){l.bob+=dt;l.mesh.position.y=.85+Math.sin(l.bob*2)*.18;l.core.rotation.y+=dt*.8;l.mesh.rotation.y+=dt*.25;}
    const nearby=this.loot.filter(l=>dist(l,p)<4.5).sort((a,b)=>dist(a,p)-dist(b,p))[0];this.nearbyLoot=nearby||null;this.ui.interact.classList.toggle('show',!!nearby);if(nearby)this.ui.interact.querySelector('span').textContent=nearby.type==='weapon'?`PICK UP ${WEAPONS[nearby.weapon].name}`:`COLLECT ${nearby.type.toUpperCase()}`;
    this.updateCamera(dt);this.updateUI();
  }
  syncActor(a,dt){
    const parts=a.mesh.userData,move=clamp(a.moving||0,0,1.5),visualAngle=-a.angle,turn=Math.atan2(Math.sin(visualAngle-a.mesh.rotation.y),Math.cos(visualAngle-a.mesh.rotation.y));
    // Smooth shortest-arc turning prevents snapped or reversed avatars.
    a.mesh.rotation.y+=turn*clamp(dt*(a===this.player?18:10),0,1);
    a.animPhase=(a.animPhase||0)+dt*(7+move*4)*Math.max(move,.08);a.recoil=Math.max(0,(a.recoil||0)-dt*7);
    const stride=Math.sin(a.animPhase)*.82*Math.min(move,1),bob=Math.abs(Math.sin(a.animPhase))*.09*Math.min(move,1),aimPitch=a===this.player?this.pitch:clamp(a.aimPitch||0,-.3,.3);
    if(parts.advanced){
      const desired=move<.10?'Idle':move<.82?'Walk':'Run',next=parts.actions[desired]||parts.actions.Idle;
      if(next&&parts.currentAction!==next){next.reset().fadeIn(.16).play();if(parts.currentAction)parts.currentAction.fadeOut(.16);parts.currentAction=next;parts.current=desired;}
      parts.mixer.timeScale=.75+move*.42;parts.mixer.update(a===this.player||!this.coarse||dist(a,this.player)<190?dt:0);
      parts.weapon.rotation.x=-.08-aimPitch*.65;parts.weapon.position.z=-.55+(a.recoil||0)*.25;
      parts.materials.forEach(m=>{m.emissive.set(a.hitFlash>0?'#ff6038':'#000000');m.emissiveIntensity=a.hitFlash>0?.12:0;});
    }else{
      parts.leftLeg.rotation.x=stride;parts.rightLeg.rotation.x=-stride;
      if((a.jumpY||0)>0){parts.leftLeg.rotation.x=lerp(parts.leftLeg.rotation.x,-.48,.5);parts.rightLeg.rotation.x=lerp(parts.rightLeg.rotation.x,.32,.5);}
      parts.leftArm.rotation.x=-.92-aimPitch*.48+stride*.08;parts.rightArm.rotation.x=-.92-aimPitch*.48-stride*.08;
      parts.weapon.rotation.x=-.08-aimPitch*.65;parts.weapon.position.z=-.68+(a.recoil||0)*.32;
      parts.chest.rotation.y=Math.sin(a.animPhase)*.035*move;parts.helmet.rotation.y=Math.sin(this.time*1.7+(a.x||0))*.035*(1-Math.min(move,1));
      parts.armor.emissive.set(a.hitFlash>0?'#ffffff':'#000000');parts.armor.emissiveIntensity=a.hitFlash>0?.65:0;
    }
    a.mesh.position.set(a.x,(a.jumpY||0)+(parts.advanced?0:bob),a.z);a.mesh.rotation.z=lerp(a.mesh.rotation.z,a.hitFlash>0?.10:-(a.localStrafe||0)*.055,clamp(dt*12,0,1));a.mesh.rotation.x=lerp(a.mesh.rotation.x,a.dashTime>0?-.18:0,clamp(dt*10,0,1));
    if(a===this.player)a.mesh.visible=!a.ghost||Math.floor(this.time*10)%2===0;
    a.stepTimer=(a.stepTimer||0)-dt;if(move>.35&&(a.jumpY||0)===0&&a.stepTimer<=0){a.stepTimer=.30/Math.max(move,.5);if(a===this.player||dist(a,this.player)<35)this.impact(new THREE.Vector3(a.x,.12,a.z),'#9b9276',1,.45);}
  }
  updateCamera(dt){
    const p=this.player,target=new THREE.Vector3(p.x,3.1+p.jumpY,p.z),dir=new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch));
    const coarse=matchMedia('(pointer:coarse)').matches,distance=this.phase==='parachute'?(coarse?24:17):this.phase==='freefall'?(coarse?18:13):this.mouse.ads?4.8:9.5,desired=target.clone().addScaledVector(dir,-distance).add(new THREE.Vector3(this.mouse.ads?1.1:1.5,2.0,0));
    this.raycaster.set(target,desired.clone().sub(target).normalize());this.raycaster.far=target.distanceTo(desired);const hits=this.raycaster.intersectObjects(this.cameraBlockers,false);if(hits.length)desired.copy(hits[0].point).addScaledVector(dir,.4);
    const smooth=dt===1?1:1-Math.pow(.00008,dt);this.camera.position.lerp(desired,smooth);if(this.cameraShake>0){this.camera.position.x+=rand(-this.cameraShake,this.cameraShake);this.camera.position.y+=rand(-this.cameraShake,this.cameraShake);this.cameraShake*=Math.pow(.02,dt);}
    this.camera.lookAt(target.clone().addScaledVector(dir,80));this.camera.fov=lerp(this.camera.fov,this.mouse.ads?44:62,1-Math.pow(.002,dt));this.camera.updateProjectionMatrix();
    this.sun.position.set(p.x-160,240,p.z+90);this.sun.target.position.set(p.x,0,p.z);this.sun.target.updateMatrixWorld();
  }

  shoot(owner,weapon,playerOwned=false){
    if(this.phase!=='combat'||owner.fireCd>0||owner.reload>0||owner.dead)return;if(weapon.ammo<=0){if(playerOwned)this.reload();return;}weapon.ammo--;owner.fireCd=weapon.rate*(playerOwned&&this.config.operator.id==='volt'&&owner.effect>0?.72:1);
    const spread=weapon.spread*(playerOwned?(this.mouse.ads?.35:1):2.1-owner.skill),a=owner.angle+rand(-spread,spread);let dir;
    if(playerOwned){dir=new THREE.Vector3();this.camera.getWorldDirection(dir);dir.x+=rand(-spread,spread);dir.z+=rand(-spread,spread);dir.normalize();}
    else dir=new THREE.Vector3(Math.sin(a),rand(-.015,.015),-Math.cos(a)).normalize();
    const pos=new THREE.Vector3(owner.x,2.7+(owner.jumpY||0),owner.z).addScaledVector(dir,2.3);
    const mat=new THREE.MeshBasicMaterial({color:weapon.color});const mesh=new THREE.Mesh(this.bulletGeo,mat);mesh.position.copy(pos);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),dir);this.scene.add(mesh);
    this.bullets.push({pos,vel:dir.multiplyScalar(weapon.speed),life:weapon.range/weapon.speed,damage:weapon.damage*(playerOwned&&owner.ghost?1.5:1),owner,playerOwned,mesh});
    owner.recoil=weapon.id==='longbow'?1:.62;
    if(playerOwned){owner.ghost=false;this.sound.shot(weapon.id);this.cameraShake=weapon.id==='longbow'?.14:.055;}
    this.impact(pos,weapon.color,3,.6);
  }
  reload(){const p=this.player,w=p.weapons[p.slot];if(p.reload>0||w.ammo>=w.mag||w.reserve<=0)return;p.reload=w.reload;this.sound.reload();}
  finishReload(e,w){const n=Math.min(w.mag-w.ammo,w.reserve);w.ammo+=n;w.reserve-=n;e.reload=0;}
  switchWeapon(slot){if(this.player.weapons[slot]&&slot!==this.player.slot){this.player.slot=slot;this.player.reload=0;this.updateUI();this.sound.tone(300,.05,'square',.02,80);}}
  jump(){const p=this.player;if(this.phase==='flight'){this.startJump();return;}if(this.phase==='freefall'){this.openParachute();return;}if(this.phase==='combat'&&!this.paused&&!p.dead&&p.jumpY<=.01){p.vy=8.5;this.sound.tone(140,.08,'sine',.015,50);}}
  dash(){const p=this.player;if(this.phase==='combat'&&p.dashCd<=0&&!p.dead&&!this.paused){p.dashCd=4;p.dashTime=.18;this.sound.tone(180,.16,'sawtooth',.025,180);}}
  ability(){const p=this.player;if(this.phase!=='combat'||p.abilityCd>0||p.dead||this.paused)return;p.abilityCd=this.config.operator.id==='aegis'?22:18;p.effect=this.config.operator.id==='phantom'?5:6;if(this.config.operator.id==='phantom')p.ghost=true;if(this.config.operator.id==='aegis'){p.armor=Math.min(100,p.armor+50);p.barrier=true;}this.sound.ability();this.announce(this.config.operator.skill.toUpperCase(),'TACTICAL ABILITY ACTIVE',this.config.operator.name+' // PROTOCOL');this.impact(new THREE.Vector3(p.x,2,p.z),this.config.operator.color,25,8);}
  interact(){const l=this.nearbyLoot;if(!l)return;const p=this.player;if(l.type==='medkit'){if(p.hp>=100)return;p.hp=Math.min(100,p.hp+l.amount);}if(l.type==='armor'){if(p.armor>=100)return;p.armor=Math.min(100,p.armor+l.amount);}if(l.type==='ammo')p.weapons.forEach(w=>w.reserve+=l.amount);if(l.type==='weapon'){const w=cloneWeapon(l.weapon);if(p.weapons[1]){const old=p.weapons[1];p.weapons[1]=w;l.weapon=old.id;p.slot=1;this.sound.pickup();this.updateUI();return;}p.weapons.push(w);p.slot=1;}this.removeLoot(l);this.nearbyLoot=null;this.sound.pickup();this.updateUI();}
  removeLoot(l){this.scene.remove(l.mesh);this.loot.splice(this.loot.indexOf(l),1);}

  updateBots(dt){
    const actors=[this.player,...this.bots];
    for(const b of this.bots){
      if(b.dead){
        b.deathTime=(b.deathTime||0)+dt;b.mesh.rotation.z=lerp(b.mesh.rotation.z,Math.PI*.48,clamp(dt*5,0,1));b.mesh.position.y=Math.max(-.6,b.mesh.position.y-dt*.22);
        if(b.deathTime>3.5)b.mesh.visible=false;continue;
      }
      b.fireCd-=dt;b.think-=dt;b.hitFlash-=dt;b.stuckTimer=(b.stuckTimer||1)-dt;b.forceTurn=Math.max(0,(b.forceTurn||0)-dt);
      if(b.reload>0){b.reload-=dt;if(b.reload<=0)this.finishReload(b,b.weapon);}
      if(b.think<=0){
        b.think=rand(.16,.30);b.target=actors.filter(a=>a!==b&&!a.dead&&!(a===this.player&&a.ghost)&&dist(a,b)<b.weapon.range*.86&&this.lineClear(a,b)).sort((a,c)=>dist(a,b)-dist(c,b))[0]||null;
        if(Math.random()<.13)b.strafe*=-1;
      }
      const zd=Math.hypot(b.x-this.zone.x,b.z-this.zone.z),outside=zd>this.zone.r*.82;
      let dx=0,dz=0,moveAngle=b.wander,speed=b.speed;
      if(outside){
        // Surviving the zone always takes priority over combat.
        b.target=null;moveAngle=Math.atan2(this.zone.x-b.x,-(this.zone.z-b.z));b.wander=moveAngle;speed*=1.45;
      }else if(b.target&&!b.target.dead&&b.forceTurn<=0){
        const d=dist(b,b.target),a=Math.atan2(b.target.x-b.x,-(b.target.z-b.z));b.angle=a;b.aimPitch=0;
        if(d>34){dx+=Math.sin(a);dz-=Math.cos(a);}if(d<15){dx-=Math.sin(a);dz+=Math.cos(a);}
        dx+=Math.cos(a)*b.strafe*.62;dz+=Math.sin(a)*b.strafe*.62;moveAngle=Math.atan2(dx,-dz);
        if(Math.random()<b.skill*.94)this.shoot(b,b.weapon);if(b.weapon.ammo<=0&&b.reload<=0)b.reload=b.weapon.reload;
      }else{
        if(Math.random()<.018)b.wander+=rand(-1.1,1.1);moveAngle=b.wander;b.angle=moveAngle;
      }
      // Local steering probes several routes around buildings instead of freezing at walls.
      if(b.forceTurn>0)moveAngle=b.wander;
      const steered=this.navigationAngle(b,moveAngle);dx=Math.sin(steered);dz=-Math.cos(steered);
      if(!b.target||outside)b.angle=steered;
      // Separation prevents stacked avatars and keeps firefights readable.
      for(const other of this.bots){if(other===b||other.dead)continue;const d=dist(b,other);if(d>0&&d<3.2){dx+=(b.x-other.x)/d*.7;dz+=(b.z-other.z)/d*.7;}}
      const l=Math.hypot(dx,dz)||1,oldX=b.x,oldZ=b.z;this.move(b,dx/l*speed*dt,dz/l*speed*dt);
      const actual=Math.hypot(b.x-oldX,b.z-oldZ)/Math.max(dt,.001);b.moving=lerp(b.moving,clamp(actual/b.speed,0,1.6),clamp(dt*14,0,1));
      b.localStrafe=clamp(dx*Math.cos(b.angle)+dz*Math.sin(b.angle),-1,1);
      if(b.stuckTimer<=0){
        if(b.lastCheck&&Math.hypot(b.x-b.lastCheck.x,b.z-b.lastCheck.z)<.65){b.wander+=pick([-1,1])*Math.PI*.55;b.forceTurn=.85;b.target=null;}
        b.lastCheck={x:b.x,z:b.z};b.stuckTimer=1.1;
      }
      this.syncActor(b,dt);b.mesh.visible=dist(b,this.player)<(this.coarse?240:340);
      if(Math.hypot(b.x-this.zone.x,b.z-this.zone.z)>this.zone.r)this.damage(b,(2.5+this.zone.phase*1.7)*dt,null,false);
    }
  }
  navigationAngle(b,desired){
    const offsets=[0,.42,-.42,.85,-.85,1.30,-1.30,Math.PI];
    let best=desired,bestScore=-Infinity;
    for(const offset of offsets){
      const a=desired+offset,x=Math.sin(a),z=-Math.cos(a),probe=this.collides(b.x+x*5,b.z+z*5,b.r+.25),near=this.collides(b.x+x*2,b.z+z*2,b.r+.1);
      const zonePenalty=Math.hypot(b.x+x*8-this.zone.x,b.z+z*8-this.zone.z)>this.zone.r?5:0;
      const score=(probe?-20:0)+(near?-8:0)-Math.abs(offset)*.7-zonePenalty+rand(0,.05);
      if(score>bestScore){bestScore=score;best=a;}if(!probe&&!near&&offset===0)break;
    }
    return best;
  }
  updateBullets(dt){
    const actors=[this.player,...this.bots];
    for(let i=this.bullets.length-1;i>=0;i--){
      const b=this.bullets[i],previous=b.pos.clone();b.pos.addScaledVector(b.vel,dt);b.life-=dt;b.mesh.position.copy(b.pos);let remove=b.life<=0||Math.abs(b.pos.x)>1300||Math.abs(b.pos.z)>1300;
      // Swept collision prevents high-speed rounds tunneling through avatars or thin cover.
      const travel=previous.distanceTo(b.pos),steps=Math.max(1,Math.ceil(travel/1.25));
      if(!remove)for(let s=1;s<=steps;s++){const t=s/steps,x=lerp(previous.x,b.pos.x,t),y=lerp(previous.y,b.pos.y,t),z=lerp(previous.z,b.pos.z,t);if(this.obstacles.some(o=>x>o.x-o.w/2&&x<o.x+o.w/2&&z>o.z-o.d/2&&z<o.z+o.d/2&&y<o.h)){remove=true;this.impact(new THREE.Vector3(x,y,z),'#b9ad91',4,3);break;}}
      if(!remove)for(const a of actors){
        if(a.dead||a===b.owner)continue;const vx=b.pos.x-previous.x,vz=b.pos.z-previous.z,lengthSq=vx*vx+vz*vz,t=lengthSq?clamp(((a.x-previous.x)*vx+(a.z-previous.z)*vz)/lengthSq,0,1):0;
        const hx=previous.x+vx*t,hy=lerp(previous.y,b.pos.y,t),hz=previous.z+vz*t,dx=a.x-hx,dz=a.z-hz,dy=1.9+(a.jumpY||0)-hy;
        if(dx*dx+dz*dz<1.65&&Math.abs(dy)<2.3){const hitPos=new THREE.Vector3(hx,hy,hz),headshot=hy>3.35+(a.jumpY||0),dealt=b.damage*(headshot?1.65:1);a.lastHeadshot=headshot;this.damage(a,dealt,b.owner,true);if(b.playerOwned)this.spawnDamageText(hitPos,Math.round(dealt),headshot);remove=true;this.impact(hitPos,headshot?'#ffd36a':a===this.player?'#ff6b4c':'#e9c699',headshot?12:7,4);break;}
      }
      if(remove){this.scene.remove(b.mesh);b.mesh.material.dispose();this.bullets.splice(i,1);}
    }
  }
  damage(target,amount,attacker,feedback){if(target.dead)return;if(target===this.player&&target.barrier)amount*=.55;if(target.armor>0){const absorbed=Math.min(target.armor,amount*.7);target.armor-=absorbed;amount-=absorbed;}target.hp-=amount;target.hitFlash=.12;this.refreshNameplate(target);
    if(target===this.player&&feedback){this.ui.damage.style.opacity=.42;if(attacker){const angle=Math.atan2(attacker.x-target.x,-(attacker.z-target.z))-this.yaw;this.ui.direction.style.transform=`translate(-50%,-50%) rotate(${angle}rad)`;this.ui.direction.classList.add('show');setTimeout(()=>this.ui?.direction?.classList.remove('show'),280);}setTimeout(()=>{if(this.ui)this.ui.damage.style.opacity=0;},100);this.cameraShake=.22;}if(attacker===this.player&&feedback){this.sound.hit();this.hitMarker=.12;this.ui.crosshair.classList.add('hit');setTimeout(()=>this.ui?.crosshair.classList.remove('hit'),100);}if(target.hp<=0)this.eliminate(target,attacker);
  }
  eliminate(target,attacker){target.dead=true;target.hp=0;target.deathTime=0;target.moving=0;if(target.nameplate)target.nameplate.visible=false;this.impact(new THREE.Vector3(target.x,2,target.z),target===this.player?'#ff6343':'#b5bdaf',25,8);
    if(target!==this.player)this.addLoot(target.x,target.z);if(attacker===this.player){this.kills++;this.sound.eliminate();this.addFeed(`YOU <b>${target.lastHeadshot?'HEADSHOT':'ELIMINATED'}</b> ${target.name}`,true);}else if(attacker&&target!==this.player)this.addFeed(`${attacker.name} <b>ELIMINATED</b> ${target.name}`,false);else if(target!==this.player)this.addFeed(`${target.name} <b>LOST TO THE STORM</b>`,false);
    if(target===this.player){this.addFeed(`${attacker?.name||'THE STORM'} <b>ELIMINATED</b> YOU`,false);setTimeout(()=>this.finish(false),700);}else if(this.bots.every(b=>b.dead)&&!this.player.dead)setTimeout(()=>this.finish(true),700);
  }
  addFeed(html,player){this.feed.unshift({html,player});this.feed=this.feed.slice(0,5);this.ui.feed.innerHTML=this.feed.map(f=>`<div class="kill-line ${f.player?'player':''}">${f.html}</div>`).join('');}
  updateZone(dt){const z=this.zone,p=this.player;z.timer-=dt;if(z.timer<=0){if(!z.shrinking){z.shrinking=true;z.timer=this.config.mode==='blitz'?12:18;z.fromR=z.r;z.fromX=z.x;z.fromZ=z.z;this.announce('ZONE COLLAPSING','MOVE TO THE SAFE AREA',`PHASE ${z.phase+1} // STORM SURGE`);}else{z.shrinking=false;z.phase++;z.r=z.targetR;z.x=z.targetX;z.z=z.targetZ;z.timer=this.config.mode==='blitz'?10:Math.max(10,23-z.phase*2);if(z.r<45)z.targetR=0;else this.planZone();}}
    if(z.shrinking){const duration=this.config.mode==='blitz'?12:18,t=clamp(1-z.timer/duration,0,1);z.r=lerp(z.fromR,z.targetR,t);z.x=lerp(z.fromX,z.targetX,t);z.z=lerp(z.fromZ,z.targetZ,t);}if(Math.hypot(p.x-z.x,p.z-z.z)>z.r){this.damage(p,(2.5+z.phase*1.7)*dt,null,false);this.ui.outside.classList.add('show');}else this.ui.outside.classList.remove('show');
  }
  planZone(){const z=this.zone;z.targetR=Math.max(35,z.r*.66);const max=Math.max(0,z.r-z.targetR)*.65,a=rand(0,TAU),d=rand(0,max);z.targetX=clamp(z.x+Math.cos(a)*d,-WORLD/2+z.targetR,WORLD/2-z.targetR);z.targetZ=clamp(z.z+Math.sin(a)*d,-WORLD/2+z.targetR,WORLD/2-z.targetR);}
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];if(!p.floating)p.vel.y-=8*dt;p.mesh.position.addScaledVector(p.vel,dt);p.mesh.material.opacity=clamp(p.life/p.max,0,1);p.life-=dt;if(p.life<=0){this.scene.remove(p.mesh);p.mesh.material.map?.dispose();p.mesh.material.dispose();this.particles.splice(i,1);}}}
  impact(pos,color,n,speed){for(let i=0;i<n;i++){const mesh=new THREE.Mesh(this.sharedParticleGeo,new THREE.MeshBasicMaterial({color,transparent:true}));mesh.position.copy(pos);this.scene.add(mesh);this.particles.push({mesh,vel:new THREE.Vector3(rand(-speed,speed),rand(-speed,speed),rand(-speed,speed)),life:rand(.15,.45),max:.45});}}
  spawnDamageText(pos,amount,headshot){const canvas=document.createElement('canvas');canvas.width=256;canvas.height=96;const c=canvas.getContext('2d');c.textAlign='center';c.font=headshot?'800 38px sans-serif':'700 42px sans-serif';c.fillStyle=headshot?'#ffd36a':'#fff0d2';c.shadowColor='#000';c.shadowBlur=8;c.fillText(headshot?`HEADSHOT ${amount}`:amount,128,55);const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));sprite.position.copy(pos);sprite.scale.set(headshot?5:3,1.5,1);this.scene.add(sprite);this.particles.push({mesh:sprite,vel:new THREE.Vector3(0,2.2,0),life:.8,max:.8,floating:true});if(headshot)this.sound.tone(880,.08,'square',.025,220);}

  updateAtmosphere(dt){
    this.ash.position.set(this.player.x,0,this.player.z);if(this.ocean)this.ocean.position.y=-1.6+Math.sin((this.flightTime+this.time)*.45)*.08;const pos=this.ash.geometry.attributes.position;
    for(let i=0;i<pos.count;i++){let y=pos.getY(i)-dt*(1.2+(i%7)*.13);pos.setX(i,pos.getX(i)+dt*.22);if(y<0)y=55;if(pos.getX(i)>85)pos.setX(i,-85);pos.setY(i,y);}pos.needsUpdate=true;
    if(this.time>=this.nextAirdrop){this.nextAirdrop+=52;this.launchAirdrop();}
  }
  launchAirdrop(){
    const a=rand(0,TAU),d=rand(28,55),x=clamp(this.player.x+Math.cos(a)*d,-1100,1100),z=clamp(this.player.z+Math.sin(a)*d,-1100,1100);
    const group=new THREE.Group();group.position.set(x,95,z);this.scene.add(group);
    const crate=new THREE.Mesh(new THREE.BoxGeometry(3.8,3.2,3.8),new THREE.MeshStandardMaterial({color:'#4c5650',metalness:.65,roughness:.38}));crate.castShadow=true;group.add(crate);
    const glow=new THREE.MeshStandardMaterial({color:'#ffb44f',emissive:'#ff7b32',emissiveIntensity:1.4,metalness:.4,roughness:.35});
    for(const side of [-1,1]){const band=new THREE.Mesh(new THREE.BoxGeometry(.28,3.35,3.95),glow);band.position.x=side*1.15;group.add(band);}
    const canopy=new THREE.Mesh(new THREE.SphereGeometry(7,24,12,0,TAU,0,Math.PI/2),new THREE.MeshStandardMaterial({color:'#d76c45',side:THREE.DoubleSide,roughness:.82}));canopy.scale.y=.45;canopy.position.y=12;group.add(canopy);
    const ropeMat=new THREE.LineBasicMaterial({color:'#d9d3bd'});for(const side of [-1,1])for(const front of [-1,1]){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side*1.7,1,front*1.7),new THREE.Vector3(side*5,11,front*5)]);group.add(new THREE.Line(geo,ropeMat));}
    const beacon=new THREE.PointLight('#ff8a3d',25,28,2);beacon.position.y=2;group.add(beacon);
    this.airdrops.push({x,z,mesh:group,canopy,landed:false,phase:rand(0,TAU)});this.announce('SUPPLY DROP INBOUND','HIGH-TIER LOOT MARKED ON YOUR MAP','AIR SUPPORT // PRIORITY PACKAGE');
  }
  updateAirdrops(dt){
    for(const drop of this.airdrops){if(drop.landed)continue;drop.phase+=dt;drop.mesh.position.y-=dt*8;drop.mesh.rotation.y+=dt*.16;drop.mesh.position.x=drop.x+Math.sin(drop.phase)*1.5;
      if(drop.mesh.position.y<=1.7){drop.mesh.position.y=1.7;drop.landed=true;drop.canopy.visible=false;drop.mesh.children.forEach(o=>{if(o.isLine)o.visible=false;});this.impact(new THREE.Vector3(drop.x,.5,drop.z),'#d8bd82',22,6);this.addLoot(drop.x+4,drop.z,'weapon');this.addLoot(drop.x-4,drop.z,'armor');this.addLoot(drop.x,drop.z+4,'medkit');this.addLoot(drop.x,drop.z-4,'ammo');this.announce('SUPPLY DROP LANDED','ELITE EQUIPMENT AVAILABLE','AIR SUPPORT // PACKAGE READY');}}
  }

  updateUI(){const p=this.player,w=p.weapons[p.slot],alive=this.bots.filter(b=>!b.dead).length+(p.dead?0:1);this.ui['alive-count'].textContent=alive;this.ui['kill-count'].textContent=this.kills;this.ui['match-time'].textContent=fmt(this.time);this.ui.health.textContent=Math.ceil(p.hp);this.ui.healthBar.style.width=p.hp+'%';this.ui.armorBar.style.width=p.armor+'%';this.ui['armor-label'].textContent=Math.ceil(p.armor)+' ARMOR';this.ui['dash-label'].textContent=p.dashCd<=0?'DASH READY':`DASH ${p.dashCd.toFixed(1)}S`;this.ui.ammo.textContent=w.ammo;this.ui.reserve.textContent=' / '+w.reserve;this.ui.weapon.textContent=w.name;this.ui.mode.textContent=w.auto?'AUTO':'SEMI';this.ui.reload.textContent=p.reload>0?`RELOADING ${Math.ceil(p.reload*10)/10}s`:'';this.ui['zone-label'].textContent=this.zone.shrinking?'ZONE COLLAPSING':this.zone.r<80?'FINAL ZONE':'NEXT COLLAPSE';this.ui['zone-time'].textContent=fmt(this.zone.timer);this.root.querySelector('.zone-status').classList.toggle('danger',this.zone.shrinking);this.ui.cooldown.style.transform=`scaleY(${clamp(p.abilityCd/(this.config.operator.id==='aegis'?22:18),0,1)})`;this.ui.aimMode.textContent=this.mouse.ads?'ADS // PRECISION':'HIP FIRE';this.ui.crosshair.classList.toggle('ads',this.mouse.ads);this.root.querySelectorAll('.weapon-slot').forEach((el,i)=>{el.classList.toggle('active',i===p.slot);if(i===1){el.style.display=p.weapons[1]?'block':'none';if(p.weapons[1])el.textContent='2 // '+p.weapons[1].name;}});const ratio=clamp(p.abilityCd/(this.config.operator.id==='aegis'?22:18),0,1);if(this.ui.mobileCooldown)this.ui.mobileCooldown.style.transform=`scaleY(${ratio})`;if(this.ui.mobileSwap)this.ui.mobileSwap.style.display=p.weapons[1]?'grid':'none';if(this.ui.mobileAds){this.ui.mobileAds.classList.toggle('active',this.mouse.ads);this.ui.mobileAds.setAttribute('aria-pressed',String(this.mouse.ads));}const dashButton=this.root.querySelector('.mobile-action.dash');if(dashButton)dashButton.textContent=p.dashCd>0?Math.ceil(p.dashCd):'DASH';}
  announce(title,subtitle,eyebrow){const el=this.ui.announce;el.querySelector('h2').textContent=title;el.querySelector('p').textContent=subtitle;el.querySelector('small').textContent=eyebrow;el.classList.add('show');clearTimeout(this.announceTimer);this.announceTimer=setTimeout(()=>el.classList.remove('show'),3000);}

  render(dt){const z=this.zone;this.zoneMesh.position.x=this.zoneRing.position.x=z.x;this.zoneMesh.position.z=this.zoneRing.position.z=z.z;this.zoneMesh.scale.set(z.r,1,z.r);this.zoneRing.scale.setScalar(z.r);this.nextRing.position.x=z.targetX;this.nextRing.position.z=z.targetZ;this.nextRing.scale.setScalar(z.targetR);this.zoneMesh.material.opacity=.10+Math.sin(this.time*2)*.025;this.sky.position.copy(this.camera.position);this.renderer.render(this.scene,this.camera);this.drawMinimap();}
  drawMinimap(){const c=this.mctx,w=this.map.width,h=this.map.height,s=w/WORLD,conv=v=>(v+WORLD/2)*s;c.clearRect(0,0,w,h);c.fillStyle='#1d2922';c.fillRect(0,0,w,h);c.strokeStyle='#4b574477';c.lineWidth=5;c.beginPath();c.moveTo(0,conv(0));c.lineTo(w,conv(0));c.moveTo(conv(0),0);c.lineTo(conv(0),h);c.stroke();c.fillStyle='#778074';for(const o of this.obstacles)if(o.h>6)c.fillRect(conv(o.x-o.w/2),conv(o.z-o.d/2),Math.max(1,o.w*s),Math.max(1,o.d*s));c.strokeStyle='#e47671';c.lineWidth=1.5;c.beginPath();c.arc(conv(this.zone.x),conv(this.zone.z),this.zone.r*s,0,TAU);c.stroke();c.strokeStyle='#e8eee0';c.setLineDash([3,3]);c.beginPath();c.arc(conv(this.zone.targetX),conv(this.zone.targetZ),this.zone.targetR*s,0,TAU);c.stroke();c.setLineDash([]);for(const b of this.bots){if(!b.dead&&dist(b,this.player)<85){c.fillStyle='#e26b53';c.beginPath();c.arc(conv(b.x),conv(b.z),2,0,TAU);c.fill();}}for(const l of this.loot){if(dist(l,this.player)<45){c.fillStyle='#d9ca72';c.fillRect(conv(l.x)-1,conv(l.z)-1,2,2);}}for(const d of this.airdrops){c.fillStyle='#ffb44f';c.fillRect(conv(d.x)-3,conv(d.z)-3,6,6);c.strokeStyle='#ffb44f88';c.beginPath();c.arc(conv(d.x),conv(d.z),6+Math.sin(this.time*3)*2,0,TAU);c.stroke();}c.save();c.translate(conv(this.player.x),conv(this.player.z));c.rotate(this.player.angle);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-6);c.lineTo(-4,4);c.lineTo(4,4);c.closePath();c.fill();c.restore();}

  togglePause(){if(this.ended)return;this.paused=!this.paused;this.mouse.down=false;this.mobileFire=false;this.mobileFirePointer=null;this.touchMove={x:0,y:0};if(this.paused){document.exitPointerLock?.();const el=document.createElement('div');el.className='game-pause';el.innerHTML=`<div class="pause-panel"><span class="eyebrow-text">3D MATCH SUSPENDED</span><h2>TACTICAL PAUSE</h2><p>The simulation is paused.<br/>Click the battleground after resuming to capture your aim.</p><button class="deploy-button resume"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>BACK TO THE ISLAND</small><b>RESUME MATCH</b></span>${this.cb.icon('arrow')}</button><button class="outline-button quit">ABANDON MATCH</button></div>`;this.root.querySelector('.game-ui').append(el);this.pauseEl=el;el.querySelector('.resume').onclick=()=>this.togglePause();el.querySelector('.quit').onclick=()=>this.cb.onExit();}else{this.pauseEl?.remove();this.pauseEl=null;this.last=performance.now();}}
  finish(win){if(this.ended)return;this.ended=true;this.mouse.down=false;document.exitPointerLock?.();const placement=win?1:this.bots.filter(b=>!b.dead).length+1,xp=this.kills*(this.config.mode==='blitz'?200:100)+(win?1000:Math.max(50,350-placement*10)),result={win,kills:this.kills,placement,xp};this.cb.onFinish(result);const el=document.createElement('div');el.className='game-result';el.innerHTML=`<div class="result-panel"><span class="eyebrow-text">${win?'LAST ONE STANDING':'3D COMBAT RECORD // MATCH COMPLETE'}</span><h2>${win?'BOOYAH!':'ELIMINATED'}</h2><p>${win?'The island is yours. Outstanding work, operator.':'Every defeat sharpens the next deployment.'}</p><div class="result-placement">#${placement} <small>/ ${this.config.mode==='blitz'?12:24}</small></div><div class="result-stats"><div><small>ELIMINATIONS</small><b>${this.kills}</b></div><div><small>SURVIVED</small><b>${fmt(this.time)}</b></div><div><small>XP MULTIPLIER</small><b>1.0×</b></div></div><div class="result-xp">+ ${xp.toLocaleString()} CAREER XP</div><button class="deploy-button redeploy"><span class="deploy-icon">${this.cb.icon('play')}</span><span><small>ONE MORE RUN</small><b>REDEPLOY</b></span>${this.cb.icon('arrow')}</button><button class="outline-button lobby">RETURN TO LOBBY</button></div>`;this.root.querySelector('.game-ui').append(el);el.querySelector('.redeploy').onclick=()=>this.cb.onRestart();el.querySelector('.lobby').onclick=()=>this.cb.onExit();}
  destroy(){this.running=false;cancelAnimationFrame(this.frame);clearTimeout(this.announceTimer);this.abort.abort();document.exitPointerLock?.();this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose?.();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.map?.dispose?.();m.dispose?.();});}});this.renderer.dispose();this.renderer.domElement.remove();this.ui=null;}
}
