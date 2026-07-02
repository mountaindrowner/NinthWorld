# HANDOVER LOG
(Claude Code appends session entries here — template in CLAUDE.md)

## 2026-07-02 — M0 complete
Done:
- Repo layout per Tech §2 (`src/{engine,game,ui,data}`, `assets/{textures,sprites,ui}`).
- `index.html`: 320×200 buffer, integer upscale, `image-rendering: pixelated`, UI
  roots (hud/dicetray/menus/report, hidden until their milestone).
- `src/main.js`: boot → TITLE state, game loop, test pattern (fog gradient +
  16-color palette swatches + gold/cyan accent + resolved-asset thumbnails +
  fps/seed HUD), `?test=1` harness, `?seed=N` captured for the M3 RNG.
- `src/engine/texgen.js`: `PALETTE` (Buried Aeon, exact hexes) + procedural
  fallbacks for all 21 asset keys (mirrors Asset §2–§4 file list exactly) +
  `loadAssets()` that probes the PNG then falls back. Fallbacks are seeded
  (mulberry32) so they're identical every boot.
- `src/data/map_whisperlock.js`: clean 24×24 `MAP` + `PLACEMENTS` (§3.1),
  `ZONES`, `CHASM`, door/key gating constants.
- `src/game/world.js`: `cellAt` + `connectivityTest()` flood-fill (P→X through
  door/key graph; L opens on glyph-solvable; secret/phase vaults via S wall).

Deviations/Doc issues:
- **Dungeon §3 ASCII map is not literal and was NOT transcribed verbatim.** Rows
  vary 24–25 chars, contain interior spaces, and row 5 embeds the text label
  "Z5 core" as if it were cells. Per CLAUDE.md ("Placement table beats ASCII map;
  geometry may flex") I built a fresh, self-consistent 24×24 grid that honors
  every §3.1 placement + zone and passes connectivity. Placements/zones unchanged;
  only corridor geometry differs from the sketch. Suggest replacing the ASCII in
  §3 with the validated grid (append-only note — not done to preserve history).
- Introduced a `V` marker only in the scratch generator for the C5/C6 phase vault;
  in the shipped `MAP` that cell is plain floor `.` and the vault is recorded as
  placement `V` (sealed:'phase') — no new legend char in the grid.
- Asset fallback probing logs one 404 per missing PNG (21 total). These are
  `<img>` load failures, not JS errors (pageerror count = 0). Harmless for M0;
  can be silenced later by shipping an asset manifest so we only fetch present
  files (leaving the "drop a PNG to override" workflow intact).

Playtest notes:
- Served via `python3 -m http.server 8000`, driven headless (Chromium). Page
  loads; test pattern renders at 320×200 upscaled (~43 fps in headless VM, no
  raycaster yet so real perf is an M1 concern). `?test=1&seed=7`:
  connectivity PASS (all 19 checks), assets 0 file / 21 fallback / 0 unresolved,
  **M0 acceptance PASS**. No JS/page errors.

Next: M1 — Walking sim. First task: implement `src/engine/raycaster.js` DDA wall
cast into the 320×200 buffer (perp-distance fishbowl fix, per-side shading, fog
toward `void`), reading solids from `world.cellAt` (treat `# G S L` and closed
`D` as solid); then `src/engine/input.js` WASD + pointer-lock yaw with Q/E
fallback and circle-slide collision (r=0.3). Wire `main.js` EXPLORE state to
spawn the player at placement `P` (2,22) facing N.

## 2026-07-02 — M1 complete
Done:
- `src/engine/raycaster.js`: Lodev-style DDA wall cast into the 320×200 buffer —
  perpendicular-distance fishbowl fix, per-side shading (E/W darkened ≈×0.75),
  distance fog lerping to `void` (FOG_FAR 13 cells), textured vertical slices
  from the 64×64 atlas, and two vertical-gradient fills for ceiling/floor. DDA
  has a 64-step guard (no infinite loops).
- `src/engine/input.js`: WASD move/strafe, Pointer-Lock mouse-yaw (click canvas
  to engage) with Q/E + arrow-key turn fallback; E doubles as interact (for M2).
  Consumable yaw accumulator; movement integration stays in main.js.
- `world.js` grew M1 helpers: `isRenderSolid`, `isBlocking`, `zoneAt`,
  `wallTextureKey` (Asset §2 per-zone map: Z2→warren, Z4/Z5→conduit, S→scuffed,
  mural override, D→door_slide, L→door_glyph, G→pillar_glyph, else synth), and
  `moveWithCollision` (circle r=0.3, axis-separated slide → no corner clipping).
- `main.js`: EXPLORE state, player spawns at P (2.5,22.5) facing N; loop does
  dt-clamped turn+move then raycast render; FPS counter + crosshair HUD; renamed
  the persistent `?test=1` label from "M0 acceptance" to "test suite".
- Added `MURALS` to map data (nest clue mural wall at (4,15)).

Deviations/Doc issues:
- **Doors and the chasm are passable in M1** (they render but don't block).
  M1 requires "walk the full Whisperlock" for the fps/texture pass, but door
  open-logic is M2 and chasm crossing is M6. So collision blocks only true
  walls / pillars / secret+phase walls; doors render as closed panels and the
  chasm renders as floor. Blocking for D/L and pit rendering for `~` arrive with
  their milestones. (No doc conflict — "door cells render closed (no logic yet)".)
- All `S` cells render as `wall_scuffed` for now, including the den/vault *phase*
  walls (not just the #5 bump-search secret). Distinct phase-wall telegraphing
  (hound phasing M5, whisper hint for the vault) can override later; harmless
  visually in M1.

Playtest notes:
- Served via `python3 -m http.server 8000`, driven headless (Chromium),
  `?test=1&seed=7`. Spawn view: synth walls, a closed sliding door dead ahead
  (gold hazard edges), Z2 warren texture to the right — per-zone texturing
  confirmed. Walking north 600 ms moved the player 2.4 cells straight up the
  x=2 corridor (4 cells/s, no drift/clipping); Q turned smoothly; collision
  probe against the border wall held position. **60 fps** in the headless VM
  (rAF-capped, not a mid-laptop bench — the per-column drawImage+single-overlay
  pass is light, so ≥55 is expected on real hardware; revisit if a real bench
  says otherwise). `?test=1` suite still PASS (connectivity 19/19, 21/21 assets).
  No JS/page errors.

Next: M2 — World interaction. First task: billboard sprite pass in
`raycaster.js` with a per-column wall z-buffer (store `perp` per column during
the wall pass; sort entities back-to-front; clip sprite columns where wall is
nearer). Then pickups (E-interact + unidentified-cypher modal), sliding-door
open logic (make D non-blocking only while animating open; add the u-offset
slide), the inert glyph-locked door, secret bump-search on `wall_scuffed` cells,
inventory in GameState, and HUD v1 (shins / cypher slots / compass).
