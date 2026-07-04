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

## 2026-07-02 — M6 complete
Done:
- `data/intrusion_tables.js` + `game/intrusions.js`: the five scripted intrusions
  (accept +2 XP / refuse −1 XP; **refuse disabled at 0 XP**), a free nat-1 pool
  (global/zone/creature), and a `queueScripted`/`pumpScripted` queue so multiple
  scripted moments fire in sequence without clobbering. Combat nat-1 for generic
  creatures now rolls the table (e.g. laak latch).
- Glyph puzzle (`ui/menus.js drawGlyphPuzzle`, GLYPH mode): three pillars rotate;
  correct triple (rolled at boot) opens L (+2 XP). Clue via **any** of O2 in
  inventory / Z2 mural sighting / a hindered Intellect intuition (tray). Wrong
  Attempt rolls the Z3 intrusion. Whisper-lie scripted fires on first open.
- Chasm (`world.js`): C3 sets `crossing`; the climb route interacts on the edge →
  Z4 handhold intrusion → two Might climb tasks (diff 4, trained −1) with a
  wandering-intrusion roll between → `crossing`.
- Phase vault: `phaseFront` (from M5) opens the C5-sealed vault / den wall.
- Discovery XP: +1 per first zone entry, +2 secret, +2 glyph, +3 artifact,
  +2 true clear. Mural sighting sets a glyph clue. Key → exit: stepping on X with
  the Key ends the delve (REPORT, reason 'exit', +2 clear); without it, a prompt.
- `main.js`: GLYPH mode, interact routing (glyph/climb/pickup/secret), modal
  `onResolve` continuations, world-events + scripted pump each explore frame.

Deviations/Doc issues:
- Z1 "floor gives way" + Z2 "strap snaps" both fire on first entry to Z2 (queued
  in order) rather than each precisely on its own trigger — the queue avoids
  modal-clobber and keeps them near their thematic beats. Flagging as a minor
  staging choice.
- Wrong glyph attempt uses the free Z3 table intrusion (may deal 2 dmg / hound
  ambush flavor) rather than the accept/refuse modal, matching "wrong-attempt
  intrusion" as a penalty rather than an XP offer.

Playtest notes:
- `?seed=7`, headless: refuse disabled at 0 XP ✓; glyph solved via O2 clue ✓ and
  mural clue ✓ (→ L opens, +2 XP); step on X with Key → REPORT('exit') ✓; C3
  crossing walks the chasm (x 18.5→20.5) ✓; climb route fires the Z4 intrusion +
  two Might climb trays ✓ (that run slipped — a normal roll outcome; the route is
  completable). Confirmed the den hounds ambush anyone approaching the chasm
  (encounter triggers on approach — intended). Suite still PASS, no errors.

Next: M7 — Juice, audio, balance, report. `engine/audio.js` (WebAudio cues per
Asset §5: step/door/dice/hit/hurt/cypher/drain/whisper/zone drones/glyph-motif).
Whisper text system + the 9 script hooks (grieving-archivist, ≤2 sentences).
Hit flashes, 2px/100ms screen shake, sprite lunge tweens. Full Delve Report
(GDD §6: cyphers used vs hoarded, Tier-2 progress). Title screen. Balancing pass
vs the Appendix targets. 3 logged playthroughs; ensure 20–40 min & no console
errors across a full run.

## 2026-07-02 — M7 complete (slice done)
Done:
- `engine/audio.js`: procedural WebAudio, lazy context on first gesture, all
  Asset §5 cues (step/door/dice/hit/hurt/cypher/drain/whisper/glyph-motif +
  per-zone detuned drone). Wired: dice (tray), hit/hurt/drain (combat), door
  (world), whisper + zone drone (main). Safe no-op headless.
- `data/whispers.js` + whisper system: the 9 grieving-archivist hooks (≤2
  sentences, original) trigger once each (entry/cypher/kill/glyph/chasm/vault/
  boss/key/exit) as a fading mauve text box with the whisper cue.
- Juice: 2px/130ms screen shake + blood hit-flash on player damage, small shake
  on landing hits, creature lunge/hit action-frames during combat.
- Title screen (TITLE mode) with the artifact-key sprite; click/Enter to delve.
- Delve Report expanded (GDD §6): delve time, XP earned/spent, secrets, cyphers
  used vs hoarded, shins, kills, true-clear, Tier-2 progress; win/defeat framing.
- Combat tuning: broadsword reaches a Short-band foe by stepping in (Immediate
  move folded into the swing, Rules §3.2) so the repositioning boss stays
  meleeable — the grindy no-cypher win.

