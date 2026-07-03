// Intrusion engine (Rules §6, Dungeon §8). Scripted intrusions prompt the
// accept(+2 XP)/refuse(−1 XP) modal (refuse disabled at 0 XP — can't go negative).
// Free nat-1 table intrusions apply immediately with no XP transaction.

import { SCRIPTED, TABLES } from '../data/intrusion_tables.js';
import { logEvent } from './state.js';

/** Open the accept/refuse modal for an intrusion; `cont` runs after resolution. */
export function openIntrusion(state, intr, cont) {
  state.prevMode = state.mode;
  state.mode = 'MODAL';
  state.modal = {
    kind: 'intrusion', title: 'the world turns against you', text: intr.text,
    choices: [
      { label: 'Endure it  +2 XP', value: 'accept', accent: undefined },
      { label: 'Defy it  −1 XP', value: 'refuse', disabled: state.player.xp <= 0 },
    ],
    onResolve: (result) => {
      if (result === 'accept') { intr.apply?.(state); state.player.xp += 2; logEvent(state, `Intrusion accepted (+2 XP): ${intr.label || intr.text}.`); }
      else { state.player.xp = Math.max(0, state.player.xp - 1); logEvent(state, 'Intrusion refused (−1 XP).'); }
      cont?.(result);
    },
  };
}

/** Fire the scripted intrusion for a zone (once); `cont` runs after (or immediately). */
export function scriptedIntrusion(state, zoneId, cont) {
  const intr = SCRIPTED[zoneId];
  if (!intr || state.firedScripted?.has(zoneId)) { cont?.(); return; }
  (state.firedScripted ||= new Set()).add(zoneId);
  openIntrusion(state, intr, cont);
}

/** Queue a scripted intrusion to fire once, next time explore is idle. */
export function queueScripted(state, zoneId) {
  if (!SCRIPTED[zoneId] || state.firedScripted?.has(zoneId)) return;
  (state.scriptedQueue ||= []).push(zoneId);
}

/** Fire the next queued scripted intrusion if explore is idle (no open UI). */
export function pumpScripted(state) {
  if (state.mode !== 'EXPLORE') return;
  const q = state.scriptedQueue;
  if (!q || !q.length) return;
  scriptedIntrusion(state, q.shift());
}

/** Apply a free nat-1 intrusion from the creature/zone/global pool (no XP). */
export function tableIntrusion(state, { zone, creature } = {}) {
  const list = (creature && TABLES.creature[creature]) || (zone && TABLES.zone[zone]) || TABLES.global;
  const intr = list[Math.floor(state.rng() * list.length)];
  intr.apply?.(state);
  logEvent(state, `The GM smiles — ${intr.text}.`);
}
