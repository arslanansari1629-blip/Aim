import '@fontsource/barlow-condensed/latin-500.css';
import '@fontsource/barlow-condensed/latin-600.css';
import '@fontsource/barlow-condensed/latin-700.css';
import '@fontsource/barlow-condensed/latin-800.css';
import '@fontsource/barlow-condensed/latin-900.css';
import '@fontsource/barlow-condensed/latin-700-italic.css';
import '@fontsource/barlow-condensed/latin-800-italic.css';
import '@fontsource/barlow-condensed/latin-900-italic.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-600.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import './style.css';
import { Battleground } from './game.js';
import { LobbyScene } from './lobby3d.js';

const icons = {
  play: '<path d="m8 5 11 7-11 7z"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  volume: '<path d="M11 5 6 9H3v6h3l5 4zm4 4a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4zm5 4 5 6m0-6-5 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.55V21h-4v-.08a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.08a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.08a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.08a1.7 1.7 0 0 0-1.55 1Z"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
  trophy: '<path d="M8 21h8m-4-4v4M7 4h10v5a5 5 0 0 1-10 0zm0 2H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zm6-3v15m6-12v15"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  bolt: '<path d="m13 2-9 12h8l-1 8 9-12h-8z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="M6 6l12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.01"/>',
  medal: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
  skull: '<path d="M8 17v4m8-4v4M9 21v-2m6 2v-2"/><path d="M5 15a8 8 0 1 1 14 0l-2 3H7z"/><circle cx="9" cy="11" r="1"/><circle cx="15" cy="11" r="1"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.crosshair}</svg>`;
const logo = `<a class="brand" href="#" aria-label="Ashfall home"><svg viewBox="0 0 42 42"><path d="M4 34 17 6h9l12 28H27l-2-6h-9l-3 6zm15-14h4l-2-7z"/><path class="brand-cut" d="M30 6h7L25 34h-7z"/></svg><span>ASHFALL<small>TACTICAL BATTLEGROUNDS</small></span></a>`;

const operators = [
  { id: 'phantom', name: 'PHANTOM', role: 'Infiltrator', skill: 'Ghost Protocol', desc: 'Become nearly invisible for 5 seconds. Your next shot deals bonus damage.', color: '#72d9d0', stat: 'STEALTH', letter: 'P' },
  { id: 'volt', name: 'VOLT', role: 'Assault', skill: 'Overdrive', desc: 'Surge forward with +55% movement speed and faster fire rate for 6 seconds.', color: '#ff7950', stat: 'MOBILITY', letter: 'V' },
  { id: 'aegis', name: 'AEGIS', role: 'Vanguard', skill: 'Kinetic Barrier', desc: 'Instantly restore 50 armor and reduce incoming damage for 6 seconds.', color: '#e9bf65', stat: 'DEFENSE', letter: 'A' },
];
const weapons = [
  { id: 'raven', name: 'RAVEN AR', type: 'ASSAULT RIFLE', damage: 24, fireRate: 9, mag: 30, range: 720, color: '#ff643f', bars: [76, 72, 68], desc: 'Balanced full-auto rifle. Reliable at every range.' },
  { id: 'viper', name: 'VIPER SMG', type: 'SUBMACHINE GUN', damage: 17, fireRate: 13, mag: 36, range: 500, color: '#70d6cc', bars: [56, 91, 46], desc: 'Hyper-mobile close quarters shredder.' },
  { id: 'longbow', name: 'LONGBOW DMR', type: 'MARKSMAN RIFLE', damage: 52, fireRate: 3.5, mag: 12, range: 1100, color: '#e7bc65', bars: [94, 32, 96], desc: 'Precision semi-auto. Make every round count.' },
];
const defaults = { xp: 0, wins: 0, matches: 0, kills: 0, best: 0, operator: 'phantom', weapon: 'raven', mode: 'royale', muted: false };
let profile;
try { profile = { ...defaults, ...JSON.parse(localStorage.getItem('ashfall-profile') || '{}') }; } catch { profile = { ...defaults }; }
let game = null;
let lobbyScene = null;
let currentView = 'home';
const app = document.querySelector('#app');
const save = () => { try { localStorage.setItem('ashfall-profile', JSON.stringify(profile)); } catch {} };
const level = () => Math.floor(profile.xp / 1000) + 1;
const op = () => operators.find(o => o.id === profile.operator) || operators[0];
const gun = () => weapons.find(w => w.id === profile.weapon) || weapons[0];

function shell(content) {
  return `<main class="lobby">
    <header class="topbar">${logo}
      <nav class="main-nav" aria-label="Main navigation">
        <button class="nav-link ${currentView === 'home' ? 'active' : ''}" data-view="home">HOME</button>
        <button class="nav-link ${currentView === 'operators' ? 'active' : ''}" data-view="operators">OPERATORS</button>
        <button class="nav-link ${currentView === 'armory' ? 'active' : ''}" data-view="armory">ARMORY</button>
        <button class="nav-link ${currentView === 'guide' ? 'active' : ''}" data-view="guide">FIELD GUIDE</button>
      </nav>
      <div class="top-actions">
        <button class="icon-button sound-toggle" aria-label="${profile.muted ? 'Enable sound' : 'Mute sound'}" title="Sound">${icon(profile.muted ? 'muted' : 'volume')}</button>
        <button class="icon-button settings-button" aria-label="Game settings">${icon('gear')}</button>
        <button class="profile-chip" data-view="profile"><span class="level-badge">${level()}</span><span><b>ROOKIE_${String(741 + profile.matches).padStart(4, '0')}</b><small>LEVEL ${level()} · ${profile.xp % 1000}/1000 XP</small></span>${icon('chevron')}</button>
      </div>
    </header>${content}
    <div class="system-line"><span><i class="status-dot"></i> ALL SYSTEMS OPERATIONAL</span><span>BUILD 1.1.1 // ASHFALL SECURE NETWORK</span><span>NO DOWNLOAD · NO PAY TO WIN</span></div>
  </main>`;
}

function homeView() {
  const o = op(), w = gun();
  return shell(`<section class="hero">
    <div class="lobby-scene" aria-label="3D operator lobby"></div><div class="scene-caption"><span>LIVE OPERATOR VIEW</span><b>BLACKOUT // HANGAR 07</b></div>
    <div class="hero-vignette"></div><div class="hero-grid"></div>
    <div class="hero-copy">
      <div class="eyebrow"><span class="season-tag">SEASON 01</span><span>THE COLLAPSE HAS BEGUN</span></div>
      <h1><span>OUTGUN.</span><span>OUTLAST.</span><em>OUTLIVE.</em></h1>
      <p>One island. Twenty-four fighters. No second chances.<br/>Loot fast, master your operator, and stay ahead of the storm.</p>
      <div class="hero-cta-row">
        <button class="deploy-button" id="deploy-btn"><span class="deploy-icon">${icon('play')}</span><span><small>SOLO // ${profile.mode === 'blitz' ? 'BLITZ' : 'BATTLE ROYALE'}</small><b>DEPLOY NOW</b></span>${icon('arrow')}</button>
        <button class="mode-button" id="mode-btn"><span>${icon('map')}</span><span><small>GAME MODE</small><b>${profile.mode === 'blitz' ? 'BLITZ PROTOCOL' : 'BATTLE ROYALE'}</b></span>${icon('chevron')}</button>
      </div>
      <div class="hero-proof"><span>${icon('crosshair')} REAL-TIME 3D COMBAT</span><span>${icon('clock')} ~6 MIN MATCH</span><span>${icon('bolt')} INSTANT PLAY</span></div>
    </div>
    <aside class="operative-card"><span class="card-index">ACTIVE OPERATOR // 0${operators.indexOf(o) + 1}</span><div class="operative-title"><span style="--op-color:${o.color}">${o.letter}</span><div><small>${o.role.toUpperCase()}</small><h3>${o.name}</h3></div></div><div class="operative-skill">${icon('bolt')}<span><small>TACTICAL ABILITY</small><b>${o.skill}</b></span><kbd>Q</kbd></div></aside>
    <div class="loadout-dock">
      <div class="dock-label"><small>YOUR LOADOUT</small><b>READY FOR DEPLOYMENT</b></div>
      <button class="loadout-item" data-view="operators"><span class="loadout-avatar" style="--op-color:${o.color}">${o.letter}</span><span><small>OPERATOR</small><b>${o.name}</b></span><span class="edit-label">CHANGE ${icon('chevron')}</span></button>
      <button class="loadout-item" data-view="armory"><span class="weapon-silhouette">${weaponArt(w.id)}</span><span><small>PRIMARY WEAPON</small><b>${w.name}</b></span><span class="edit-label">CHANGE ${icon('chevron')}</span></button>
      <div class="career-mini"><span><small>VICTORIES</small><b>${String(profile.wins).padStart(2, '0')}</b></span><span><small>ELIMINATIONS</small><b>${String(profile.kills).padStart(2, '0')}</b></span><span><small>BEST FINISH</small><b>${profile.best ? '#' + profile.best : '—'}</b></span></div>
    </div>
  </section>`);
}

function weaponArt(id) {
  const paths = {
    raven: 'M4 17h8l3-5h16l5 4h12v4h-9l-3 5h-6l2-5h-8l-3 7h-6l3-10H4zM28 12V8h10v4',
    viper: 'M4 15h9l4-4h20l4 5h8v4h-9l-2 5h-7l1-5h-9l-4 8h-7l4-11H4zM27 11V7h8v4',
    longbow: 'M2 16h11l4-5h25l7 5h10v3H39l-4 6h-6l2-6H21l-3 5h-6l2-8H2zM31 11V6h9v5m-5-5V3',
  };
  return `<svg viewBox="0 0 60 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="${paths[id]}"/></svg>`;
}

function operatorsView() {
  return shell(`<section class="page-view"><div class="section-heading"><div><span class="eyebrow-text">CHOOSE YOUR ADVANTAGE</span><h1>OPERATORS</h1></div><p>Every legend has an edge. Pick the ability<br/>that matches your instinct.</p></div><div class="operator-grid">${operators.map((o, i) => `<button class="operator-select ${profile.operator === o.id ? 'selected' : ''}" data-operator="${o.id}" style="--op-color:${o.color}"><div class="op-card-top"><span>0${i + 1} // ${o.role.toUpperCase()}</span>${profile.operator === o.id ? '<b>ACTIVE</b>' : ''}</div><div class="op-portrait"><span>${o.letter}</span><div class="op-rings"></div><svg viewBox="0 0 240 300"><path d="M76 79c0-52 88-52 88 0l-9 53H85zM85 80h74l-6 24H90zM73 142l-40 32-20 107h214l-20-107-42-32-20 22h-50z"/><path class="op-detail" d="m75 143 45 58 45-58m-87 23 11 115m74-115-11 115M95 132v31h50v-31"/></svg></div><div class="op-card-copy"><small>${o.stat} SPECIALIST</small><h2>${o.name}</h2><div class="op-ability">${icon('bolt')}<b>${o.skill}</b><kbd>Q</kbd></div><p>${o.desc}</p><span class="select-line">${profile.operator === o.id ? icon('check') + ' EQUIPPED' : 'SELECT OPERATOR' + icon('arrow')}</span></div></button>`).join('')}</div></section>`);
}

function armoryView() {
  const w = gun();
  return shell(`<section class="page-view"><div class="section-heading"><div><span class="eyebrow-text">PRECISION IS A CHOICE</span><h1>ARMORY</h1></div><p>Select your starting primary. More weapons<br/>and upgrades await on the island.</p></div><div class="armory-layout"><div class="weapon-list">${weapons.map((x, i) => `<button class="weapon-select ${profile.weapon === x.id ? 'selected' : ''}" data-weapon="${x.id}"><span class="weapon-number">0${i + 1}</span><span class="weapon-list-art" style="color:${x.color}">${weaponArt(x.id)}</span><span><small>${x.type}</small><b>${x.name}</b></span>${profile.weapon === x.id ? icon('check') : icon('chevron')}</button>`).join('')}</div><div class="weapon-detail" style="--weapon-color:${w.color}"><div class="weapon-blueprint">${weaponArt(w.id)}<span>TACTICAL SERIES // ${w.id.toUpperCase()}</span></div><div class="weapon-detail-copy"><small>${w.type}</small><h2>${w.name}</h2><p>${w.desc}</p><div class="weapon-stats">${['DAMAGE', 'FIRE RATE', 'RANGE'].map((s, i) => `<div><span><small>${s}</small><b>${w.bars[i]}</b></span><div class="stat-track"><i style="width:${w.bars[i]}%"></i></div></div>`).join('')}</div><div class="weapon-specs"><span><small>MAGAZINE</small><b>${w.mag}</b></span><span><small>FIRE MODE</small><b>${w.id === 'longbow' ? 'SEMI' : 'AUTO'}</b></span><span><small>CLASS</small><b>PRIMARY</b></span></div></div></div></div></section>`);
}

function guideView() {
  const controls = [['W A S D', 'Move in 3D'], ['MOUSE', 'Third-person aim'], ['LMB', 'Fire weapon'], ['RMB', 'Aim down sights'], ['SPACE', 'Jump / open parachute'], ['R', 'Reload'], ['SHIFT', 'Combat dash'], ['Q', 'Operator ability'], ['E', 'Collect nearby loot'], ['1 / 2', 'Switch weapons'], ['ESC', 'Pause match']];
  return shell(`<section class="page-view guide-view"><div class="section-heading"><div><span class="eyebrow-text">SURVIVE THE COLLAPSE</span><h1>FIELD GUIDE</h1></div><p>The island rewards awareness, precision,<br/>and the courage to keep moving.</p></div><div class="guide-grid"><div class="guide-controls"><div class="panel-title">${icon('crosshair')} COMBAT CONTROLS <span>DESKTOP</span></div>${controls.map(([k, v]) => `<div class="control-row"><span>${v}</span><kbd>${k}</kbd></div>`).join('')}<div class="mobile-note">${icon('info')} Touch controls appear automatically on mobile.</div></div><div class="survival-steps">${[['01', 'DROP & LOOT', 'Jump from the transport plane, steer your parachute, and land anywhere on Blackout Island. Collect armor, medkits, ammunition, and weapons from glowing caches.'], ['02', 'STAY INSIDE', 'The ash storm deals increasing damage outside the safe zone. Watch the minimap and rotate before the collapse.'], ['03', 'BE THE LAST', 'Outplay 23 adaptive combatants. Use structures as cover, dash out of danger, and unleash your operator ability.']].map(([n,t,p]) => `<article><span>${n}</span><div><h3>${t}</h3><p>${p}</p></div></article>`).join('')}<button class="deploy-button guide-deploy" id="deploy-btn"><span class="deploy-icon">${icon('play')}</span><span><small>READY, OPERATOR?</small><b>ENTER BATTLEGROUND</b></span>${icon('arrow')}</button></div></div></section>`);
}

function profileView() {
  const kd = profile.matches ? (profile.kills / profile.matches).toFixed(1) : '0.0';
  return shell(`<section class="page-view profile-view"><div class="profile-hero"><div class="big-level">${level()}</div><div><span class="eyebrow-text">OFFICIAL COMBAT RECORD</span><h1>ROOKIE_${String(741 + profile.matches).padStart(4, '0')}</h1><p>ASHFALL TASK FORCE · SEASON 01</p></div><button class="outline-button" data-view="home">BACK TO LOBBY ${icon('arrow')}</button></div><div class="record-grid">${[['TOTAL MATCHES', profile.matches, 'crosshair'], ['VICTORIES', profile.wins, 'trophy'], ['ELIMINATIONS', profile.kills, 'skull'], ['AVG. ELIMS / MATCH', kd, 'medal']].map(([l,v,i]) => `<div class="record-card">${icon(i)}<small>${l}</small><b>${v}</b></div>`).join('')}</div><div class="xp-panel"><div><span><small>CAREER PROGRESSION</small><b>LEVEL ${level()}</b></span><span>${profile.xp % 1000} / 1000 XP</span></div><div class="xp-track"><i style="width:${profile.xp % 1000 / 10}%"></i></div><p>Earn XP from eliminations, placement, and victories. Progress is saved on this device.</p></div></section>`);
}

function render() {
  if (game) { game.destroy(); game = null; }
  if (lobbyScene) { lobbyScene.destroy(); lobbyScene = null; }
  app.innerHTML = ({ home: homeView, operators: operatorsView, armory: armoryView, guide: guideView, profile: profileView }[currentView] || homeView)();
  bind();
  if (currentView === 'home') {
    const mount = document.querySelector('.lobby-scene');
    if (mount) lobbyScene = new LobbyScene(mount, op().color);
  }
}
function bind() {
  document.querySelectorAll('[data-view]').forEach(el => el.addEventListener('click', () => { currentView = el.dataset.view; render(); window.scrollTo(0,0); }));
  document.querySelectorAll('[data-operator]').forEach(el => el.addEventListener('click', () => { profile.operator = el.dataset.operator; save(); render(); toast(`${op().name} EQUIPPED`); }));
  document.querySelectorAll('[data-weapon]').forEach(el => el.addEventListener('click', () => { profile.weapon = el.dataset.weapon; save(); render(); toast(`${gun().name} EQUIPPED`); }));
  document.querySelectorAll('#deploy-btn').forEach(el => el.addEventListener('click', startMatch));
  const mode = document.querySelector('#mode-btn');
  if (mode) mode.addEventListener('click', showMode);
  document.querySelectorAll('.sound-toggle').forEach(el => el.addEventListener('click', () => { profile.muted = !profile.muted; save(); render(); }));
  const settings = document.querySelector('.settings-button');
  if (settings) settings.addEventListener('click', showSettings);
  document.querySelector('.brand')?.addEventListener('click', e => { e.preventDefault(); currentView = 'home'; render(); });
}
function toast(text) {
  const el = document.createElement('div'); el.className = 'toast'; el.innerHTML = `${icon('check')} ${text}`; document.body.append(el); setTimeout(() => el.remove(), 2200);
}
function modal(title, body) {
  const el = document.createElement('div'); el.className = 'modal-backdrop'; el.innerHTML = `<div class="modal"><button class="modal-close icon-button" aria-label="Close">${icon('close')}</button><span class="eyebrow-text">ASHFALL // CONFIGURATION</span><h2>${title}</h2>${body}</div>`; document.body.append(el);
  el.querySelector('.modal-close').onclick = () => el.remove(); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el;
}
function showMode() {
  const el = modal('SELECT PROTOCOL', `<div class="mode-options"><button data-mode="royale" class="${profile.mode === 'royale' ? 'selected' : ''}">${icon('map')}<span><b>BATTLE ROYALE</b><small>24 fighters · Standard collapse · Full survival experience</small></span>${icon('check')}</button><button data-mode="blitz" class="${profile.mode === 'blitz' ? 'selected' : ''}">${icon('bolt')}<span><b>BLITZ PROTOCOL</b><small>12 fighters · Faster storm · Double elimination XP</small></span>${icon('check')}</button></div>`);
  el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { profile.mode = b.dataset.mode; save(); el.remove(); render(); });
}
function showSettings() {
  const el = modal('SYSTEM SETTINGS', `<div class="settings-list"><div><span><b>GAME AUDIO</b><small>Procedural weapons, impacts, and interface sound</small></span><button class="toggle ${!profile.muted ? 'on' : ''}" id="audio-toggle"><i></i></button></div><div><span><b>RENDER QUALITY</b><small>Adaptive resolution for smooth combat</small></span><b class="setting-value">AUTO</b></div><div><span><b>PROGRESS STORAGE</b><small>Your career is saved locally in this browser</small></span><b class="setting-value">LOCAL</b></div></div><button class="outline-button reset-profile">RESET CAREER PROGRESS</button>`);
  el.querySelector('#audio-toggle').onclick = () => { profile.muted = !profile.muted; save(); el.remove(); render(); };
  el.querySelector('.reset-profile').onclick = () => { if (confirm('Reset all ASHFALL career progress?')) { const { operator, weapon, mode, muted } = profile; profile = { ...defaults, operator, weapon, mode, muted }; save(); el.remove(); render(); toast('CAREER RESET'); } };
}
function startMatch() {
  currentView = 'home';
  if (lobbyScene) { lobbyScene.destroy(); lobbyScene = null; }
  if (game) { game.destroy(); game = null; }
  app.innerHTML = `<main id="game-root"></main>`;
  game = new Battleground(document.querySelector('#game-root'), { operator: op(), weapon: gun(), mode: profile.mode, muted: profile.muted }, {
    icon,
    onExit: () => render(),
    onFinish: (result) => {
      profile.matches++; profile.kills += result.kills; profile.wins += result.win ? 1 : 0; profile.best = profile.best ? Math.min(profile.best, result.placement) : result.placement; profile.xp += result.xp; save();
    },
    onRestart: () => startMatch(),
  });
  if (import.meta.env.DEV) window.__ashfall = game;
}
render();
