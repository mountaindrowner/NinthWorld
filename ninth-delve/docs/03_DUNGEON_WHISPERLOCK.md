# 03 — DUNGEON: THE WHISPERLOCK

## 1. Premise (original flavor)
A buried prior-world facility near the Beyond's edge. Its machine mind is dead,
but a fragment of its voice still circulates through the halls — a whisper that
narrates, mourns, and occasionally lies. Murden squatters nest in the west
warrens; something worse has been drinking the vault's stored energies at the
core. The client wants what the whisper guards: **the Whisperlock Key**.
The whisper is the game's narrator/GM voice: environmental text boxes only, ≤ 2
sentences, sensory and unexplaining (pillar #3).

## 2. Zone flow
```
Z1 Collapsed Entry → Z2 Murden Warrens → Z3 Whisper Gallery (glyph puzzle, locked door)
                                   └──→ Z4 Coolant Chasm (traversal choice) ─┐
Z3 locked door ──(glyph solved)──→ Z5 Lock Core (boss, artifact, exit) ←─────┘
```
Critical path: Z1→Z3→(Z2 for clue OR Intellect roll)→solve glyphs→Z5.
Z4 is the alternate route into Z5's flank + best loot. Both entrances to Z5 work.

## 3. Map — 24×24 grid
**The placement table (§3.1) is the source of truth; the ASCII is visualization.**
Legend: `#` wall · `.` floor · `D` door · `L` glyph-locked door · `S` secret/phase
wall · `~` chasm · `P` start · `X` exit · `G` glyph pillar · `B` boss · digits =
placement IDs.

```
########################
#..1....#....B..A..X...#   1  Z5 approach
#.####.##..####..####..#
#.#  #.#..........#  #.#
#.#  #.L####DD####.#  #.#
#.#### .#Z5 core #.####.#
#......G.........#....~.#
#.####.G.####.##.#.##.~.#
#.#2..#G.#..#..#...##.~.#
#.#..#.#.#..#..#.####.~.#
#.####.#.####..#.#4...~.#
#......#.......#.#..#.~.#
#.#####.###D####.#..#.~.#
#.#3.......#.....#..#...#
#.#..####..#.###.####.#.#
#.####..#..#.#.#......#.#
#..S....D..#.#.#######.#.#
#.####..#..#.#.........#.#
#.#5.#..#..#.#########.#.#
#.#..D..#..#...........#.#
#.######.#############.#.#
#........#.....6.......#.#
#.P......D.............#.#
########################
```
(Claude Code: transcribe to `map_whisperlock.js`, then run the connectivity test;
adjust corridors as needed — geometry may flex, placements may not.)

### 3.1 Placement table (authoritative)
| ID | What | Zone | Notes |
|---|---|---|---|
| P | Player start, facing N | Z1 | Whisper line #1 plays |
| 6 | Laak ×1 + cypher **C1** + shins ×2 | Z1 | Tutorial fight, first pickup |
| 5 | Secret room (S wall W of it) | Z1/Z2 border | shins ×5 + oddity **O1**; found by bump-search (interact on scuffed wall texture) |
| 3 | Murden nest: murden ×2, laak ×1 | Z2 | Hoard: shins ×6, cypher **C2**, **clue mural** (glyph order) |
| 2 | Murden scout ×1 | Z2 | Patrols; may flee to nest and alert it |
| G×3 | Glyph pillars | Z3 | Puzzle §5 |
| L | Glyph-locked door | Z3→Z5 | Opens on puzzle solve |
| S (row16) | Phase-only vault wall | Z3 west | **C5 + C6** inside — over-limit temptation; reachable ONLY via C3 phase cypher |
| 4 | Broken hound den: hound ×2, cypher **C4** | Z4 landing | Hounds phase through den walls to ambush Z3 east corridor |
| ~ | Coolant Chasm (6 cells) | Z4 | Cross via **C3** (gravity) instantly, or climb down/up: 2 Might climb tasks diff 4 (trained: 3) + 1 wandering-intrusion roll |
| 1 | Shin cache ×4, oddity **O2** | Z5 approach | O2 = humming metal card: plays the 3-tone glyph sequence |
| B | **Abykos** (boss) | Z5 core | §7 |
| A | **Whisperlock Key** artifact | Z5 | +3 XP, unlocks X |
| D | Doors (5) | — | Standard sliders |
| X | Exit | Z5 | Needs the Key → Delve Report |

## 4. Creature roster (levels verified vs Discovery's Creatures-by-Level index)
Stats follow the p.221–223 contract: target = level×3; health defaults level×3;
damage defaults to level (tuned below). **Tune specials to cited pages.**
| Creature | Lv | HP | Dmg | Armor | Special | Intrusions (on nat 1 / scripted) |
|---|---|---|---|---|---|---|
| **Laak** (index p.222) | 1 | 3 | 2 | 0 | Skitters: Speed def vs it hindered if 2+ laaks | Latches on: 1 ongoing dmg until Might task diff 2 |
| **Broken hound** (p.226) | 2 | 6 | 3 | 0 | **Phases through walls** (ignores S/walls marked in den) | Phases behind you: your next defense hindered |
| **Murden** (p.243) | 3 | 9 | 4 | 1 | **Telepathic static**: your Intellect tasks hindered while one is within Short | **Snatches a random cypher and flees** (recover it from its body/nest) |
| **Abykos** (p.224, boss) | 4 | 15 | 5 | 3 vs physical, 0 vs cypher/energy | See §7 | Surge: drains +1 extra cypher level this round |

## 5. Glyph puzzle (Whisper Gallery)
Three pillars each cycle 4 glyphs (interact to rotate). Correct triple opens **L**.
Clue sources (any one suffices): O2 humming card (audio+text hint) · Z2 nest mural ·
**Intellect task diff 4** at the pillars (hindered by Kave's numenera inability ⇒
effective 5, target 15) to intuit it. Each wrong full attempt = 1 roll on Z3
intrusion table (worst result: hound ambush). No lockout.

## 6. Loot registry
Cyphers spawn **unidentified** (sensory names). Levels 1d6+X rolled at boot.
| ID | Unidentified as… | True name (level) | Effect |
|---|---|---|---|
| C1 | a cold ampoule that squirms | **Rejuvenator** (1d6+2) — book default, p.286 | Immediate free recovery roll at +2; doesn't consume a daily rest slot **[tune to p.286]** |
| C2 | a warm glass bead, gold-threaded | **Detonation** (1d6+2) | Thrown, Short: level+4 dmg to all in target's Immediate; ignores 1 Armor |
| C3 | a buckle that falls *slowly* | **Gravity Nullifier** (1d6+3) | 1 min weightless: cross the chasm, negate falls |
| C4 | a stone knuckle, magnet-cold | **Density Nodule** (1d6+2) — book default, p.277 | Affix to weapon: **+2 damage rest of delve** **[tune to p.277]** |
| C5 | a lens showing the room *empty* | **Phase Disruptor** (1d6+3) | Walk through one wall cell (opens the S vault… which is where it's hidden — the OTHER phase route: the hounds' den S wall also yields entry; whisper hints this) |
| C6 | a tuning fork, already ringing | **Stim Burst** (1d6+1) | Ease all your actions for 3 rounds |
| O1 | — | Blob of self-reshaping clay (book default) | +1 XP, flavor |
| O2 | — | Humming metal card | +1 XP, glyph clue |
| A | — | **Whisperlock Key** (artifact, level 5) | Opens the core & exit; end-screen trophy; depletion 1 in 1d10 (p.289+) |

Design note: C5 inside the phase-vault is intentional soft-lock-proofing — the
den's marked S wall is the discoverable way in (hound phasing telegraphs it).

## 7. Boss: the Abykos of the Core
A translucent figure of static drinking from the vault conduits.
- **Physical resistance:** Armor 3 vs mundane weapons; **0 vs cyphers/energy**.
- **The Drain (each round, start):** saps 1 level from a random carried cypher
  (destroyed at 0). *Hoarding is punished; using cyphers is the strategy* (pillar
  #2 by force). Whisper telegraphs: "It drinks what you carry."
- Attack: touch of static, 5 dmg, **Might defense** (not Speed) — armor straps
  crawl; on nat 1 defense it also drains 1 Might Edge-cost-worth (flat 2 Might).
- Phases across the room (repositions to Short each round if you close).
- Kill lines: Detonation + Stim + broadsword-with-Density-Nodule all viable; a
  no-cypher melee win is possible but grindy by design.

## 8. Scripted intrusion moments (accept +2 XP / refuse −1)
Z1: floor gives way — Speed task diff 3 or 3 dmg & drop to Z1 corridor south.
Z2: your armor strap snaps in the scuffle — −1 Armor until a 10-min rest.
Z3: the whisper *lies* about a glyph (one pillar shows a false confirm flash).
Z4: your handhold crumbles mid-climb — climb difficulty +1 this attempt.
Z5: the Key sparks as you grab it — Might defense diff 4 or 4 dmg (Speed N/A).

## 9. Whisper script hooks (write at M6, ≤2 sentences each)
Entry · first cypher touched · first kill (mournful, not congratulatory) · glyph
solve · chasm edge · vault peek · boss reveal · Key taken · exit. Voice: grieving
archivist. Never explains mechanics; the dice tray does that.
