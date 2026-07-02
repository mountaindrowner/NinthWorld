// cyphers.js — identify + USE resolution (Rules §9, Dungeon §6). Cyphers are
// one-use; using or examining is one action. Effects that only matter in combat
// take an optional encounter context. Numenera is used unidentified or examined
// (a hindered Intellect task) first — the Glaive's inability is the whole point.

import { KAVE } from '../data/pregen_kave.js';
import { rollRecovery } from './dice.js';
import { applyRecovery, restorePool } from './player.js';
import { armorVs } from '../data/creatures.js';
import { logEvent } from './state.js';
import { phaseFront } from './world.js';

/** Remove a cypher from inventory by index and count it as used. */
function consumeCypher(state, idx) {
  const cy = state.player.cyphers.splice(idx, 1)[0];
  if (cy) state.stats.cyphersUsed += 1;
  return cy;
}

/**
 * Use the cypher at inventory index `idx`. `combat` (optional) = the encounter,
 * so target/AoE effects can resolve. @returns {string} a summary for the modal.
 */
export function useCypher(state, idx, combat) {
  const p = state.player;
  const cy = p.cyphers[idx];
  if (!cy) return '';
  cy.identified = true; // using reveals what it was

  switch (cy.effect) {
    case 'rejuvenate': {
      consumeCypher(state, idx);
      const pts = rollRecovery(KAVE.recovery, state.rng) + 2; // free recovery at +2, no rest slot
      applyRecovery(p, pts);
      return `Rejuvenator: recovered ${pts} points (no rest slot spent).`;
    }
    case 'density':
      consumeCypher(state, idx);
      p.weaponBonus += 2;
      return 'Density Nodule: your weapon does +2 damage for the rest of the delve.';
    case 'stim':
      consumeCypher(state, idx);
      p.stimRounds = 3;
      return 'Stim Burst: all your actions are eased for 3 rounds.';
    case 'gravity':
      consumeCypher(state, idx);
      p.crossing = true;
      return 'Gravity Nullifier: you drift weightless — the chasm is crossable.';
    case 'phase': {
      consumeCypher(state, idx);
      const ok = phaseFront(state);
      return ok ? 'Phase Disruptor: the wall ahead turns to mist — step through.'
        : 'Phase Disruptor: nothing solid ahead to phase through (face a wall).';
    }
    case 'detonation': {
      const level = cy.level;
      consumeCypher(state, idx);
      if (!combat) return 'Detonation: it needs a target — throw it in a fight.';
      const target = combat.enemies.filter((e) => e.alive).sort((a, b) => a.band.localeCompare(b.band))[0];
      if (!target) return 'Detonation: no target.';
      const dmg = level + 4;
      let hits = 0;
      for (const e of combat.enemies) {
        if (!e.alive || e.band !== target.band) continue; // all in the target's Immediate
        const armor = Math.max(0, armorVs(e.def, 'energy') - 1); // ignores 1 Armor
        e.hp -= Math.max(0, dmg - armor);
        hits += 1;
        if (e.hp <= 0) { e.alive = false; e.ent.alive = false; state.stats.kills += 1; }
      }
      return `Detonation: ${dmg} energy damage to ${hits} foe(s) in the blast.`;
    }
    default:
      consumeCypher(state, idx);
      return `${cy.trueName}: nothing happens.`;
  }
}

/** Examine task spec (Intellect, difficulty = level, hindered by inability). */
export function examineSpec(state, idx) {
  const cy = state.player.cyphers[idx];
  const hinders = [{ label: 'numenera inability', steps: 1 }];
  // murden telepathic static hinders Intellect while one is within Short
  if (state.encounter && state.encounter.enemies.some((e) => e.alive && e.id === 'murden' && e.band !== 'long')) {
    hinders.push({ label: 'murden static', steps: 1 });
  }
  return { label: `examine: ${cy.unidName}`, base: cy.level, eases: [], hinders, stat: 'intellect' };
}

/** Apply an examine result: success identifies the cypher. */
export function applyExamine(state, idx, audit) {
  const cy = state.player.cyphers[idx];
  if (!cy) return '';
  if (audit.success) { cy.identified = true; return `Identified: ${cy.trueName} (level ${cy.level}). ${cy.text}`; }
  return 'The device stays a mystery.';
}

/** Boss Drain (Abykos §7): sap `amount` levels from a random carried cypher. */
export function drainRandomCypher(state, amount = 1) {
  const p = state.player;
  if (!p.cyphers.length) return null;
  const i = Math.floor(state.rng() * p.cyphers.length);
  const cy = p.cyphers[i];
  cy.level -= amount;
  if (cy.level <= 0) {
    p.cyphers.splice(i, 1);
    logEvent(state, `The Abykos drinks your ${cy.identified ? cy.trueName : 'cypher'} to nothing.`);
    return { cy, destroyed: true };
  }
  logEvent(state, 'It drinks what you carry.');
  return { cy, destroyed: false };
}
