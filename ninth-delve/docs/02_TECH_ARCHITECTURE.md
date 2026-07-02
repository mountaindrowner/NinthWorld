# 02 — TECHNICAL ARCHITECTURE

## 0. The tech decision (delegated, here's the call)
**Canvas 2D software raycaster, Arena-flavored.** Not Three.js. Reasons:
1. Combat is turn-based, so we don't need true-3D fidelity — the raycaster view is
   a *mood backdrop* for a dice game half the time.
2. Zero dependencies = every line legible to Claude Code, runs anywhere, deploys
   to GitHub Pages with no build step. Maximum "Fable-native."
3. Arena itself was 2.5D; single-height texture walls + billboard sprites IS the
   authentic look.
4. 64×64 texel art fits a pixel-art/AI-gen pipeline perfectly.
Documented upgrade path: map grid, entities, and combat layer are renderer-agnostic;
a Three.js renderer could be swapped in later by reimplementing `render()` only.

## 1. Constraints (hard)
- Vanilla ES modules. **No** frameworks, bundlers, npm packages, or transpilers.
- Runs from `index.html` via `python3 -m http.server` or GitHub Pages.
- **No localStorage in any in-chat artifact build**; for the GitHub Pages deploy a
  save system is a stretch goal only (slice is one sitting).
- Every visual asset has a **procedural fallback** drawn in code at boot, so the
  game is fully playable with zero PNG files present.

## 2. Repo layout
```
index.html            ← canvas, UI roots, module entry
src/
  main.js             ← boot, game loop, state machine
  engine/
    raycaster.js      ← DDA walls, floor/ceiling, sprite pass
    input.js          ← keyboard + pointer-lock mouse yaw
    audio.js          ← WebAudio procedural cues
    texgen.js         ← procedural fallback textures/sprites
  game/
    state.js          ← the single mutable GameState + serializers
    player.js         ← pools, edge, effort math, damage track, recovery
    dice.js           ← pure functions: roll, resolveTask, specialRoll
    combat.js         ← encounter controller (turn engine)
    intrusions.js     ← trigger logic + table lookup + XP transactions
    cyphers.js        ← registry, identify/use resolution
    entities.js       ← creatures: spawn, AI-lite (explore) + combat behaviors
    world.js          ← map grid, doors, triggers, pickups, LOS, collision
  ui/
    hud.js            ← compass, pools bars, damage track, cypher slots, shins
    dicetray.js       ← the roll panel (pillar #1 lives here)
    menus.js          ← encounter action menu, examine modal, intrusion modal
    report.js         ← Delve Report end screen
  data/
    map_whisperlock.js    ← grid + placement tables (from Dungeon doc)
    creatures.js          ← roster (from Dungeon doc §4)
    cyphers_oddities.js   ← loot registry (from Dungeon doc §6)
    intrusion_tables.js   ← global + per-zone + per-creature
    pregen_kave.js        ← character sheet constants (Rules doc §7)
assets/               ← optional PNG/OGG overrides (see 04_ASSET_SPEC)
docs/                 ← this suite
HANDOVER.md           ← session log (Claude Code maintains)
```

## 3. Rendering pipeline (`raycaster.js`)
- Internal buffer **320×200** (`ImageData`), integer-upscaled to fit window,
  `image-rendering: pixelated`.
- **Walls:** DDA grid raycast (Lodev-style), one ray per column; perpendicular
  distance for fishbowl correction; textured vertical slices from 64×64 texture
  atlas; per-side shading (N/S vs E/W ×0.75) + distance fog toward palette void.
- **Floor/ceiling:** MVP = two vertical-gradient fills; M7 stretch = per-row
  affine texture cast.
- **Doors:** thin-wall type rendered at cell midline; slide-open animation offsets
  the texture u-coordinate; locked doors render glyph overlay texel band.
- **Sprites:** billboards; sort back-to-front; scale by 1/dist; clip per column
  against wall z-buffer; 2 idle frames (explore), lunge/hit/death frames driven by
  combat events. Boss uses 64×96.
- **Encounter backdrop:** when combat starts, freeze camera, keep rendering at
  ~half rate with a subtle sway; UI overlays on top.
- Perf budget: full wall+sprite pass < 8 ms on a mid laptop; if not, halve ray
  count and double column width (Arena did worse).

## 4. Simulation
- Grid: 24×24 cells, 1 cell = 1.5 m. `MAP[y][x]` = int code (see data file legend).
- Player: position float x/y, angle; collision = circle r0.3 vs solid cells,
  slide along walls. Move 4 forward / 3 strafe cells·s⁻¹ (explore only).
- **LOS:** DDA ray entity→player, blocked by solid/closed-door cells.
- **Encounter trigger:** hostile entity with LOS and dist ≤ its aggro range →
  `state → ENCOUNTER`, pull all hostiles with LOS-or-adjacency into the fight,
  snap range bands per Rules §3.2.
- Explore AI: idle wander in home zone; murden guards hoard; broken hound patrols
  through its phase-walls (it ignores `S` cells).

## 5. Game state machine
```
BOOT → TITLE → EXPLORE ⇄ ENCOUNTER
                 │  │        └─ DEFEAT → REPORT
                 │  ├─ MODAL (examine / intrusion / pickup / glyph puzzle)
                 │  └─ EXIT reached → REPORT
```
One reducer-style `dispatch(action)` mutating `GameState`; every combat action is
an `Action` object so the dice tray can render its full math trail. `dice.js` is
pure/deterministic given an injected RNG (seedable for tests).

## 6. Turn engine (`combat.js`)
```
startEncounter(enemies) → initiativeRoll (Speed vs maxLevel×3)
loop round:
  playerPhase: await menu action → resolve via dice.resolveTask → apply effects
  enemyPhase: for each living enemy → chooseAttack → PLAYER defense roll
              (dicetray, with shield/stance chips) → apply damage/effects
  checks: deaths, flee success, damage-track transitions, over-limit intrusion odds
```
All numbers flow through `resolveTask({base, skillSteps, assetChips[], effortLevels,
hinderChips[], pool, edge})` which returns the full audit trail for the tray.

## 7. Input
Explore: WASD move/strafe, mouse-yaw via Pointer Lock (Q/E fallback turn),
E interact, Tab character sheet. Encounter/modals: mouse/tap buttons + number
hotkeys. Touch = stretch (M7): virtual stick + tap menus; document only.

## 8. Audio (`audio.js`)
Procedural WebAudio only: filtered-noise footsteps keyed to step cadence, low
drone per zone (detune per zone id), dice-clatter (short noise bursts), hit thud
(sine drop), whisper motif = band-passed noise + slow LFO. Cue list in Asset doc.

## 9. Testing checklist per milestone
Seeded RNG replay of one full encounter · map connectivity flood-fill (start
reaches exit with door/key graph satisfied) · pool math table tests (Effort costs
3/5/7 −Edge; armor surcharge) · damage-track transitions · dice tray shows every
modifier chip for a 3-chip roll.
