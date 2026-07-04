// Creature roster (Dungeon §4). Stat contract (Rules §8): target = level×3,
// health defaults level×3, damage defaults to level (tuned per row). Armor and
// specials per the book pages cited in the Dungeon doc.

/**
 * @typedef {Object} Creature
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {number} target      // level × 3 (defense TN when the player attacks)
 * @property {number} hp
 * @property {number} damage
 * @property {number|{physical:number,energy:number}} armor
 * @property {'immediate'|'short'|'long'} moveBand
 * @property {number} aggro        // explore aggro range in tiles (LOS trigger)
 * @property {string} sprite       // asset key
 * @property {string[]} special
 */

/** @type {Record<string, Creature>} */
export const CREATURES = {
  laak: {
    id: 'laak', name: 'laak', level: 1, target: 3, hp: 3, damage: 2, armor: 0,
    moveBand: 'immediate', aggro: 3, sprite: 'laak',
    special: ['skitter'], // Speed defense vs it hindered if 2+ laaks present
    intrusion: 'laak_latch', // 1 ongoing dmg until Might task diff 2
    worldH: 0.45, // palm-sized — it hunts your ankles
    F: { idleA: 0, idleB: 1, lunge: 2, hit: 3, dead: 4, atk: 2, front: [5, 6], back: [7, 8] },
  },
  hound: {
    id: 'hound', name: 'broken hound', level: 2, target: 6, hp: 6, damage: 3, armor: 0,
    moveBand: 'short', aggro: 6, sprite: 'hound',
    special: ['phase', 'phase_lunge'], // phase-lunge ignores Armor (Appendix REQUIRED)
    intrusion: 'hound_phase', // phases behind you: next defense hindered
    worldH: 0.9,
    F: { idleA: 0, idleB: 1, phase: 2, lunge: 3, hit: 4, dead: 5, atk: 3, front: [6, 7], back: [8, 9] },
  },
  murden: {
    id: 'murden', name: 'murden', level: 3, target: 9, hp: 9, damage: 4, armor: 1,
    moveBand: 'short', aggro: 6, sprite: 'murden',
    special: ['static'], // Intellect tasks hindered while a murden is within Short
    intrusion: 'murden_snatch', // steals a random cypher and flees
    worldH: 1.05,
    F: { idleA: 0, idleB: 1, throw: 2, snatch: 3, hit: 4, dead: 5, atk: 3, front: [6, 7], back: [8, 9] },
    // thrown stone: harasses from range while backing away (realtime design)
    ranged: { range: 8, damage: 2, cd: 2600 },
  },
  abykos: {
    id: 'abykos', name: 'Abykos of the Core', level: 4, target: 12, hp: 15, damage: 5,
    armor: { physical: 3, energy: 0 },
    moveBand: 'short', aggro: 8, sprite: 'abykos',
    // §7 + phase_touch: balance-pass interpretation (flagged in HANDOVER) — a
    // transdimensional being's touch passes through armor exactly like the
    // hound's phase-lunge; with armor applied its 5 dmg landed as a 2-pt tap
    // and the warden could never threaten a Tier-1 Glaive (bot sweep data).
    special: ['drain', 'might_touch', 'phase_touch', 'reposition'],
    intrusion: 'abykos_surge', // drains +1 extra cypher level this round
    worldH: 1.5, // 64×96 — it looms
    F: { idleA: 0, idleB: 1, drain: 2, touch: 3, hit: 4, deathA: 5, deathB: 6, atk: 3, front: [0, 1], back: [7, 8] },
  },
};

/** Armor value against a damage type ('physical' default, 'energy' for cyphers). */
export function armorVs(creature, type = 'physical') {
  const a = creature.armor;
  return typeof a === 'number' ? a : (a[type] ?? a.physical ?? 0);
}
