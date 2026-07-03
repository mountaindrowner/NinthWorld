// player.js — pools, Edge, Effort math, the damage track, and recovery
// (Rules §2, §4, §5). Pure functions over the player object so the dice tray
// can preview costs and the ?test=1 tables can assert the numbers.

import { rollRecovery } from './dice.js';

const TRACK_DOWN = { hale: 'impaired', impaired: 'debilitated', debilitated: 'dead', dead: 'dead' };
const TRACK_UP = { dead: 'debilitated', debilitated: 'impaired', impaired: 'hale', hale: 'hale' };
const POOL_ORDER = ['might', 'speed', 'intellect'];

export const isImpaired = (p) => p.track === 'impaired';
export const isDebilitated = (p) => p.track === 'debilitated';
export const isDead = (p) => p.track === 'dead';

/**
 * Total pool cost of applying `levels` of Effort to one action (Rules §2).
 * First level 3, +2 each after; Speed Effort adds the armor surcharge per level;
 * Impaired adds +1 per level; Edge is subtracted once per action. Never below 0.
 * @param {number} levels
 * @param {{edge:number, isSpeed?:boolean, speedSurcharge?:number, impaired?:boolean}} opts
 */
export function effortCost(levels, { edge = 0, isSpeed = false, speedSurcharge = 0, impaired = false }) {
  if (levels <= 0) return 0;
  let cost = 3 + 2 * (levels - 1);
  const perLevel = (isSpeed ? speedSurcharge : 0) + (impaired ? 1 : 0);
  cost += perLevel * levels;
  return Math.max(0, cost - edge);
}

/** Ability point cost (e.g. Aggression 2 Might), Edge applied once. */
export const abilityCost = (amount, edge = 0) => Math.max(0, amount - edge);

function dropTrack(p) { p.track = TRACK_DOWN[p.track]; }
function raiseTrack(p) { p.track = TRACK_UP[p.track]; }

/**
 * Pay `amount` from a pool for a cost (Effort/ability). Emptying a pool to 0
 * drops one damage-track step (Rules §4). @returns {boolean} affordable
 */
export function payCost(p, stat, amount) {
  if (amount <= 0) return true;
  if (p.pools[stat] < amount) return false;
  const before = p.pools[stat];
  p.pools[stat] -= amount;
  if (p.pools[stat] === 0 && before > 0) dropTrack(p);
  return true;
}

/**
 * Apply incoming damage (Armor already subtracted). Hits Might first, overflows
 * Might→Speed→Intellect; each pool emptied drops a track step; overflow past
 * Intellect (or dropping past debilitated) = dead (Rules §4).
 * @returns {number} damage actually absorbed
 */
export function applyDamage(p, amount) {
  let rem = amount;
  for (const stat of POOL_ORDER) {
    if (rem <= 0) break;
    const before = p.pools[stat];
    const absorb = Math.min(before, rem);
    p.pools[stat] -= absorb;
    rem -= absorb;
    if (p.pools[stat] === 0 && before > 0) dropTrack(p);
  }
  if (rem > 0) p.track = 'dead'; // overflowed the last pool
  return amount - rem;
}

/** Restore points to a pool; lifting a pool off 0 raises one track step (Rules §4). */
export function restorePool(p, stat, amount) {
  if (amount <= 0) return;
  const before = p.pools[stat];
  p.pools[stat] = Math.min(p.poolMax[stat], before + amount);
  if (before === 0 && p.pools[stat] > 0) raiseTrack(p);
}

/** Auto-distribute recovery points into the most-depleted pools (Might→Speed→Intellect). */
export function applyRecovery(p, points) {
  let rem = points;
  for (const stat of POOL_ORDER) {
    if (rem <= 0) break;
    const need = p.poolMax[stat] - p.pools[stat];
    const add = Math.min(need, rem);
    if (add > 0) { restorePool(p, stat, add); rem -= add; }
  }
  return points - rem;
}

/**
 * Roll a recovery (Rules §5) and apply it. `slot` indexes the daily sequence
 * (0 = Catch Breath action). @returns {{points:number, slot:string}}
 */
export function recover(p, recoveryDef, rng) {
  const points = rollRecovery(recoveryDef, rng);
  applyRecovery(p, points);
  const slot = p.restSequenceLabel ? p.restSequenceLabel(p.restsUsed) : String(p.restsUsed);
  p.restsUsed += 1;
  return { points, slot };
}

/**
 * Tier advancement, bought at a rest for 4 XP (Rules §6: four benefits = next
 * tier). Morrowind's "sleep to level," Numenera's math underneath.
 * @param {'pool'|'edge'|'effort'|'weapon'} kind
 * @returns {string} what changed, for the feed
 */
export function applyBenefit(state, kind, stat) {
  const p = state.player;
  p.benefits = (p.benefits || 0) + 1;
  if (kind === 'pool') { p.poolMax[stat] += 4; p.pools[stat] += 4; return `your ${stat} deepens (+4)`; }
  if (kind === 'edge') { p.edge[stat] += 1; return `your ${stat} edge sharpens (+1)`; }
  if (kind === 'effort') { p.effort += 1; return 'you can push harder — heavy swings now spend deeper Effort'; }
  if (kind === 'weapon') { p.weaponTrained = true; return 'sword training — your cuts come easier'; }
  return '';
}
