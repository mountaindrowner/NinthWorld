// The single mutable GameState (Tech §5) + small helpers. One object threads
// through every system; combat builds Action objects so the dice tray can show
// the full math trail. Player constants come from data/pregen_kave.js.

import { KAVE } from '../data/pregen_kave.js';
import { PLACEMENTS, FACING } from '../data/map_whisperlock.js';

/**
 * @typedef {'EXPLORE'|'ENCOUNTER'|'MODAL'|'REPORT'} Mode
 * @typedef {'hale'|'impaired'|'debilitated'|'dead'} DamageTrack
 * @typedef {{might:number,speed:number,intellect:number}} Pools
 */

/** Create a fresh GameState for a new delve. @param {()=>number} rng */
export function createGameState(rng, seed) {
  const spawn = PLACEMENTS.find((p) => p.id === 'P');
  return {
    mode: 'EXPLORE',
    seed,
    rng,
    t: 0,                         // ms clock for animations
    player: {
      x: spawn.x + 0.5, y: spawn.y + 0.5, angle: FACING[spawn.facing],
      pools: { ...KAVE.pools },
      poolMax: { ...KAVE.pools },
      edge: { ...KAVE.edge },
      effort: KAVE.effort,
      tier: KAVE.tier,
      armor: KAVE.armor,
      speedSurcharge: KAVE.speedSurcharge,
      track: /** @type {DamageTrack} */ ('hale'),
      xp: 0, xpSpent: 0,
      shins: KAVE.startShins,
      cyphers: [],                // {id,unidName,trueName,level,effect,identified}
      oddities: [],
      cypherLimit: KAVE.cypherLimit,
      aggression: false,          // Aggression stance toggle
      defending: false,           // Defend action flag (eased defenses next enemy phase)
      stimRounds: 0,              // Stim Burst: ease all actions N rounds
      weaponBonus: 0,             // Density Nodule: +2 damage rest of delve
      restsUsed: 0,               // daily recovery sequence index (0..3)
      armorPenalty: 0,            // Z2 intrusion: −1 armor until rest
      crossing: false,            // Gravity Nullifier (C3): chasm traversable
      nextDefenseHinder: false,   // hound phase-behind intrusion
    },
    discoveredZones: new Set(),   // XP-source dedup keys (via awardXP)
    visitedZones: new Set(),      // zones entered (discovery XP + scripted trigger)
    firedScripted: new Set(),     // scripted intrusions already shown
    secretsFound: new Set(),
    phasedCells: new Set(),       // wall cells opened by the Phase Disruptor (C5)
    doors: {},                    // "x,y" -> {open:boolean, t:0..1 slide}
    glyph: {
      rotation: [0, 0, 0],
      correct: [Math.floor(rng() * 4), Math.floor(rng() * 4), Math.floor(rng() * 4)],
      solved: false, intuited: false, muralSeen: false, lie: false,
    },
    climbPenalty: 0,
    entities: [],                 // explore pickups + creature billboards
    encounter: null,              // combat state while mode==='ENCOUNTER'
    modal: null,                  // {kind, ...} while mode==='MODAL'
    keyTaken: false,
    exited: false,
    log: [],                      // recent event strings (HUD ticker)
    stats: { discoveries: 0, kills: 0, secrets: 0, cyphersUsed: 0, cyphersHoarded: 0, rerolls: 0 },
  };
}

/** Push a short event line (kept to the last 6 for the HUD ticker). */
export function logEvent(state, msg) {
  state.log.push(msg);
  if (state.log.length > 6) state.log.shift();
}

/** Award discovery XP once per source key (pillar #2). @returns {boolean} awarded */
export function awardXP(state, amount, sourceKey) {
  if (sourceKey && state.discoveredZones.has(`xp:${sourceKey}`)) return false;
  if (sourceKey) state.discoveredZones.add(`xp:${sourceKey}`);
  state.player.xp += amount;
  logEvent(state, `+${amount} XP — ${sourceKey || 'discovery'}`);
  return true;
}

/** Total cyphers carried (for over-limit checks, Rules §9). */
export const cypherCount = (state) => state.player.cyphers.length;
export const overLimit = (state) => cypherCount(state) > state.player.cypherLimit;
