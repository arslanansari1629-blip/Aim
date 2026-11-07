# ASHFALL — Tactical Battlegrounds

An original, browser-playable real-time 3D third-person battle royale built with Three.js, WebGL, JavaScript, and Vite.

## Play

```bash
npm install
npm run dev
```

For local multiplayer testing, run signaling in a second terminal, then open two independent browser profiles:

```bash
npm run dev:peer
```

Production uses the public PeerJS signaling cloud. Gameplay and social messages travel over encrypted peer-to-peer WebRTC data channels.

## Controls

- **WASD** — move
- **Mouse / left click** — third-person aim / fire
- **Right click** — aim down sights
- **Space** — jump from the transport plane, open the parachute, or jump during combat
- **R** — reload
- **Shift** — combat dash
- **Q** — operator ability
- **E** — collect loot
- **1 / 2** — switch weapon
- **Escape** — pause

Touch controls and assisted aiming appear automatically on phones and tablets. Mobile controls include movement, fire, ADS, jump, dash, reload, loot, operator ability, and weapon switching, with independent multi-touch tracking.

## Features

- Player-chosen persistent callsigns, exact-name player search, live friend requests, accept/decline, and locally persistent friends
- Real WebRTC duo co-op: invitations, a shared deterministic island, remote operators/nameplates, 10 Hz movement, host-authoritative bots and storm, remote tracers, and player/bot damage
- Two detailed human glTF avatars with compatible skeletal combat animation; the selected operator determines the local, lobby, and remote appearance
- Six usable weapon classes: Raven AR, Viper SMG, Longbow DMR, Titan LMG, Spectre SG, and Falcon SR
- Interactive true-3D armory with mouse/touch rotation and weapon-specific geometry
- Real-time 3D operator hangar lobby with cinematic lighting and camera parallax
- Detailed transport-plane arrival, manual jumping, steerable freefall, automatic/manual parachute deployment, and landing
- Expanded 2.4 km island with seven districts, coastlines, water, roads, terrain patches, 520 trees, rocks, and grass
- Real-time WebGL third-person camera, ADS, jumping, dynamic shadows, fog, procedural textures, and drifting ash
- Professionally textured glTF soldiers with skeletal idle, walk, and run animations (procedural fallback included)
- Detailed rifles, concrete structures, rooftop equipment, reinforced crates, layered vegetation, and animated supply drops
- Precision headshots, floating damage numbers, and live enemy health/armor bars
- 24-combatant Battle Royale and 12-combatant Blitz modes
- Three operators with distinct tactical abilities
- Articulated 3D avatars with smooth turning, speed-based locomotion, recoil, hit reactions, jumping, and elimination animations
- Adaptive AI with obstacle steering, anti-stuck recovery, separation, line-of-sight combat, projectiles, armor, and reloads
- Multi-phase shrinking storm and tactical minimap
- Medkits, armor, ammunition, and weapon pickups
- Persistent local career XP, eliminations, placements, and victories
- Directional damage indicators, precision hit feedback, and full mobile combat controls
- Adaptive mobile resolution, shadow quality, vegetation, animation distance, and lobby frame rate
- Safe-area-aware portrait, landscape, small-screen, and tablet layouts
- Procedural Web Audio effects and responsive desktop/mobile UI

## Production

```bash
npm run build
npm run preview
```

Deploy the generated `dist` directory to any static host. Vercel configuration is included.

## Asset attribution

The animated `Soldier.glb` and `Michelle.glb` models are distributed with the Three.js examples (`mrdoob/three.js`, `examples/models/gltf`). Both are loaded locally and enhanced with custom operator accents, equipment, weapon geometry, and combat animation blending. Michelle uses Soldier's compatible Mixamo locomotion clips. All island structures, weapons, loot, supply drops, and effects are generated in code.

## Multiplayer scope

ASHFALL 1.2.0 provides online duo co-op rather than large public matchmaking. Both players must be online and use exact callsigns. Friend requests are live; accepted friends persist on the device. The inviting player hosts bot and storm state. No account or gameplay database is required.
