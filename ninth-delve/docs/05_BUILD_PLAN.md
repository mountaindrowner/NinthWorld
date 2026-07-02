# 05 — BUILD PLAN (Implementation Contract)
Rules of the contract: one milestone per session where possible · do not start
M(n+1) until M(n) acceptance boxes are checked in a commit · no refactors outside
the current milestone's scope · every session ends by updating `HANDOVER.md`.

## M0 — Scaffold & fallback art (½ session)
Tasks: repo layout per Tech doc §2 · `index.html` + canvas + boot loop ·
`texgen.js` procedural fallbacks for every Asset-doc entry · asset loader with
fallback registry · transcribe map ASCII → `map_whisperlock.js` grid + placement
table → constants · connectivity flood-fill test (P reaches X through door/key
graph) — fix corridors if it fails, never move placements.
**Accept:** ☑ page loads, renders test pattern at 320×200 upscaled ☑ all asset
keys resolve (fallback or file) ☑ connectivity test passes and is committed.

## M1 — Walking sim (1 session)
Tasks: DDA wall raycast + fishbowl fix + side shading + distance fog · WASD +
pointer-lock yaw + Q/E fallback · circle-slide collision · floor/ceiling gradient
fills · door cells render closed (no logic yet) · FPS counter.
**Accept:** ☑ walk the full Whisperlock at ≥ 55 fps mid-laptop ☑ no wall clipping
at corners ☑ textures per-zone correct vs placement table.

## M2 — World interaction (1 session)
Tasks: billboard sprite pass with z-buffer clip · pickups (shins/cyphers/oddities)
with E-interact + pickup modal (unidentified cypher text) · sliding doors ·
glyph-locked door (inert) · secret bump-search on `wall_scuffed` cells · inventory
in `GameState` · HUD v1: shins, cypher slots, compass.
**Accept:** ☑ collect C1/O1, open every D door, L stays locked ☑ secret at ID-5
found via interact ☑ sprites clip correctly behind walls.

## M3 — The dice (1 session) ← the heart
Tasks: `dice.js` pure `resolveTask()` with audit trail (base, chips, effort,
target, natural, outcome, special) · seedable RNG · `player.js` pools/Edge/Effort
costs (3/5/7 −Edge; Speed armor surcharge +1/level) · damage track states ·
recovery rolls with daily sequence · dice-tray UI: chips, animated d20, result
banner, Effort spend buttons with live cost preview · character sheet (Tab).
**Accept:** □ unit table: Effort 1/2 on Might = 2/4 cost for Kave (Edge 1); on
Speed = 3/6 with armor **[math per Rules §2]** □ tray shows every chip on a
skill+asset+Effort roll □ pool at 0 drops damage track and overflows correctly.

## M4 — Encounter engine vs laak (1–1.5 sessions)
Tasks: encounter trigger (LOS + range) · state freeze + backdrop sway · initiative
Speed roll · range-band snap + Move action · action menu: Attack / Fleet of Foot /
Aggression toggle / Catch Breath / Defend / Flee · enemy phase = player defense
rolls with shield/stance chips · damage/Armor application both ways · special
rolls 17/18/19/20 with choice modal · death/victory → EXPLORE · nat 1 → stub
intrusion ("the GM smiles" placeholder).
**Accept:** □ full laak fight start-to-finish, every number visible in tray
□ Aggression eases attacks AND hinders defenses simultaneously □ Catch Breath
consumes daily rest slot 1 □ Flee works and re-aggro works.

## M5 — Full roster & boss (1.5 sessions)
Tasks: murden (static hinder aura, snatch-and-flee intrusion, nest AI, drops
stolen goods) · broken hound (den phasing in explore, phase-behind intrusion,
**phase-lunge ignores Armor** — see Appendix) · multi-enemy encounters · Abykos:
physical resist 3 / energy 0, per-round Drain of carried cypher levels, Might-
defense touch, repositioning, telegraph lines · cypher USE effects for C1–C6 ·
Examine action (hindered Intellect, reveals identity) · over-limit rule (intrusion
on nat 1–2).
**Accept:** □ murden steals a cypher and it's recoverable □ hound hits through
Armor via phase-lunge □ boss destroys a hoarded cypher by round 3 in a no-use
test run □ all six cyphers function per Dungeon §6.

## M6 — Systems of consequence (1 session)
Tasks: intrusion engine (global/zone/creature tables + scripted five from Dungeon
§8, accept +2 XP / refuse −1 modal) · XP ledger + reroll-any-roll button (1 XP) on
the tray · glyph puzzle (pillar rotation, O2/mural/Intellect clue paths, wrong-
attempt intrusion) · chasm traversal (C3 path + climb path with rolls) · phase
vault via C5/den wall · discovery XP awards on zone entry/secrets/artifact · Key
pickup → exit unlock.
**Accept:** □ both chasm routes completable □ puzzle solvable via all 3 clue paths
□ refuse at 0 XP is disabled □ reroll consumes 1 XP and replays the same chips.

## M7 — Juice, audio, balance, report (1 session)
Tasks: WebAudio cues per Asset §5 · whisper text system + the 9 script hooks
(write them now, grieving-archivist voice, ≤2 sentences) · hit flashes, screen
shake (2px, 100ms), sprite lunge tweens · Delve Report screen per GDD §6 ·
balancing pass vs Appendix targets · title screen · 3 full playthroughs logged.
**Accept:** □ 20–40 min completion □ boss beatable with and without cyphers
(without = visibly grindy) □ death still produces a Delve Report □ no console
errors across a full run.

## Appendix — Balance targets (check at M7)
| Check | Target |
|---|---|
| Kave hit% vs murden (no Effort) | 60%; with Aggression 75% |
| TTK: laak / hound / murden / boss | ≤1 rd / 2 / 2–3 / 4–7 rds |
| Hound damage through Armor | 3 (phase-lunge ignores Armor — REQUIRED, else 3−3=0 and hounds tickle) |
| Incoming per failed defense (murden/boss) | 1 / 2 after Armor 3 |
| Full-delve attrition, cautious play | enter boss Hale-to-Impaired, ≥1 rest slot left |
| Daily recovery budget | 4 rolls × (1d6+2) ≈ 22 pts vs 34 pool total |
| Discovery XP available / expected earned | ~16 / 8–11 (+ intrusion income) |

## Stretch (post-slice, do not build now)
Touch controls · textured floors · save via localStorage (GH Pages build only) ·
Nano/Jack pregens · seeded daily-delve mode · Three.js renderer swap.
