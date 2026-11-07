# ASHFALL — Tactical Battlegrounds

An original, browser-playable real-time 3D third-person battle royale built with Three.js, WebGL, JavaScript, and Vite.

## Play

```bash
npm install
npm run dev
```

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

- Real-time 3D operator hangar lobby with cinematic lighting and camera parallax
- Detailed transport-plane arrival, manual jumping, steerable freefall, automatic/manual parachute deployment, and landing
- Expanded 2.4 km island with seven districts, coastlines, water, roads, terrain patches, 520 trees, rocks, and grass
- Real-time WebGL third-person camera, ADS, jumping, dynamic shadows, fog, procedural textures, and drifting ash
- Professionally textured glTF soldiers with skeletal idle, walk, and run animations (procedural fallback included)
- Detailed rifles, concrete structures, rooftop equipment, reinforced crates, layered vegetation, and animated supply drops
- Precision headshots, floating damage numbers, and live enemy health/armor bars
- 24-combatant Battle Royale and 12-combatant Blitz modes
- Three operators with distinct tactical abilities
- Three starting weapon classes plus in-match weapon loot
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

The animated `Soldier.glb` model is distributed with the Three.js examples (`mrdoob/three.js`, `examples/models/gltf/Soldier.glb`). It is loaded locally and enhanced with custom operator accents, equipment, weapon geometry, and combat animation blending. All island structures, weapons, loot, supply drops, and effects are generated in code.
