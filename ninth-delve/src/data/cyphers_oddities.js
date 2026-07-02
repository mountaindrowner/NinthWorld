// Loot registry (Dungeon §6). Cyphers spawn UNIDENTIFIED (sensory name); the
// true name + level (1d6+X, rolled at boot) reveal on Examine or use. `effect`
// is the resolution key handled in game/cyphers.js. All flavor prose original.

/**
 * @typedef {Object} CypherDef
 * @property {string} id
 * @property {string} unidName    // sensory description shown until identified
 * @property {string} trueName
 * @property {[number,number]} levelRoll  // [dieCount 1d6, bonus]  → level
 * @property {string} effect      // resolution key (game/cyphers.js)
 * @property {string} text        // effect description (shown once identified/used)
 */

/** @type {Record<string, CypherDef>} */
export const CYPHERS = {
  C1: { id: 'C1', unidName: 'a cold ampoule that squirms', trueName: 'Rejuvenator', levelRoll: [1, 2], effect: 'rejuvenate', text: 'Immediate free recovery roll at +2; does not consume a daily rest slot.' },
  C2: { id: 'C2', unidName: 'a warm glass bead, gold-threaded', trueName: 'Detonation', levelRoll: [1, 2], effect: 'detonation', text: 'Thrown (Short): level+4 damage to all in the target’s Immediate; ignores 1 Armor.' },
  C3: { id: 'C3', unidName: 'a buckle that falls slowly', trueName: 'Gravity Nullifier', levelRoll: [1, 3], effect: 'gravity', text: '1 minute weightless: cross the chasm, negate falls.' },
  C4: { id: 'C4', unidName: 'a stone knuckle, magnet-cold', trueName: 'Density Nodule', levelRoll: [1, 2], effect: 'density', text: 'Affix to weapon: +2 damage for the rest of the delve.' },
  C5: { id: 'C5', unidName: 'a lens showing the room empty', trueName: 'Phase Disruptor', levelRoll: [1, 3], effect: 'phase', text: 'Walk through one wall cell.' },
  C6: { id: 'C6', unidName: 'a tuning fork, already ringing', trueName: 'Stim Burst', levelRoll: [1, 1], effect: 'stim', text: 'Ease all your actions for 3 rounds.' },
};

/** @type {Record<string, {id:string,name:string,text:string,xp:number}>} */
export const ODDITIES = {
  O1: { id: 'O1', name: 'blob of self-reshaping clay', text: 'It rearranges itself whenever you look away.', xp: 1 },
  O2: { id: 'O2', name: 'humming metal card', text: 'Held still, it plays three descending tones — the same motif the gallery wants.', xp: 1 },
  O_clay: { id: 'O_clay', name: 'blob of self-reshaping clay', text: 'Kave’s own trinket; it never holds a shape.', xp: 0 },
};

/** The artifact (Dungeon §6). Depletion 1 in 1d10 (flavor; end-screen trophy). */
export const ARTIFACT = {
  id: 'A', name: 'the Whisperlock Key', level: 5,
  text: 'A tuning-fork crown of gold and cyan. It opens the core and the exit.',
  xp: 3,
};

/** Roll a cypher's level from its [dice,bonus] formula. @param {()=>number} rng */
export function rollCypherLevel(def, rng) {
  const [dice, bonus] = def.levelRoll;
  let n = bonus;
  for (let i = 0; i < dice; i++) n += 1 + Math.floor(rng() * 6);
  return n;
}

/** Instantiate an unidentified cypher instance for the inventory. */
export function makeCypher(id, rng) {
  const def = CYPHERS[id];
  return {
    id, unidName: def.unidName, trueName: def.trueName,
    level: rollCypherLevel(def, rng), effect: def.effect, text: def.text,
    identified: false,
  };
}