Balance (Appendix, verified analytically + by bot): Kave broadsword attack vs
murden = diff 3 → target 9 → 60% (Aggression → diff 2 → 75%) ✓. TTK: laak 1 hit
(6≥3) ≤1 rd; hound 1–2 hits; murden 5 dmg × hp 9 = 2–3 rds; boss 3 dmg through
Armor 3 → ~5 hits (competent, with Effort/Aggression/Density → 4–7 rds) ✓.
Hound phase-lunge deals 3 through Armor (else 0) ✓. Might-defense trained (Tough)
keeps incoming survivable. Cautious play enters the boss Impaired-ish with a rest
slot left. Discovery XP available ≈ 16 (5 zones + 2 secrets + glyph + 2 oddities
+ artifact + clear), matching the Appendix ~16.

Playtest notes (3 automated runs, `?seed=11`, headless):
- No-cypher boss: melee win in 16 rounds, ended Impaired (visibly grindy ✓).
- With-cypher boss (Detonation + Density): win in 13 rounds ✓.
- Death run (crippled pools): Might→Speed→Intellect overflow to Dead → Delve
  Report, reason 'defeat' ✓.
- Zero console errors across all three. Title→delve→entry whisper works; first
  kill fires the mournful whisper; HUD shows Might 0 → IMPAIRED after the boss.
- 20–40 min: content is sized for it (5 zones, ~6 expected encounters, puzzle,
  chasm choice, boss); the figure is a human-pace estimate, not bot-timed.

Deviations/Doc issues:
- Added `data/whispers.js` and `engine/audio.js` per the §2 layout (both listed).
  Added `ui/widgets.js` (M2, flagged) as shared UI primitives — the only file
  outside the doc's §2 list.
- The bot plays sub-optimally (no Effort/Aggression on attacks), so its boss TTK
  (13–16 rds) is longer than the Appendix 4–7; that band assumes competent play
  (Effort + Aggression + a cypher), which the mechanics support. The no-cypher
  path being long IS the intended "visibly grindy."

Status: **M0–M7 all complete; every acceptance box checked.** The Whisperlock is
a playable end-to-end slice: title → explore (raycaster, pickups, doors, secrets,
puzzle, chasm) → visible-dice Cypher combat vs the full roster + boss → Key →
exit / death → Delve Report. `?test=1` green (connectivity, assets, dice, roster).

Next (post-slice / Stretch only): art PNG drop-in, textured floors, save via
localStorage (GH Pages), balance fine-tuning from real human playtests, reskin
creature names before any public build (README).

## 2026-07-02 — Stretch: touch controls
Done (user-requested Stretch item; Tech §7 "virtual stick + tap menus"):
- `engine/input.js`: touch layer. Left half = virtual move stick (analog
  `analogX/analogY`, −1..1); right half drag = look (feeds the same `yaw` as the
  mouse); on-screen E / Cyphers / Sheet buttons (`TOUCH_UI`, buffer coords).
  In non-EXPLORE modes a tap becomes a buffer click, so menus/tray/combat/report
  are already touch-usable. `touchActive` latches on first touch.
- `ui/touch.js`: draws the stick base + knob and the three buttons (EXPLORE only).
- `main.js`: movement uses the analog stick when `touchActive`, else WASD; draws
  the overlay in EXPLORE.
- Desktop keyboard/mouse untouched; the two schemes coexist (tap title to start
  also works).
Verified (headless, `hasTouch` mobile context, synthetic TouchEvents): tap-start
→ EXPLORE; stick-up walked north (y 22.5→20.5); right-drag turned (angle changed);
E button collected a cypher (→ pickup modal); suite still PASS; no errors.
Note: pointer-lock isn't used on touch (we preventDefault touches, so no synthetic
click/lock); look is raw drag-delta yaw. No pitch (engine is yaw-only by design).

## 2026-07-03 — Post-slice: widescreen + text legibility
Done (user-requested):
- **Widescreen 384×216 (16:9)**, same texel density as 320×200. New
  `engine/screen.js` exports BUF_W/BUF_H; all hardcoded dims in raycaster, main,
  hud, menus, dicetray, report, input (TOUCH_UI now edge-anchored), touch, and
  index.html now derive from it. Raycaster camera plane scaled by aspect
  (0.66 × aspect/1.6) so the wider buffer widens the FOV instead of stretching.
- **Legible text everywhere**: `widgets.text`/`wrapText`/`button` labels draw a
  1px void outline under every glyph; fps counter routed through the same path.
  Panels/chips retain their backing fills.
Verified: suite PASS, no errors; 16:9 window fills nearly edge-to-edge; ticker
text over a bright sprite and whisper text over walls both readable.
Doc note: Tech §3 / GDD pillar #4 say "320×200" — deliberately superseded by
user request; the integer-upscale + pixelated pipeline is unchanged.

