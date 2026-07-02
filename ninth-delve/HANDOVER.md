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

## 2026-07-02 — M2 complete
Done:
- Data: `pregen_kave.js` (Rules §7), `creatures.js` (§4 stat contract),
  `cyphers_oddities.js` (§6, level 1d6+X at boot, unidentified instances).
- `game/state.js`: the single mutable GameState + `awardXP`/`logEvent`/`overLimit`.
- `game/dice.js`: pure seedable RNG + `resolveTask` audit trail + `specialOf`
  (nat 1/17/18/19/20) + `rollRecovery` (written now; the tray/combat wire it in M3+).
- `game/entities.js`: `spawnExploreEntities` from the placement table — creature
  billboards + loot pickups; sealed-wall loot spawns `hidden`.
- `raycaster.js`: billboard sprite pass with a per-column z-buffer (back-to-front
  sort, per-column occlusion clip, fog, floor-anchored, boss 96px = 1.5 cells),
  and door u-offset slide; DDA now uses state-aware `renderSolidAt` so open doors
  let rays pass.
- `world.js` grew M2: `doorSlide`, `renderSolidAt`, `blockedAt`, `updateDoors`
  (auto-open within 1.9 tiles, ~0.25 s slide), `interact` (nearest pickup, else
  bump-search a scuffed secret), `revealSecret`, `facingLabel` compass.
- `input.js` rewritten: E = interact (edge), Q/arrows turn fallback, buffer-space
  click translation, number/enter/esc/tab key buffer for menus.
- `ui/widgets.js` (shared immediate-mode primitives), `ui/hud.js` (portrait
  face-bar, pool bars, damage track, cypher slots w/ over-limit, shins, XP,
  compass, event ticker), `ui/menus.js` (`drawModal`, incl. choice buttons for
  later intrusion/examine modals).
- `main.js`: EXPLORE↔MODAL loop; per-frame click/key lists; mode captured at
  frame start so the E that opens a modal can't also dismiss it.

