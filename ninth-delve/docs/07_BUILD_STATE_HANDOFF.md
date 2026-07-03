# 07 — BUILD STATE & DESIGN HANDOFF (build → design session)
**Timestamped: 2026-07-03** · Convention going forward: every design/build doc
carries an ISO date in its header; **latest date wins** on any conflict.
This doc is written BY the build session FOR the design ("mother") session.
It is the current source of truth, per Mark, and supersedes anything older —
including `06_ONBOARDING_AND_CONTROLS_v2.md` where they conflict.

---

## 1. THE RULING DECISION (Mark, 2026-07-03, explicit)
**Ninth Delve is a MORROWIND CLONE built on the Cypher System, set in a
Numenera world.** The tabletop presentation is dead. Specifically:

- **Real-time combat.** No turns, no encounter mode. Enemies aggro, chase,
  and strike on their own clocks. The player swings a first-person blade
  (click / tap; **hold-and-release = heavy swing**, which spends Effort from
  the Might pool under the hood).
- **No dice anywhere on screen. Ever.** No d20 on the swing, no die-on-the-
  blade, no roll feed with numbers, no tray, no "target 9". 06-v2's POC
  criterion #1 ("swipe-attack-with-visible-dice") is **rejected** — Mark
  confirmed the doc misunderstood him. All `resolveTask()` math runs silently;
  the player sees plain-language outcomes ("you strike the murden — 5",
  "your swing goes wide"), floating damage numbers, hit flashes, health bars.
  Exactly Morrowind's contract: real-time swings, dice invisible underneath.
- **Cypher System remains the full skeleton**: difficulty×3 targets, Effort
  with Edge discounts, pools as HP, damage track, armor, specials (17–20 map
  to bonus damage / knockback / stun), GM intrusions on natural 1 (or 1–2
  over cypher limit), discovery-only XP. Untouched and verified by unit tables.
- **Turn-based is not coming back.** Do not design for declared actions,
  parry windows as rolls, Effort-cube dragging, or any "see the dice" beat.

## 2. WHAT 06-v2 GOT RIGHT (adopted or already true)
- Free-roam locomotion, circle-slide collision — was already built.
- Fog as mood anchor — agreed; see §5 open questions on draw-distance.
- Progressive one-verb-at-a-time onboarding, prompts dismissed by doing —
  **adopted and built** (see §4), reframed per Mark as a **calibration/
  simulation** conceit: the Whisperlock's dead mind "calibrates" the intruder.
- Tap targets, fallback buttons, no-fail-from-input — kept as principles.

## 3. WHAT 06-v2 IS OVERRULED ON (per Mark, 2026-07-03)
| 06-v2 said | Ruling |
|---|---|
| Turn-based, "see the dice" | Real-time, dice fully hidden |
| Swipe-to-attack, d20 rendered on the arc | Button/click swing; hold = heavy. No die render |
| Swipe-to-parry defense rolls | Defense rolls are silent & automatic when a blow lands |
| Drag Might cubes to spend Effort | Hold-to-charge IS Effort; no cube UI |
| Tap-and-hold-to-move touch scheme | **Virtual thumbstick** (left) + look-drag (right) + ATK/E/Cy/Sheet buttons — Mark prefers it |
| POC = trim to Z1 + one laak | Moot: the **full slice is built and playable** |

## 4. CURRENT BUILD STATE (all pushed, branch `claude/repo-placement-m73aup`)
- **Full Whisperlock slice**: 5 zones, connectivity-tested map, pickups,
  sliding doors, secrets (bump + phase vault), glyph puzzle (3 clue paths),
  chasm (cypher or climb), scripted + table intrusions, key → exit,
  Delve Report, death report. `?test=1` runs green (connectivity, asset,
  dice-math, roster tables).
- **Widescreen 384×216** (16:9) raycaster, outlined text legible everywhere,
  per-zone wall textures, distance fog, procedural WebAudio (cues + zone
  drones), 9 grieving-archivist whispers, screen shake/hit flash.
- **Real-time combat** per §1, plus: corpses persist; damage popups; enemy
  health bars; first-person sword viewmodel (idle sway / charge / cut).
- **All four creatures designed** (procedural pixel art, palette-locked,
  full Asset-doc frame sets **plus new N/S/E/W directional idles** — front/
  back/mirrored-side chosen from creature heading; more detail + ground
  shadows this pass):
  - *Laak* — ankle-high six-legged lizard; zigzag skitter.
  - *Broken hound* — wrong-jointed, cyan-seamed; chases THROUGH its den walls
    (static-white phase frame mid-wall); lunge ignores Armor.
  - *Murden* — raven-headed skirmisher; throws stones from range, backs away
    facing you, knives when cornered; snatches a cypher on your fumble.
  - *Abykos* — 64×96 figure of static bands; timed cypher Drain (gold light
    pulled inward), blinks away if hugged, Might-defense touch.
- **Onboarding v1 built** (the calibration frame): contextual one-line
  prompts — walk, look, swing, heavy cut, take, cyphers — each dismissed by
  doing it; touch and desktop variants. Title tagline: "the lock will
  calibrate you as you go."
- Controls: **PC** WASD + mouse-look, click swing / hold heavy, E interact,
  C cyphers, Tab sheet, R rest, F Aggression stance. **Touch** left stick,
  right drag look, ATK/E/Cy/Sheet buttons. Menus pause the world.

## 5. OPEN QUESTIONS / REQUESTS BACK TO THE DESIGN SESSION
1. **Lore primer wanted.** Build session needs a deeper Numenera-flavored
   bible to keep building: naming conventions for reskinned creatures (the
   current four are Numenera IP — fine private, must reskin for public),
   what the surface above the Whisperlock is, who the client is, what other
   dungeons/regions exist. Short, canonical, timestamped.
2. **Simulation framing** — Mark wants the tutorial framed as a simulation.
   v1 ships as "calibration" prompts in the real dungeon. Question: should
   there be an actual separate simulated cold-open space (a dreamed copy of
   a corridor that dissolves), or is diegetic calibration-in-place enough?
3. **Fog vs draw distance**: fog currently reads as mood only; the renderer
   easily hits 60fps, so we have NOT shortened draw distance. Agreed plan:
   revisit fog-as-budget when/if we render larger spaces or a surface.
4. **XP spend**: the 1-XP reroll died with the dice UI. XP is currently
   score + intrusion currency only. Proposal wanted (Morrowind-shaped, no
   dice UI) — e.g., XP improves rest quality, or buys Tier benefits at rests.
5. Timestamp convention (header of this doc) — please adopt in all future docs.

## 6. WHAT THE BUILD SESSION DOES NEXT (unless overruled)
Testing pass by Mark on the full slice → tune swing pacing / enemy speeds /
drain cadence from real play → then the "beautiful look" push (textured
floors/ceilings, lighting, heavier per-zone haze) toward the Morrowind mood.
