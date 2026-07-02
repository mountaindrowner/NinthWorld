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