## 2026-07-03 — DESIGN PIVOT: real-time combat ("love letter to Morrowind")
User directive: the game is a love letter to *Morrowind* — look/depth/immersion.
The turn-based tabletop encounter mode is retired; combat is now real-time with
the Cypher math rolling in the background (which is precisely how Morrowind
itself works: real-time swings, hidden dice). Our twist: the dice stay honest —
a fading **roll feed** (top-left message log) reports every roll (`atk murden —
d20 13 vs 9 · HIT 5`), so pillar #1's *visibility* survives even though the
*interruption* is gone.

Done (rewrote `game/combat.js`; touched cyphers/state/input/menus/raycaster/main):
- **Swing**: LMB tap = light swing (0.55s cd); **hold ≥350ms = heavy swing** —
  that IS Effort 1, paid from Might w/ Edge (Rules §2), easing the roll. Space
  also swings; touch gets an ATK button. First-person procedural broadsword
  viewmodel (idle sway, charge pull-back, cut arc).
- **Creature AI**: per-frame aggro (LOS+range) → chase (per-creature speed) →
  strike on cooldown → leash home. Enemy strikes = background player defense
  rolls (shield/trained/Stim eases; Aggression/skitter/phased hinders). Failed
  defense = damage − Armor (phase-lunge still ignores Armor), hurt flash/shake.
- **Specials auto-resolve, still reported**: 17/18 +dmg, 19 minor = +3 & knockback,
  20 major = +4 & stun. Nat 1 (or 1–2 over cypher limit) = fumble → intrusion.
- **Roster in real time**: murden snatch-and-flee on your fumbled defense (drops
  it on death); hound phases through den S-walls while chasing + phase-behind
  hinder; Abykos drains a cypher level every ~9s while engaged, blinks across
  the room if hugged, Might-defense touch.
- **Verbs remapped**: R = rest (recovery roll, blocked while hunted, clears the
  strap penalty) · F = Aggression stance toggle · C = cyphers (menus pause the
  world, Morrowind-style) · Detonation now throws at the nearest visible creature
  (2-tile blast); Stim = 15 s of eased actions (was 3 rounds).
- **Readability**: world-anchored damage popups (rise/fade, z-buffer clipped),
  health bars over hurt creatures, feed lines show "auto" for difficulty-0 rolls.
- The dice tray SURVIVES for deliberate stop-and-roll moments only: examine,
  chasm climb, glyph intuit. Initiative/range bands/turn engine deleted.

Doc impact (append-only note, docs not rewritten): supersedes Rules §3 combat
structure, Tech §6 turn engine, and the M4 acceptance framing. GDD pillar #1 is
reinterpreted: "every roll visible" = the roll feed; "player rolls everything"
still true mechanically (every resolution is a player-side resolveTask).

Verified headless (seeds 4/9): suite PASS (dice/roster tables updated to the new
API) · laak duel: aggro → background defense → swing HIT 6 → falls · murden duel:
murden died AND hurt the player back · boss: drain tick fired at +4s (cypher 3→2,
feed line), no errors anywhere. Screenshot shows feed + viewmodel + HUD.

Next: human playtest the feel (swing pacing, enemy speeds, drain cadence are all
first-guess numbers in combat.js RT table). Then the "beautiful look" half of the
Morrowind letter: textured floors/ceilings, better wall variety, lighting.

## 2026-07-03 — Dice tray fully removed (user: "exactly like Morrowind")
User directive: no interactive dice anywhere. `ui/dicetray.js` deleted; the ROLL
mode is gone. Every remaining roll resolves in the background via `resolveTask`
and reports to the roll feed:
- **Chasm climb**: E at the edge → both Might climb rolls resolve instantly
  (feed: `climb down — d20 X vs 9 · made it / SLIPPED`); a slip costs 3 and you
  just press E again. Wandering Z4 intrusion still fires between rolls.
- **Examine cypher**: the Exam button in the cypher menu resolves in place —
  feed line + identified name updates live in the menu.
- **Glyph intuit**: one background Intellect roll, clue reveals on success.
What remains modal are CHOICES, not dice (intrusion accept/refuse, glyph
rotation, pickups) — Morrowind pauses for those too.
Casualty (flagged): the 1-XP reroll (Rules §6) lived on the tray and is gone.
XP now spends nowhere in-run; it's score + intrusion currency. If a spend is
wanted later, a Morrowind-shaped option: XP buys rest-slot refresh at rests.
Verified headless (seed 6): suite PASS · climb crossed via background rolls
(mode never left EXPLORE) · examine resolved in-menu with feed line · zero
errors. dice.js itself is untouched — it IS the background engine.

## 2026-07-03 — Enemy design pass (all four Whisperlock creatures)
The placeholder blobs are gone. Every creature now has hand-designed procedural
pixel art (drawn at half-res in code, ×2 integer upscale, auto void outline,
palette-locked) with the FULL Asset-doc §3 frame sets, plus per-creature
realtime behavior so each plays differently:
- **Laak** (5 frames, worldH 0.45 — ankle-high): moss body, rust back-speckle,
  six legs, whip tail, gold eye; open-jaw lunge; belly-up corpse. Behavior:
  **skitters** — zigzag approach (sine wobble perpendicular to its charge).
