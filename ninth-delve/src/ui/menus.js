// Modal panels (Tech §5 MODAL state): pickup, secret, examine, intrusion, and
// the glyph puzzle share this renderer. Encounter action menus live in
// combat/dicetray. Each draw fn returns true when the modal is dismissed.

import { PALETTE } from '../engine/texgen.js';
import { panel, text, wrapText, button, bar } from './widgets.js';
import { KAVE } from '../data/pregen_kave.js';
import { availableActions, playerAction, useCypherInCombat, examineInCombat } from '../game/combat.js';
import { useCypher, examineSpec, applyExamine } from '../game/cyphers.js';
import { openTray } from './dicetray.js';
import { logEvent } from '../game/state.js';

const BUF_W = 320, BUF_H = 200;

/** Encounter status + action menu (drawn while mode==='ENCOUNTER'). */
export function drawEncounterMenu(ctx, state, clicks, keys) {
  const e = state.encounter;
  if (!e) return;
  panel(ctx, 4, 4, 172, 12 + e.enemies.length * 10, `round ${e.round}`);
  let y = 24;
  for (const en of e.enemies) {
    const col = en.alive ? PALETTE.boneLight : PALETTE.boneShadow;
    const tag = `${en.name}  ${Math.max(0, en.hp)}/${en.maxHp} [${en.band.slice(0, 3)}]${en.stunned ? ' stun' : ''}${en.alive ? '' : ' †'}`;
    text(ctx, tag, 10, y, { size: 8, color: col });
    y += 10;
  }
  if (e.phase !== 'player') { text(ctx, '… enemy phase', 10, y + 2, { size: 8, color: PALETTE.rust }); return; }

  const acts = availableActions(state);
  let bx = 2, by = 130; const bw = 76, bh = 14; let col = 0;
  acts.forEach((act, i) => {
    if (button(ctx, { x: bx, y: by, w: bw, h: bh, label: act.label, hotkey: `Digit${i + 1}`, disabled: act.disabled }, clicks, keys)) playerAction(state, act.id);
    if (++col === 4) { col = 0; bx = 2; by += bh + 2; } else bx += bw + 4;
  });
}

/**
 * Cypher list (mode==='CYPHERS'): Use / Examine each carried cypher, from either
 * explore (context 'explore') or a fight ('combat', consumes the turn).
 * Returns true when the menu should close.
 */
export function drawCypherMenu(ctx, state, clicks, keys) {
  const cm = state.cypherMenu;
  const cy = state.player.cyphers;
  const w = 240, h = 44 + Math.max(1, cy.length) * 20, x = (BUF_W - w) / 2, y = 24;
  panel(ctx, x, y, w, h, 'cyphers');

  if (!cy.length) text(ctx, 'You carry no cyphers.', x + 10, y + 30, { size: 8, color: PALETTE.boneShadow });
  let ry = y + 24;
  for (let i = 0; i < cy.length; i++) {
    const c = cy[i];
    const name = c.identified ? `${c.trueName} (L${c.level})` : c.unidName;
    text(ctx, name, x + 8, ry + 10, { size: 8, color: c.identified ? PALETTE.goldGlow : PALETTE.boneLight });
    if (button(ctx, { x: x + w - 108, y: ry, w: 48, h: 14, label: 'Use', hotkey: `Digit${i + 1}` }, clicks, keys)) { closeCyphers(state); doUse(state, cm, i); return true; }
    if (!c.identified && button(ctx, { x: x + w - 56, y: ry, w: 48, h: 14, label: 'Exam' }, clicks, keys)) { closeCyphers(state); doExamine(state, cm, i); return true; }
    ry += 20;
  }
  if (button(ctx, { x: x + w - 56, y: y + h - 20, w: 48, h: 14, label: 'Close', hotkey: 'Enter' }, clicks, keys)) { closeCyphers(state); return true; }
  if (keys.includes('Escape') || keys.includes('KeyC')) { closeCyphers(state); return true; }
  return false;
}

function closeCyphers(state) { state.mode = state.cypherMenu?.ret || 'EXPLORE'; state.cypherMenu = null; }

function doUse(state, cm, idx) {
  if (cm.context === 'combat') { useCypherInCombat(state, idx); return; }
  logEvent(state, useCypher(state, idx)); // explore use — no turn
}

