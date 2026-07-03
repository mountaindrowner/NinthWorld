# 08 — TECH STACK BRIEF (for research sessions)
**Timestamped: 2026-07-03** · Latest date wins. Written by the build session so
any research session can align its work to what actually exists.

## What Ninth Delve is built on: NOTHING (deliberately)
The game is **100% hand-written vanilla JavaScript (ES modules)**. There is:
- **No engine or framework** — not Phaser, not Three.js, not Babylon.js, no enable3d
- **No build step** — no npm, no bundler, no Vite, no TypeScript, no transpiler
- **No runtime dependencies of any kind** — the repo has no package.json
- **No asset files required** — all art and audio are generated procedurally in code

It runs by serving static files (`python3 -m http.server`, GitHub Pages,
githack). Open `index.html`, play. Every line of code is project-owned and
AI-legible; that zero-dependency rule is a founding design pillar ("any AI
session can run and reason about every line").

## The renderer (the part research keeps asking about)
A **hand-rolled software raycaster** — the doc-recommended "path 1":
- Lodev-style DDA grid raycast, one ray per screen column
- Draws into an offscreen **Canvas 2D** buffer at **384×216** (16:9), then
  integer-upscales with `image-rendering: pixelated` (chunky retro texels)
- **Not WebGL.** Plain 2D canvas `drawImage`/`fillRect` calls; runs 60fps
- Textured walls (64×64, per-zone), distance fog to a palette void color,
  per-side shading, sliding doors (animated texture offset)
- **Billboard sprites** with per-column z-buffer occlusion, distance fog,
  **directional facing** (front/back/mirrored-side chosen from creature
  heading), world-anchored damage popups, health bars
- Floor/ceiling are gradient fills (textured floor-casting = known future item)
- The simulation layer (map grid, entities, combat) is **renderer-agnostic**;
  `render()` is designed to be swappable. **Babylon.js is earmarked** as the
  target if/when we need true 3D (e.g. a surface world) — decided 2026-07-03
  after reviewing the Phaser research.

## Everything else (also hand-rolled, all working)
- **Game rules:** Cypher System (Numenera) resolution engine — pure seedable
  functions (`resolveTask`, Effort/Edge/pools/damage track). Fully unit-tested
  in-browser via `?test=1`.
- **Combat:** real-time, Morrowind-style. Rolls resolve silently in the
  background; player sees plain-language messages, popups, health bars.
  NO dice are ever shown (hard design ruling, 2026-07-03).
- **UI:** immediate-mode panels/buttons drawn into the same pixel buffer
  (HUD, menus, modals, glyph puzzle, report screen). No DOM UI, no CSS
  framework — one `<canvas>` element.
- **Input:** raw DOM events. Desktop: WASD + pointer-lock mouse, click swing,
  hold = heavy. Touch: virtual thumbstick + look-drag + on-screen buttons.
- **Audio:** procedural WebAudio synthesis (no audio files) — footsteps, hits,
  door slides, zone drones, whisper cues.
- **Art:** procedural pixel art drawn in code at boot (palette-locked, 16
  colors), with a **PNG drop-in override system**: any correctly-named file in
  `/assets` replaces its procedural fallback, zero code changes. (This is the
  pipeline hand-made Aseprite art would flow through.)
- **Maps:** 24×24 grid defined in a JS data file today. **Tiled** (the editor)
  is the intended authoring tool for future dungeons via a JSON→our-format
  import script — runtime stays dependency-free.
- **Testing:** `?test=1` runs connectivity/dice-math/roster suites in the
  console; the build session also drives the game headlessly (Playwright +
  Chromium) during development. `?seed=N` gives reproducible runs;
  `?sprites=1` renders a sprite gallery.

## What this means for research alignment
1. Research framed as "which engine should we choose?" is settled: **custom
   raycaster now, Babylon.js if true 3D later.** Useful research targets the
   things we still hand-roll or haven't built.
2. High-value research areas: raycaster techniques (textured floor/ceiling
   casting, variable wall heights, lighting tricks, sprite scaling quality),
   WebAudio music/ambience synthesis, Tiled JSON import patterns, touch
   ergonomics for FPS-likes, palette-locked pixel-art pipelines (Aseprite),
   Babylon.js first-person patterns (for the future surface world), and
   Numenera/Cypher mechanical depth (creature design, cypher variety).
3. Anything that assumes npm/bundlers/frameworks must justify breaking the
   zero-dependency rule — the bar for that is high and it's Mark's call.
4. Already harvested from the Phaser research (2026-07-03): the diagonal-
   movement normalization bug (real, being fixed), Babylon-over-Three ruling,
   Tiled adoption plan, Aseprite as the art tool.

## Repo shape (for orientation)
```
ninth-delve/
  index.html            one canvas + module entry
  src/engine/           raycaster, input, audio, texgen (procedural art), screen
  src/game/             dice (Cypher core), player, combat, world, state,
                        entities, cyphers, intrusions
  src/ui/               widgets, hud, menus, report, touch
  src/data/             map, creatures, cyphers, pregen, whispers, intrusions
  docs/                 00–08 design suite (this file is 08)
  HANDOVER.md           per-session build log
```
