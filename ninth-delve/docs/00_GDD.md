# 00 — GAME DESIGN DOCUMENT
**Project:** Ninth Delve (working title) · **Slice:** The Whisperlock (one dungeon)

## 1. Pitch
You are a glaive hired to breach the Whisperlock — a sealed prior-world vault that
murmurs in a dead machine's voice. Explore it in free-roaming first person like
*Arena '94*. When something attacks, time stops and the tabletop comes out: a d20,
a target number, and every Cypher System decision — spend Effort? burn a cypher?
accept the intrusion for XP? You are the only one who ever rolls dice. Just like
the book.

## 2. Design pillars (tiebreakers for every decision)
1. **You roll everything.** Cypher's signature rule — players roll attacks AND
   defenses; the GM never rolls (Discovery p.16, p.100). Every d20 is thrown by the
   player, on screen, with the math visible. If a feature hides the dice, cut it.
2. **Discovery is the soul.** XP comes from finding things — zones, secrets,
   cyphers, the artifact — never from kills (p.128, and stated verbatim as a
   design credo throughout the book). Killing is a means, not a score.
3. **Weird is sacred.** Ninth World tone: technology mistaken for magic, described
   sensorially, never fully explained. The dungeon whispers; it does not exposit.
4. **Arena crunch.** 320×200 internal resolution, chunky texels, billboard sprite
   monsters, a HUD with a face bar energy. Retro-authentic, not retro-apologetic.
5. **Fable-native.** Zero dependencies, zero build tools, all assets replaceable
   by procedural fallbacks. Any Claude Code session can run and reason about
   every line.

## 3. Core loop
```
EXPLORE (real-time, free-roam raycaster)
  └─ find: cyphers · oddities · shins · clues · secrets ──→ +XP (discovery)
  └─ trigger: creature with line-of-sight & proximity
        ↓
ENCOUNTER (turn-based, Cypher rules, dice tray UI)
  └─ initiative Speed roll → your turn: Attack / Ability / Cypher / Move band /
     Catch Breath / Flee → enemy turn = YOUR defense rolls
  └─ natural 1 → GM intrusion · natural 17–20 → bonus damage / minor / major effect
  └─ scripted intrusions: accept (+2 XP) or refuse (−1 XP)
        ↓
OUTCOME → loot / retreat / damage-track pressure → back to EXPLORE
        ↓
GOAL: solve the Whisper Gallery, cross the Coolant Chasm, defeat the Abykos,
      claim the Whisperlock Key, exit → DELVE REPORT (discoveries, XP, shins)
```

## 4. Player fantasy
Competent scavenger-warrior in over their head. Powerful in melee, **bad at
understanding the numenera** (the Glaive's inability is a feature: cyphers are
found *unidentified* and examining them is a hindered Intellect task — use the
mystery device blind, or risk a roll to learn what it does first).

## 5. Session shape (target 20–40 min)
- 5 zones, ~10 encounters possible, ~6 expected (stealth/route choices skip some)
- 1 environmental puzzle (glyph pillars), 1 traversal choice (chasm: cypher vs long way)
- 1 boss with a mechanic that **forces cypher usage** (it drains hoarded cyphers)
- 2 secrets, 1 reachable only by a specific cypher
- Fail states: death (damage track past debilitated) → Delve Report anyway;
  retreat anytime (keep discoveries; artifact required for a "true clear")

## 6. Win/Loss & scoring (Delve Report screen)
XP earned · XP spent on rerolls · shins · cyphers used vs hoarded · secrets found ·
"Tier 2 progress: N/4 benefits purchased" tease (advancement per Discovery p.128:
4 benefits @ 4 XP each = next tier).

## 7. Explicitly OUT of scope for this slice
Character creation · multiple classes · saving/loading · town/overworld ·
merchant economy · ranged weapon ammo tracking (dagger throw is fine) ·
NPC dialogue trees · sound assets beyond procedural WebAudio · difficulty modes.

## 8. Tone & reference board
*TES: Arena* (rendering, HUD, mood) · *Legend of Grimrock* (encounter clarity) ·
*Torment: Tides of Numenera* (prose voice for whispers/examine text) ·
Numenera Discovery ch. 9 "Living in the Ninth World" (p.130+) for texture.

## 9. Naming note
"Whisperlock," "Kave the Unbroken," and all flavor prose in this suite are
original. Creature names (laak, murden, broken hound, abykos) are Numenera IP —
fine privately; reskin before any public build (see README).