function doExamine(state, cm, idx) {
  if (cm.context === 'combat') { examineInCombat(state, idx); return; }
  openTray(state, examineSpec(state, idx), (a) => logEvent(state, applyExamine(state, idx, a)));
}

/** Character sheet (Tab). Returns true when dismissed. */
export function drawSheet(ctx, state, clicks, keys, assets) {
  const p = state.player;
  const w = 260, h = 150, x = (BUF_W - w) / 2, y = 20;
  panel(ctx, x, y, w, h, KAVE.name);
  text(ctx, KAVE.archetype, x + 8, y + 22, { size: 8, color: PALETTE.boneShadow });

  const stats = [['Might', 'might'], ['Speed', 'speed'], ['Intellect', 'intellect']];
  let sy = y + 36;
  for (const [lbl, k] of stats) {
    text(ctx, lbl, x + 8, sy + 7, { size: 8, color: PALETTE.boneLight });
    bar(ctx, x + 70, sy, 80, 8, p.pools[k] / p.poolMax[k], PALETTE.cyan);
    text(ctx, `${p.pools[k]}/${p.poolMax[k]}  Edge ${p.edge[k]}`, x + 156, sy + 7, { size: 8, color: PALETTE.boneShadow });
    sy += 14;
  }
  text(ctx, `Tier ${p.tier} · Effort ${p.effort} · Armor ${p.armor - p.armorPenalty} · ${p.track}`, x + 8, sy + 8, { size: 8, color: PALETTE.gold });
  text(ctx, `Broadsword ${KAVE.weapons.broadsword.damage + p.weaponBonus} · Dagger ${KAVE.weapons.dagger.damage} (eases) · fists 2`, x + 8, sy + 22, { size: 8, color: PALETTE.boneLight });
  text(ctx, `Aggression (2 Might) · Fleet of Foot (1 Speed)`, x + 8, sy + 34, { size: 8, color: PALETTE.boneLight });
  text(ctx, `XP ${p.xp} (spent ${p.xpSpent}) · cyphers ${p.cyphers.length}/${p.cypherLimit} · ${p.shins} shins`, x + 8, sy + 46, { size: 8, color: PALETTE.goldGlow });

  if (button(ctx, { x: x + w - 74, y: y + h - 22, w: 64, h: 16, label: 'Close', hotkey: 'Enter' }, clicks, keys)) return true;
  return keys.includes('Tab') || keys.includes('Escape');
}

/**
 * Render the current modal (state.modal). Returns true when the player dismisses
 * it (Continue / click / Enter). Choice modals (intrusion, examine) set fields
 * on state.modal.result instead and also return true when resolved.
 */
export function drawModal(ctx, state, clicks, keys) {
  const m = state.modal;
  if (!m) return true;
  const w = 220, h = 110, x = (BUF_W - w) / 2, y = (BUF_H - h) / 2;
  panel(ctx, x, y, w, h, m.title || m.kind);

  let cy = y + 26;
  cy = wrapText(ctx, m.text || '', x + 10, cy, w - 20, 11, { size: 8, color: PALETTE.boneLight });
  if (m.sub) cy = wrapText(ctx, m.sub, x + 10, cy + 4, w - 20, 11, { size: 8, color: PALETTE.rust });

  // Choice buttons (e.g. intrusion accept/refuse); else a single Continue.
  if (m.choices && m.choices.length) {
    let bx = x + 10;
    for (let i = 0; i < m.choices.length; i++) {
      const c = m.choices[i];
      const bw = Math.min(96, (w - 20) / m.choices.length - 4);
      if (button(ctx, { x: bx, y: y + h - 22, w: bw, h: 16, label: c.label, hotkey: `Digit${i + 1}`, disabled: c.disabled, accent: c.accent }, clicks, keys)) {
        m.result = c.value;
        return true;
      }
      bx += bw + 4;
    }
    return false;
  }

  if (button(ctx, { x: x + w - 84, y: y + h - 22, w: 74, h: 16, label: 'Continue', hotkey: 'Enter' }, clicks, keys)) return true;
  // also dismiss on any interact key
  if (keys.includes('KeyE') || keys.includes('Space')) return true;
  return false;
}
