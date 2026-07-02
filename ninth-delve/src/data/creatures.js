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
    moveBand: 'immediate', aggro: 4, sprite: 'laak',
    special: ['skitter'], // Speed defense vs it hindered if 2+ laaks present
    intrusion: 'laak_latch', // 1 ongoing dmg until Might task diff 2
  },
  hound: {
    id: 'hound', name: 'broken hound', level: 2, target: 6, hp: 6, damage: 3, armor: 0,
    moveBand: 'short', aggro: 6, sprite: 'hound',
    special: ['phase', 'phase_lunge'], // phase-lunge ignores Armor (Appendix REQUIRED)
    intrusion: 'hound_phase', // phases behind you: next defense hindered
  },
  murden: {
    id: 'murden', name: 'murden', level: 3, target: 9, hp: 9, damage: 4, armor: 1,
    moveBand: 'short', aggro: 6, sprite: 'murden',
    special: ['static'], // Intellect tasks hindered while a murden is within Short
    intrusion: 'murden_snatch', // steals a random cypher and flees
  },
  abykos: {
    id: 'abykos', name: 'Abykos of the Core', level: 4, target: 12, hp: 15, damage: 5,
    armor: { physical: 3, energy: 0 },
    moveBand: 'short', aggro: 8, sprite: 'abykos',
    special: ['drain', 'might_touch', 'reposition'], // §7
    intrusion: 'abykos_surge', // drains +1 extra cypher level this round
  },
};

/** Armor value against a damage type ('physical' default, 'energy' for cyphers). */
export function armorVs(creature, type = 'physical') {
  const a = creature.armor;
  return typeof a === 'number' ? a : (a[type] ?? a.physical ?? 0);
}