- **Broken hound** (6 frames, worldH 0.9): gaunt steel hide, hips higher than
  shoulders, reverse-kneed legs, cyan light in the seams (flickers between
  idles), underslung jaw; 50%-alpha static-white **phase** frame shows whenever
  it's inside a wall cell mid-chase. Collapsed-heap corpse with dead seams.
- **Murden** (6 frames, worldH 1.05): hunched mauve rag-cloak (ragged hem),
  raven head, long beak, gold-glow eye, feather texture. Behavior: **skirmisher**
  — new `ranged` stat throws stones from ≤8 tiles (bg defense roll; a stone
  always finds a gap for min 1 dmg), and it BACKS AWAY if you close, knifing
  (snatch pose) only when cornered. Crumpled-rags corpse, beak jutting up.
- **Abykos** (7 frames, 64×96, worldH 1.5 — it looms): a figure of horizontal
  static bands — ragged widths, jitter, signal dropouts — bright core seam,
  inner cyan static, broken-segment arms. Drain frame spreads its arms with
  gold pulled inward (timed drain now poses it + 'drain' popup); hit frame
  tears bands out; death shears the bands apart, then a fading mote column.
- **Corpses persist** (Morrowind leaves bodies): dead creatures render their
  final frame forever; death pose plays ~450ms first. Frame indices live in
  `CREATURES[].F` (incl. `atk` pose per creature) and ride each entity.
- Dev tool: `?sprites=1` renders the full labeled frame gallery.
Fixed en route: artifact_key still referenced the deleted `silhouette` helper.
Verified headless (seed 8): suite PASS · laak killed → corpse remains · murden
threw stones (`def murden (stone) — d20 3 vs 6 · HIT for 1`) from a 3-pack that
kept its distance · abykos drain tick posed + fed at +4s · zero errors.
Balance note: stones (min 1 through Armor) slightly raise murden pressure vs the
Appendix "1 after Armor" line — consistent, but watch it in human playtests.

