// Intrusion tables (Dungeon §8 + Rules §6). SCRIPTED = the five authored moments
// (accept +2 XP / refuse −1 XP). TABLES = the free nat-1 pool (global / per-zone /
// per-creature), applied without an XP choice. Effects mutate GameState directly;
// applyDamage is imported where a table entry deals damage.

import { applyDamage } from '../game/player.js';

/** The five scripted intrusions, keyed by zone (Dungeon §8). */
export const SCRIPTED = {
  Z1: { label: 'the floor gives way', text: 'The floor gives way beneath you — you drop into the dark and land hard.', apply: (s) => applyDamage(s.player, 3) },
  Z2: { label: 'your strap snaps', text: 'Your armor strap snaps in the scuffle. −1 Armor until you can rest.', apply: (s) => { s.player.armorPenalty = 1; } },
  Z3: { label: 'the whisper lies', text: 'The whisper murmurs a false confirmation — one glyph will flash a lie.', apply: (s) => { s.glyph.lie = true; } },
  Z4: { label: 'the handhold crumbles', text: 'Your handhold crumbles mid-climb — the next hold is harder.', apply: (s) => { s.climbPenalty = 1; } },
  Z5: { label: 'the Key sparks', text: 'The Key sparks as you close your hand on it, static biting to the bone.', apply: (s) => applyDamage(s.player, 4) },
};

/** Free nat-1 intrusion pool (no XP; the GM simply intrudes). */
export const TABLES = {
  global: [
    { text: 'the dark shifts and you lose a step', apply: () => {} },
  ],
  zone: {
    Z3: [{ text: 'a hound phases from the wall and is on you', apply: (s) => applyDamage(s.player, 2) }],
    Z4: [{ text: 'coolant vents scald your hands', apply: (s) => applyDamage(s.player, 2) }],
  },
  creature: {
    laak: [{ text: 'the laak latches on — 1 ongoing damage', apply: (s) => applyDamage(s.player, 1) }],
  },
};