Deviations/Doc issues:
- **Kave starts with 0 cyphers** (empty slots, limit 2). Rules §7 lists book
  pregen cyphers (rejuvenator/density nodule) but the §3.1 placement table also
  puts those exact two in the dungeon as C1 (@#6) and C4 (@den). To honor the
  discovery pillar and the placements, they are FOUND unidentified, not carried.
  Flagging the §7↔§3.1 overlap; suggest §7 note "starting cyphers are the
  dungeon's C1/C4, found in play".
- Doors **auto-open on proximity** (rather than requiring an explicit E) for
  smooth exploration; E-interact is reserved for pickups + bump-search. L stays
  closed/inert until `glyph.solved` (M6). Chasm still blocks (M6).
- Added `src/ui/widgets.js` — shared UI primitives, not in the §2 layout. Small,
  justified; the four §2 UI modules build on it.

Playtest notes:
- `?seed=7`, headless: teleport-onto-pickup + E → cypher enters inventory and the
  "unidentified cypher — a cold ampoule that squirms" modal shows (C1 sensory
  name correct); Enter dismisses → EXPLORE. Bump-search at (3.5,17.5) facing E
  revealed secret #5 and unhid its loot. Door (2,18) auto-opened to t=1.0 within
  0.5 s. HUD renders full (pools 14/12/8, HALE, 1/2 cyphers, 5 shins). `?test=1`
  suite PASS, no JS errors. (~39 fps headless with sprites+HUD+modal.)

Next: M3 — The dice (the heart). `player.js`: Effort cost math (3/5/7 −Edge once
per action; Speed-Effort armor surcharge +1/level; Impaired +1/level), pool
spend/overflow (Might→Speed→Intellect) with damage-track transitions, recovery
roll + daily rest sequence. `ui/dicetray.js`: chips from `resolveTask`, animated
d20 (d20_strip), result banner, Effort spend buttons with live cost preview,
character sheet (Tab). Wire a standalone "practice roll" in EXPLORE to exercise
the tray before M4 combat. Add dice-math unit tables to `?test=1` (Effort 1/2 on
Might = 2/4 for Edge 1; on Speed = 3/6 with armor; pool-0 overflow + track drop).

## 2026-07-02 — M3 complete
Done:
- `game/player.js`: `effortCost` (3/5/7, −Edge once, +surcharge/level for Speed,
  +1/level Impaired), `abilityCost`, `payCost` (empties→track drop), `applyDamage`
  (Might→Speed→Intellect overflow, per-pool track drop, overflow=dead),
  `restorePool`/`applyRecovery`/`recover` (0→+ raises track).
- `ui/dicetray.js`: full roll state machine (choose→rolling→result) on `state.tray`.
  Renders base + every ease/hinder chip, live target, Effort ± with cost preview
  and pool-after, animated d20 (d20_strip), SUCCESS/FAILURE banner, special-roll
  line, 19/20 minor/major choice buttons, and a Reroll (1 XP, take-better, same
  chips) button. `onResolve(audit)` hands the result back to the caller.
- `ui/menus.js`: added `drawSheet` (Tab character sheet).
- `main.js`: ROLL and SHEET modes; R = practice skill+asset+Effort strike to
  exercise the tray; dice-math unit tables added to `?test=1`.

Deviations/Doc issues:
- `resolveTask` treats natural 19/20 as an automatic success (book text: 17–20
  special range), so a minor/major effect always lands on 19/20 regardless of
  target. Flagging as an interpretation; matches the special-roll table intent.
- Reroll (Rules §6 / build-plan M6) is already hosted on the tray now since the
  tray is where it lives; the XP ledger + intrusion economy that feed it arrive
  in M6. Rerolling replays the same chips (no re-charged Effort).

Playtest notes:
- `?seed=7`, headless: `?test=1` dice math PASS — Effort1/2 Might = 2/4, Speed
  +armor = 3/6, Impaired = 3/6, target math, special rolls, pool-0 overflow +
  Hale→Impaired. Practice roll: opened tray (diff 5, skill −1, asset −1),
  +1 Effort (cost 2, Might 14→12), ROLL → nat 9 vs target 6 = SUCCESS →
  "hit for 6"; Continue → EXPLORE. Sheet opens on Tab. 60 fps, no errors.

Next: M4 — Encounter engine vs laak. [done below]

## 2026-07-02 — M4 complete
Done:
- `game/combat.js`: full turn engine. `maybeTrigger` (LOS + aggro from explore,
  pulls the group), `startEncounter` (freeze, snap range bands, initiative Speed
  roll vs maxLevel), round loop with player-first/enemy-first ordering, action
  menu (`playerAction`): Attack (broadsword immediate / thrown dagger at Short),
  Fleet of Foot (close a band), Aggression (stance toggle, 2 Might −Edge, eases
  attacks + hinders defenses), Catch Breath (recovery as action, consumes rest
  slot), Defend (eases next enemy phase), Flee (Speed roll → EXPLORE + re-aggro
  cooldown). Enemy phase = player Speed/Might defense rolls (shield asset, Defend
  ease, Aggression/skitter hinders). Damage both ways via `applyDamage`; special
  17/18 = +dmg, 19/20 = minor/major choice (dmg/knockback/stun); nat 1 = "the GM
  smiles" stub (real intrusions M6). Victory → EXPLORE, defeat → REPORT.
- `game/world.js`: `tileDist`, `hasLOS` (segment march, blocked by wall/closed
  door/lock).
- `ui/menus.js`: `drawEncounterMenu` (round + enemy hp/band/stun list + action
  buttons). `ui/report.js`: Delve Report (functional stub; M7 expands).
- `main.js`: ENCOUNTER + REPORT modes; `maybeTrigger` polled in explore; fps
  moved top-right (was colliding with the encounter panel).

Deviations/Doc issues:
- **Input bug fixed:** Enter/Space had doubled as world-interact (only E should).
  Symptom: finishing a combat tray with Enter auto-grabbed the pickup underfoot.
  Now only `E` interacts; Enter/Space are UI-confirm only.
- Enemy movement is coarse: an out-of-band enemy closes one band per enemy turn
  (no per-tile pathing in combat — bands are the spatial model, Rules §3.2).
- Special-roll "favor" on a successful defense currently just stuns the attacker;
  richer defense specials can come with the M5 roster nuances.

Playtest notes:
- `?seed=7`, headless full fight: teleport onto #6 laak → encounter triggers →
  initiative tray → player attack tray (nat 9 vs target) → laak falls → victory →
  EXPLORE, kills 1, player Hale, no accidental pickup, no errors. Every roll went
  through the tray. `?seed=3`: Aggression toggles for 1 Might (14→13) and adds the
  "Aggression" ease chip to the attack (same flag hinders defenses). 60 fps.

Next: M5 — Full roster & boss. `entities.js`/`combat.js`: murden (static hinder
aura in Short, snatch-and-flee intrusion, drops stolen cypher on death), broken
hound (den phasing in explore ignoring S walls, phase-behind intrusion,
**phase-lunge ignores Armor** — Appendix REQUIRED, already stubbed in
resolveDefense), Abykos (physical resist 3 / energy 0, per-round Drain of a
random carried cypher level, Might-defense touch, repositioning, telegraph).
`game/cyphers.js`: USE effects C1–C6 + Examine (hindered Intellect reveals
identity). Multi-enemy encounters. Over-limit rule (intrusion on nat 1–2).
Add roster/boss checks to `?test=1` (hound hits through Armor; boss drains a
hoarded cypher by round 3 in a no-use run; all six cyphers function).

## 2026-07-02 — M5 complete
Done:
- `game/cyphers.js`: USE effects for all six (rejuvenate/detonation/gravity/
  density/phase/stim), `examineSpec`/`applyExamine` (hindered Intellect + murden
  static), `drainRandomCypher` (Abykos §7). `world.js`: `phaseFront` (C5 opens a
  wall / phase-sealed vault).
- `combat.js` roster specials: Abykos Drain each round start (destroys a hoarded
  cypher, forces cypher use), reposition (phases to Short), Might-defense touch +
  nat-1 Might drain; **phase-lunge ignores Armor** (Appendix REQUIRED — without
  it 3−3=0 and hounds tickle); murden snatch-and-flee (steals a cypher, drops it
  on death, recoverable) + telepathic-static Intellect hinder; hound phase-behind
  (next defense hindered); over-limit rule (intrusion on nat 1–2). Use/Examine
  are combat actions (consume the turn).
- `ui/menus.js`: `drawCypherMenu` (Use/Examine each cypher, explore or combat);
  encounter menu reflowed to 8 actions (4×2). `main.js`: CYPHERS mode + `C` key.
- Multi-enemy encounters work (nest pulls murden×2 + laak, + a nearby scout).
- `?test=1` roster & cypher tables added.

Deviations/Doc issues:
- **Laak explore aggro lowered 4→3** (a value I invented; the doc gives no explore
  aggro range). At 4 the tutorial laak was inside aggro at the spawn tile and the
  fight fired on frame 1; at 3 it triggers when the player steps toward it.
- Detonation "target's Immediate" is modeled as all enemies sharing the target's
  range band (bands are the spatial model, Rules §3.2).
- Murden snatch fires as its intrusion on a failed/over-limit defense; the murden
  then leaves the fight (flees) and its stolen cypher drops as a pickup when it's
  later killed. Explore hound den-phasing (patrolling through S walls) is not
  simulated — hounds are stationary billboards until engaged (noted for M6/polish).

Playtest notes:
- `?seed=5`, headless: `?test=1` roster & cyphers PASS (phase-lunge through Armor;
  Abykos physical 3 / energy 0; C1–C6 all function; Drain L2→1→destroyed). Nest
  triggers a 4-enemy fight. Boss Drain run (Defend only): carried cypher levels
  12→8 across rounds — the boss eats hoarded cyphers by round 3. Boss renders
  (translucent static, 15/15). 60 fps, no errors.

Next: M6 — Systems of consequence. `intrusions.js` + `data/intrusion_tables.js`:
global/zone/creature tables + the 5 scripted intrusions (Dungeon §8), accept
+2 XP / refuse −1 modal (can't refuse at 0). Wire the nat-1 stub in combat to the
real table. XP ledger already feeds the tray reroll. Glyph puzzle (pillar rotate,
O2/mural/Intellect clue paths, wrong-attempt intrusion) opening L. Chasm traversal
(C3 path + climb rolls). Phase vault via C5 / den wall (phaseFront already opens
it). Discovery XP on zone entry/secrets/artifact (zone-entry XP still TODO). Key
pickup → exit unlock (keyTaken already set; wire X to require it).