## 2026-07-03 — Design ruling absorbed + directional sprites + calibration tutorial
Mark reviewed `06_ONBOARDING_AND_CONTROLS_v2.md` (from the design session) and
RULED: it is wrong on combat. **Morrowind clone; Cypher underneath; no dice
visible anywhere, ever** — not even the roll feed's numbers. Turn-based /
swipe-with-visible-d20 / Effort-cube-dragging are rejected. Thumbstick touch
scheme stays (tap-to-move rejected). Full response written for the design
session: **`docs/07_BUILD_STATE_HANDOFF.md`** (timestamped 2026-07-03;
establishes latest-date-wins convention).
Built this session:
- **Dice language purged from the message log**: plain Morrowind speech only
  ("you strike the murden — 5", "your swing goes wide", "you slip on the way
  down", "its purpose comes clear in your hands"). resolveTask math unchanged.
- **N/S/E/W directional sprites**: every creature gained front (facing you)
  and back (facing away) 2-frame idles; side views mirror per flank. Selection
  from `e.heading` (set by movement; enemies square up in reach; murden
  retreats FACING you). Laak/hound/murden/abykos frame strips now 9/10/10/9;
  detail pass added ground shadows. Corpse/action poses unchanged.
- **Calibration tutorial (simulation frame v1)**: contextual one-line prompts
  ("calibration: W A S D — walk / click — swing your blade / hold, release —
  a heavier cut / E — take / C — devices"), each dismissed by doing; touch
  variants; title tagline now "the lock will calibrate you as you go".
  Open design question (in 07 doc §5.2): full simulated cold-open space vs
  this diegetic calibration-in-place.
Verified headless (seed 8): suite PASS · gallery renders all 38 frames · back-
view murden + side hound confirmed in-world · combat log dice-free (regex
checked) · prompts render · zero errors.

## 2026-07-03 — Sharper retro: 3× render resolution (1152×648)
Mark's call after the engine discussion: bump internal res "double or triple".
Implemented split-resolution rendering: the world raycasts at
BUF×RENDER_SCALE (`?res=1..4`, default **3 = 1152×648**) while ALL UI keeps
drawing in the 384×216 logical space via a ctx.scale transform (no UI layout
changes). Display now fills the screen with fractional upscale at res≥2
(integer-only kept for ?res=1 purity). Input mapping adjusted (client px →
logical space through scale×RENDER_SCALE). Raycaster's in-world text/bars
(popups, health bars) scale with RENDER_SCALE.
Benchmarked headless (software renderer, 1920×1080): res1/2/3 = 60fps,
res4 = 42fps → default 3. Suite PASS, no errors.
Note: at 3× the 64×64 wall texel grain becomes the visible quality floor —
higher-res or hand-made textures are the next visual lever (or the Babylon
migration, which Mark has approved in principle pending final Q&A).

## 2026-07-03 — Babylon lab: the comparison room (Mark's sample request)
Built `lab/babylon-room.html` — the REAL Z1 Collapsed Entry (same map data,
same procedural textures, same creature sprites via SpriteManager billboards)
rebuilt in Babylon.js 7.54.3, vendored as a single file (`vendor/babylon.js`,
6.8MB, npm-registry tarball; no npm at runtime, no build step — Fable-native
holds). The demo shows everything the raycaster cannot do:
- textured FLOOR and CEILING · a double-height chamber · look UP and DOWN
- a collapsed-ceiling light shaft (SpotLight) with drifting dust particles
- a guttering gold brazier (flickering PointLight) · a cyan conduit strip
  whose light bleeds onto the wall/floor (slow pulse)
- the broken hound pacing with a cyan light ATTACHED (its seams light the
  room) · murden watching from half-dark · the cypher glowing where it lies
- a floor crack with machine-glow rising from below · EXP2 fog · retro
  hardware-scaling (P cycles pixel size) · **T toggles LIT vs FLAT** —
  flat mode approximates the raycaster's uniform lighting for an in-place
  A/B comparison.
Verified headless (SwiftShader WebGL): loads clean, no errors; screenshots
captured of lit room, look-up shaft, flat mode, plus the same vantage in the
current engine for the side-by-side. Camera collision via Babylon ellipsoid.
Status: SAMPLE ONLY — no game code touched; migration decision stays Mark's.

## 2026-07-03 — Babylon lab v2: GAMEPLAY (the real combat engine in the new renderer)
Mark asked for combat/swinging/collision in the Babylon sample. Delivered the
strongest possible proof: `lab/babylon-room.html` now imports and runs the
ACTUAL game modules — `createGameState`, `spawnExploreEntities`, `updateCombat`,
`playerSwing`, `tryRest`, `toggleAggression`, `interact`, the real dice and
creatures. Babylon renders; the shipping simulation simulates. Zero game code
was modified. The Babylon camera writes player x/y/angle into the real
GameState each frame (map↔world mapping), and creature entities drive
SpriteManager billboards (directional cellIndex + invertU mirroring the
raycaster's pickFrame logic, hit-tint, corpses persist).
In the lab you can: swing (click; hold = heavy = real Effort from Might),
take pickups (E), rest (R), toggle Aggression (F) — and the laak, hound
(chasing with its attached cyan light), and stone-throwing murden all behave
exactly as in the game because it IS the game. Damage popups project
world→screen as DOM elements; feed/stats/hurt-flash are DOM overlays; hurt
shake is a camera roll. 3D sword viewmodel (blade/guard/grip meshes parented
to the camera) with idle sway, charge pull-back, and an arc that cuts through
space; scaled to viewmodel proportions after two iterations.
Verified headless (SwiftShader): walk-in → hound aggro → chase → real defense
rolls ("you evade the broken hound") → swings → "you strike the broken hound
— 6" → kill, corpse remains; zero errors. Canvas got tabindex for focus.
Meaning for the migration estimate: the renderer swap is REAL — the whole
simulation ran unmodified under Babylon on the first try. Migration cost is
confirmed to be renderer+UI plumbing only.

## 2026-07-03 — THE FULL DUNGEON IN BABYLON (Mark: "it's amazing, fully create it")
Shipped `babylon.html` — the complete Whisperlock, playable start to finish in
true 3D. Architecture (the migration's whole thesis, now proven at full scale):
**the game still simulates itself** — movement, circle-slide collision, doors,
combat, intrusions, XP, all the same `src/game/` modules, byte-identical —
and Babylon is a pure body that mirrors GameState every frame. The camera has
no physics of its own; it's parented to the player the game already moves.
New files: `src/babylon/scene3d.js` (the body: geometry/lights/sprites/sword),
`src/babylon/main3d.js` (fork of main.js: same mode machine + UI, renderer
swapped), `babylon.html` (3D canvas + transparent UI canvas stacked).
What the 3D body includes:
- All 24×24 cells: per-zone wall textures, TEXTURED floors and ceilings,
  per-zone ceiling heights (Z1 collapsed room 5.2m w/ ceiling hole + light
  shaft + dust; Z5 core 6m; Z4 chasm cavern 5.6m; gallery 3.8m; corridors 2.6m)
- The chasm is a REAL PIT: shaft walls plunge to a glowing coolant bed,
  updraft motes rise; the Gravity Nullifier shows a faint shimmer walkway
- Doors physically slide open (incl. the glyph-locked L, which opens on
  solve); secret walls + phase vault vanish when found; glyph pillars are
  3D pillars that retexture with their rotation (gold when solved)
- Curated light set: braziers (flickering gold), warren gloom (mauve), gallery
  glow, chasm updraft (cyan), Z5 core heart, exit glow — plus creature-borne
  lights (hound seams; the abykos glows brighter mid-drain)
- Directional billboard creatures (same sprites/frames as classic), corpses,
  pickups; damage popups + enemy health bars projected onto the UI canvas
- The 3D sword viewmodel (idle sway / charge / arc), pitch look (up & down),
  camera-roll hurt shake, P cycles pixel chunkiness
- ENTIRE 2D UI reused: HUD, modals, cypher menu, glyph puzzle, sheet, report,
  whispers, calibration prompts, feed — drawn on a transparent overlay canvas
  in the same 384×216 logical space (input mapping preserved)
Perf: static geometry merged into one draw call per material. Headless
SwiftShader (CPU-emulated GPU) runs ~11fps — real GPUs will be far above;
fps shows top-right, Mark to report real-hardware numbers.
Also fixed: whisper box no longer wraps mid-word (both builds).
Verified headless end-to-end: title→delve, corridor walk (real collision),
laak killed via real combat, scripted Z3 intrusion → glyph puzzle UI over the
3D scene, chasm cavern + boss room (glowing abykos, boss whisper) — 0 errors.
Classic raycaster untouched at index.html; ?test=1 suite still green there.
Known follow-ups: mobile-touch pass for 3D build; feel-tuning pass on look
sensitivity/fog density from Mark's play; texture upgrade under real light;
main.js/main3d.js share a lot of forked logic — dedup later.

## 2026-07-03 — Polish pass: UI look, sword combo, reach, PHONE support
Mark's playtest notes (he plays on a phone!) addressed:
- **"Can't look up" solved**: he was on touch, and look-drag only fed yaw.
  Touch vertical drag now feeds pitch (input.js) — phones look up/down in 3D.
- **Touch heavy attack**: ATK button is now press-AND-HOLD (≥350ms = heavy,
  same contract as the mouse); touch-action:none on both builds stops
  browser zoom/scroll fighting the game.
- **Sword**: bigger (scale .62, closer to center), and swings are now CUTS —
  alternating combo driven by new `player.swingCombo` (set in playerSwing,
  game-side): odd = overhead chop raised high → cleaves down through center;
  even = high-right → low-left cross slash. Both LUNGE forward (+0.5m z) so
  the extended reach reads visually. Charge pose = wound up overhead.
  Classic 2D viewmodel alternates its arc by the same combo counter.
- **Reach**: REACH 1.6 → 2.2 tiles, ARC π/3 → π/2.8 — hits land from farther,
  matching a broadsword's length (Mark: "feel like I'm hitting a little
  farther from me").
- **UI beautification** (shared widgets.js + hud.js → both builds):
  panels get drop shadow, vertical gradient, void edge + gold pinstripe,
  gold corner notches, dark title bar with cyanDeep divider; buttons get
  raised gradient body, top sheen, accent tick, ↵ glyph for Enter; bars get
  fill sheen, lower-half depth, quarter ticks; HUD strip is a gradient plate
  with gold+cyan hairlines, double-framed notched portrait, recessed cypher
  sockets that glow gold when filled.
Verified headless: classic ?test=1 green · 3D zero errors · phone context:
stick walk (22.5→20.4), look-drag pitch −0.18 (LOOKING UP), hold-ATK produced
a heavy swing. Screenshots: overhead chop mid-cut w/ damage popup; new menus.

## 2026-07-03 — Minimap · map-as-journal tutorial · rest/train XP · UI finesse
Mark's four notes ("minimap is essential / a tutorial on what to do / UI
needs finessing / the XP pop-ups aren't great — marry Cypher+Numenera into
a Morrowind RPG") addressed, both builds:
- **Fog-of-war minimap** (new src/ui/minimap.js + world.updateSeen +
  state.seen): corner map top-right in explore shows only cells you've had
  line of sight to — walls steel, doors gold, chasm cyan, exit glowing;
  pickups you've seen glint; cyan arrow = you. M (or the touch Map button)
  opens the full map overlay.
- **Map overlay doubles as the journal/tutorial**: seen-map + GOAL (staged
  objective: find gallery → warrens clue → set glyphs → face the core →
  escape) + THE RULES OF THIS WORLD (cypher limit, discovery XP, rest/train)
  + HANDS (controls, touch-aware). Objective changes also ping the message
  feed ("goal — …") so the player is never lost.
- **Numenera-into-Morrowind leveling**: R now opens a rest menu —
  Rest (recovery, 3/day) or Train (4 XP), Morrowind's "sleep to level" over
  Numenera's actual tier math: each 4-XP lesson buys one of the four tier
  benefits — Pool +4 (pick stat), Edge +1 (pick stat), Effort (heavy swings
  can now spend 2 levels), or sword training (eases every cut). Delve Report
  shows "Tier 2 progress: n/4 benefits bought" (player.applyBenefit).
- **Diegetic intrusions**: the modal is now "the world turns against you" /
  Endure it (+2 XP) / Defy it (−1 XP) — same math, no GM jargon.
- **UI finesse**: message feed moved to bottom-left (Morrowind's spot) and
  hidden while menus are open; whisper box hides under the map; Escape backs
  out of any choice modal; choice-button labels trimmed to fit.
Verified headless (script: scratchpad/verify_minimap.mjs): classic ?test=1
green · fog populates on walk in both builds · M opens/closes map · R→Train→
Pool→Might deducts 4 XP, Might max 14→18, benefits 0→1, feed shows "your
might deepens (+4)" · zero page errors. Screenshots reviewed.
Next: Mark to playtest on phone (fps number top-right still wanted); then
creature reskin pass (Numenera IP names) per docs/07 open items.

## 2026-07-04 — Phone UI fixes from Mark's screenshots (30fps, overlaps, portrait)
Mark sent phone screenshots: touch buttons drawn ON TOP of the minimap,
message feed running through the virtual stick, portrait mode a mess, 30fps.
- Minimap moves to top-LEFT when touch is active (right edge belongs to the
  thumb buttons); its little "M" hint only shows on desktop.
- Message feed on touch rides higher (bottom at BUF_H−112) and caps at 4
  lines so it clears both the stick and the minimap.
- "drag to look" hint moved up out of the calibration-prompt line.
- Portrait: dim overlay + "turn your phone sideways — the whisperlock is
  wide" (both builds, touch only; game keeps running underneath).
- Adaptive retro (3D, touch only): every 2s, fps<45 → hardware scaling +0.5
  (coarser pixels, up to 4), fps>57 → back down (never finer than the
  default 2). Should lift his 30fps toward 60 by growing the pixels —
  which fits the retro look anyway. Desktop P-cycle untouched.
Verified headless w/ touch contexts (verify_touchui.mjs): landscape layout
clean in both builds, portrait hint renders, autoPerf ratcheted 2→3 under
SwiftShader, zero page errors.
Next: Mark re-tests on phone — want new fps number + whether stick/buttons
feel right; then creature reskin pass (docs/07).

## 2026-07-04 — Touch controls rebuilt around Mark's mobile-FPS reference shot
Mark: "optimize the UI so it's cleaner and nicer... especially touch, it
feels janky" + a reference screenshot (mobile FPS: icon buttons, badges,
decorated stick, corners-only chrome). Root causes of the jank found & fixed:
- **Stick visual was fixed in the corner while the input anchored to the
  thumb** — now the drawn base FLOATS to wherever the thumb lands
  (input.joyBase), with a ghost ring at the rest spot. What you see is what
  you steer.
- **Feel was measured in raw screen px** (deflection JOY_PX=46 client px,
  look = raw client deltas) so sensitivity varied per phone — both are now
  normalized to LOGICAL px (JOY_LOGICAL 30, LOOK_GAIN 2.2) + a radial 0.15
  dead zone. Same feel on every device, no drift.
- **Five identical text rectangles down the right edge** → two clusters:
  round ICON buttons at the right thumb (sword = attack w/ gold charge ring
  that sweeps to the heavy threshold; hand = take/use, burns gold when a
  pickup/door/pillar is in reach) and three quiet icon tabs top-right
  (map / person / device, device tab wears a cypher-count badge). Hit rects
  stay bigger than the drawn shapes. Pressed states brighten. "drag to
  look" hint removed (calibration prompts already teach it).
- Calibration prompts + map-overlay HANDS text updated to name the icons.
Verified headless (verify_touch2.mjs, synthetic TouchEvents): floating
stick moves player, normalized look drag turns view, ATK hold ≥350ms =
heavy swing, Map tab opens/Close closes, E button interacts, cypher badge —
plus the desktop suite (?test=1 green, rest/train flow) — zero errors.
Next: Mark's phone feel check (stick gain LOOK_GAIN 2.2 tunable, one
constant in input.js); then creature reskin pass (docs/07).

## 2026-07-04 — HUD minimalized (the bottom plate is gone)
Mark: "the bottom bar takes up so much space... make it more minimal, like
the screenshot." The full-width 40px Arena plate is deleted from both builds.
New HUD (ui/hud.js rewrite, corners only):
- Top-left: three slim 64×5 pool bars (blood/cyan/gold). A pool's numbers
  appear ONLY while it's below max. Under them: tiny cypher-socket diamonds
  (gold when filled, rust past the limit) + a small XP counter.
- Damage-track word pulses under the stack only when not hale; over-limit
  warning only when over.
- Portrait, shins, compass, HALE label: cut from the HUD — all still in the
  Sheet (Tab / You tab). Minimap arrow covers facing.
- Event ticker: one dim line at the very bottom (centered on touch).
- Touch layout reshuffled for the freed space: minimap now top-right UNDER
  the icon tabs (size 54), thumb clusters dropped into the true corners
  (stick + sword cy BUF_H−48, hand cy BUF_H−94), feed bottoms adjusted
  (desktop BUF_H−16, touch BUF_H−92). Classic viewmodel sword now reaches
  the frame bottom — more Morrowind.
Verified headless: full touch suite + desktop suite + ?test=1 all green,
zero errors, screenshots reviewed in both builds.
Next: Mark's phone pass (feel + fps); creature reskin (docs/07).

## 2026-07-04 — Two-finger camera fix · doors make sense · popup tutorial
Mark reported camera "twist and turn" with two fingers, doors in illogical
places, and asked for explicit first-time tutorials ("room to room, popups
that teach").
- **Camera twist FIXED**: two touches on the look half both fed yaw/pitch and
  fought each other. Input now allows exactly ONE stick finger + ONE look
  finger; extra touches on the same half are inert. iOS pinch gestures
  preventDefault'ed too.
- **Door audit (map geometry)**: 4 of 5 doors were floating in open floor —
  walkaroundable, gating nothing. Now every door seals a real flanked
  doorway: (2,18) Z1→warrens, (4,13) nest→gallery (west flank walled),
  (12,9) gallery→chasm approach (N/S flanks walled), (20,5) unchanged; the
  pointless mid-gallery door (6,6) deleted. Warrens no longer leak into the
  gallery over rows 12/13 (x1–3 walled). Static door-logic audit + flood
  connectivity both pass; placements untouched.
- **Tutorial popups (new src/game/tutorial.js)**: 8 one-shot "calibration
  record" modals fire the first time the player meets each thing — welcome/
  goal, first fight, first pickup (discovery-XP philosophy), first door,
  first cypher, the glyph gallery, the chasm, and 4-XP training. Touch and
  desktop get different control hints. Fires only when explore is idle;
  scripted intrusions still take priority. Passive cyan prompts unchanged.
- **Touch can rest now** (was desktop-only R!): Sheet gains a gold
  "Rest & Train" button → rest/train menu. Hotkey labels render "R" not
  "KeyR".
Verified headless (verify_logic.mjs + both regression suites re-run):
16/16 logic checks + full touch suite + desktop suite green, zero errors.
Door-audit rule: every D cell must have solid flanks on exactly one axis.
Old test scripts pre-seed tutSeen to stay isolated from the new popups.
Next: Mark's phone pass; creature reskin (docs/07).

## 2026-07-04 — The bonded shard (story tutorials) + Babylon toolbox
Mark: frame tutorials as an AI cypher bonded to the player; simple amnesia
story (the binding took their memories, the shard doesn't know them either);
and research what Babylon tools/premade assets we can use.
- **Story frame (tutorial.js rewrite)**: all 8 popups are now the bonded
  shard speaking first-person — "I am a cypher... when you touched me, I
  bound to you, and the binding took your memories. I am sorry." It teaches
  combat/discovery/doors/cyphers/glyphs/chasm/training in its own voice
  (calls XP "noticing", training "braiding"). Titles: '◇ the shard — ...'.
  Passive cyan prompts now prefix '◇' (its short whispers) instead of
  'calibration:'. Title screen: "you woke with no name — the shard on your
  spine remembers this place". drawModal height is now adaptive
  (widgets.wrapCount) so the shard can talk; benefits intrusions too.
- **Babylon toolbox (docs/09_BABYLON_TOOLBOX.md)**: full brief for all
  sessions. Key finding: babylonjs-materials / procedural-textures /
  loaders / post-process ship per-feature UMD minis on npm — vendorable
  one file at a time with zero build step. Vendored now: lavaMaterial,
  fireMaterial, fireProceduralTexture, perlinNoise, glTF2 loader (224KB).
- **Applied today**: chasm coolant bed is ALIVE — LavaMaterial fed by a
  cyan-recolored FireProceduralTexture (falls back to flat emissive if the
  vendor scripts are absent). Core-only mood pass: GlowLayer (emissives
  bloom) + DefaultRenderingPipeline vignette + animated grain, FXAA off.
  autoPerf disables glow/vignette/grain past scaling level 3 (weak phones).
Verified headless: logic suite + touch suite green, LavaMaterial loads,
zero page errors. SwiftShader too dark/slow to judge the lava visually —
Mark's phone is the real test.
Next: Mark judges lava/glow/grain on device; fireMaterial torches, god
rays, water room queued in docs/09 §recommendations.
