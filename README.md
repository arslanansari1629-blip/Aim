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
- **Space** — jump
- **R** — reload
- **Shift** — combat dash
- **Q** — operator ability
- **E** — collect loot
- **1 / 2** — switch weapon
- **Escape** — pause

Touch controls and assisted aiming appear automatically on mobile devices.

## Features

- Real-time WebGL 3D island with third-person camera, ADS, jumping, dynamic shadows, fog, procedural textures, and drifting ash
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
- Procedural Web Audio effects and responsive desktop/mobile UI

## Production

```bash
npm run build
npm run preview
```

Deploy the generated `dist` directory to any static host. Vercel configuration is included.

## Asset attribution

The animated `Soldier.glb` model is distributed with the Three.js examples (`mrdoob/three.js`, `examples/models/gltf/Soldier.glb`). It is loaded locally and enhanced with custom operator accents, equipment, weapon geometry, and combat animation blending. All island structures, weapons, loot, supply drops, and effects are generated in code.
