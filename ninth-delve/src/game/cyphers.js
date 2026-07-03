// cyphers.js — identify + USE resolution (Rules §9, Dungeon §6). Cyphers are
// one-use. Combat effects resolve in real time against world entities (the
// Morrowind pivot). Numenera is used unidentified or examined (a hindered
// Intellect task) first — the Glaive's inability is the whole point.

import { KAVE } from '../data/pregen_kave.js';
import { rollRecovery } from './dice.js';
import { applyRecovery } from './player.js';
import { armorVs, CREATURES } from '../data/creatures.js';
import { logEvent, addPopup } from './state.js';
import { phaseFront, tileDist, hasLOS } from './world.js';
import { PALETTE } from '../engine/texgen.js';

/** Remove a cypher from inventory by index and count it as used. */
function consumeCypher(state, idx) {
  const cy = state.player.cyphers.splice(idx, 1)[0];
  if (cy) state.stats.cyphersUsed += 1;
  return cy;
}

/**
 * Use the cypher at inventory index `idx`. Combat effects (Detonation) resolve
 * immediately against nearby world creatures. @returns {string} summary text.
 */
export function useCypher(state, idx) {
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
      p.stimUntil = state.t + 15000;
      return 'Stim Burst: all your actions are eased while it sings (15s).';
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
      // thrown at the nearest visible creature within Short (10 tiles); the
      // blast catches everything within 2 tiles of it. Energy — Abykos Armor 0.
      const p2 = state.player;
      const targets = state.entities.filter((e) => e.kind === 'creature' && e.alive && !e.hidden
        && tileDist(p2.x, p2.y, e.x, e.y) <= 10 && hasLOS(state, p2.x, p2.y, e.x, e.y));
      if (!targets.length) return 'Detonation: no target in sight — keep it for a fight.';
      consumeCypher(state, idx);
      const target = targets.sort((a, b) => tileDist(p2.x, p2.y, a.x, a.y) - tileDist(p2.x, p2.y, b.x, b.y))[0];
      const dmg = level + 4;
      let hits = 0;
      for (const e of state.entities) {
        if (e.kind !== 'creature' || !e.alive || e.hidden) continue;
        if (tileDist(target.x, target.y, e.x, e.y) > 2) continue;
        const def = CREATURES[e.creatureId];
        const armor = Math.max(0, armorVs(def, 'energy') - 1); // ignores 1 Armor
        const dealt = Math.max(0, dmg - armor);
        e.hp -= dealt; e.engaged = true; hits += 1;
        addPopup(state, e.x, e.y, String(dealt), PALETTE.goldGlow);
        if (e.hp <= 0) { e.alive = false; state.stats.kills += 1; }
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
  // murden telepathic static hinders Intellect while one is near (Short ≈ 10 tiles)
  const p = state.player;
  if (state.entities.some((e) => e.kind === 'creature' && e.alive && !e.hidden
    && e.creatureId === 'murden' && tileDist(p.x, p.y, e.x, e.y) <= 10)) {
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
