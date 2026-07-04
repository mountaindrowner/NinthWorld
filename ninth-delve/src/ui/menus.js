// Modal panels (Tech §5 MODAL state): pickup, secret, intrusion, cypher list,
// and the glyph puzzle share this renderer. These are choice screens; any dice
// they need roll in the background (Morrowind rule: menus pause, dice never ask).

import { PALETTE } from '../engine/texgen.js';
import { panel, text, wrapText, wrapCount, button, bar } from './widgets.js';
import { KAVE } from '../data/pregen_kave.js';
import { useCypher, examineSpec, applyExamine } from '../game/cyphers.js';
import { resolveTask } from '../game/dice.js';
import { logEvent, awardXP, feedLine } from '../game/state.js';
import { tableIntrusion } from '../game/intrusions.js';
import { inCombat } from '../game/combat.js';
import { recover, applyBenefit } from '../game/player.js';

const GLYPH_SYM = ['◇', '△', '▽', '▣'];

import { BUF_W, BUF_H } from '../engine/screen.js';

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
    if (!c.identified && button(ctx, { x: x + w - 56, y: ry, w: 48, h: 14, label: 'Exam' }, clicks, keys)) { doExamine(state, i); return false; } // resolves in place
    ry += 20;
  }
  if (button(ctx, { x: x + w - 56, y: y + h - 20, w: 48, h: 14, label: 'Close', hotkey: 'Enter' }, clicks, keys)) { closeCyphers(state); return true; }
  if (keys.includes('Escape') || keys.includes('KeyC')) { closeCyphers(state); return true; }
  return false;
}

function closeCyphers(state) { state.mode = state.cypherMenu?.ret || 'EXPLORE'; state.cypherMenu = null; }

// Menus pause the world (Morrowind-style), so using/examining is never rushed.
function doUse(state, cm, idx) {
  logEvent(state, useCypher(state, idx));
}

// Examining is one background Intellect roll (hindered — the Glaive's inability).
function doExamine(state, idx) {
  const spec = examineSpec(state, idx);
  const audit = resolveTask({ base: spec.base, eases: spec.eases, hinders: spec.hinders, rng: state.rng });
  feedLine(state, audit.success ? 'its purpose comes clear in your hands' : 'the device keeps its secret',
    audit.success ? PALETTE.cyan : PALETTE.boneShadow);
  logEvent(state, applyExamine(state, idx, audit));
}

/**
 * Glyph puzzle (mode==='GLYPH', Dungeon §5): rotate three pillars to the correct
 * triple. Clue comes from O2, the Z2 mural, or a hindered Intellect intuition —
 * any one reveals the sequence. A wrong Attempt rolls the Z3 intrusion table.
 * Returns true when the puzzle should close.
 */
export function drawGlyphPuzzle(ctx, state, clicks, keys) {
  const g = state.glyph;
  const w = 244, h = 132, x = (BUF_W - w) / 2, y = 22;
  panel(ctx, x, y, w, h, 'whisper gallery — glyph lock');

  for (let i = 0; i < 3; i++) {
    const px = x + 42 + i * 68;
    text(ctx, GLYPH_SYM[g.rotation[i]], px, y + 46, { size: 22, color: PALETTE.cyan, align: 'center' });
    if (button(ctx, { x: px - 22, y: y + 54, w: 44, h: 14, label: 'Rotate', hotkey: `Digit${i + 1}` }, clicks, keys)) g.rotation[i] = (g.rotation[i] + 1) % 4;
  }

  const clue = state.player.oddities.includes('O2') || g.muralSeen || g.intuited;
  if (clue) text(ctx, `clue:  ${g.correct.map((v) => GLYPH_SYM[v]).join('   ')}`, x + 12, y + 90, { size: 12, color: PALETTE.goldGlow });
  else text(ctx, 'The sockets wait for a sequence you do not yet know.', x + 12, y + 90, { size: 8, color: PALETTE.boneShadow });

  if (button(ctx, { x: x + 12, y: y + h - 22, w: 74, h: 16, label: 'Attempt', hotkey: 'Enter', accent: PALETTE.goldGlow }, clicks, keys)) return glyphAttempt(state);
  if (!clue && button(ctx, { x: x + 92, y: y + h - 22, w: 88, h: 16, label: 'Intuit (Int)' }, clicks, keys)) { glyphIntuit(state); return false; }
  if (button(ctx, { x: x + w - 56, y: y + h - 22, w: 48, h: 16, label: 'Close' }, clicks, keys)) return true;
  return keys.includes('Escape');
}

function glyphAttempt(state) {
  const g = state.glyph;
  if (g.rotation.every((v, i) => v === g.correct[i])) {
    g.solved = true; awardXP(state, 2, 'glyph');
    logEvent(state, 'The glyphs align — the lock grinds open.');
    return true;
  }
  logEvent(state, 'The sequence is wrong. Something stirs.');
  tableIntrusion(state, { zone: 'Z3' }); // wrong-attempt intrusion
  return true;
}

function glyphIntuit(state) {
  // Intellect task diff 4, hindered by the numenera inability (effective 5,
  // target 15) — one background roll, reported in the feed.
  const audit = resolveTask({ base: 4, eases: [], hinders: [{ label: 'numenera inability', steps: 1 }], rng: state.rng });
  feedLine(state, audit.success ? 'the sequence surfaces like a memory' : 'the glyphs swim, meaningless',
    audit.success ? PALETTE.goldGlow : PALETTE.boneShadow);
  if (audit.success) { state.glyph.intuited = true; logEvent(state, 'The pattern resolves behind your eyes.'); }
  else logEvent(state, 'The glyphs stay meaningless.');
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

  // touch has no R key — rest & training live here too
  if (button(ctx, { x: x + 8, y: y + h - 22, w: 92, h: 16, label: 'Rest & Train', hotkey: 'KeyR', accent: PALETTE.goldGlow }, clicks, keys)) {
    openRestMenu(state); // swaps the sheet for the rest modal
    return false;
  }
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
  // height follows the text (the bonded shard can be talkative)
  const w = 232;
  const lines = wrapCount(ctx, m.text || '', w - 20) + (m.sub ? wrapCount(ctx, m.sub, w - 20) : 0);
  const h = Math.max(104, Math.min(190, 62 + lines * 11 + (m.sub ? 4 : 0)));
  const x = (BUF_W - w) / 2, y = (BUF_H - h) / 2;
  panel(ctx, x, y, w, h, m.title || m.kind);

  let cy = y + 26;
  cy = wrapText(ctx, m.text || '', x + 10, cy, w - 20, 11, { size: 8, color: PALETTE.boneLight });
  if (m.sub) cy = wrapText(ctx, m.sub, x + 10, cy + 4, w - 20, 11, { size: 8, color: PALETTE.rust });

  // Choice buttons (e.g. intrusion endure/defy); else a single Continue.
  if (m.choices && m.choices.length) {
    let bx = x + 10;
    for (let i = 0; i < m.choices.length; i++) {
      const c = m.choices[i];
      const bw = Math.min(96, Math.floor((w - 20) / m.choices.length) - 4);
      if (button(ctx, { x: bx, y: y + h - 22, w: bw, h: 16, label: c.label, hotkey: `Digit${i + 1}`, disabled: c.disabled, accent: c.accent }, clicks, keys)) {
        m.result = c.value;
        return true;
      }
      bx += bw + 4;
    }
    if (keys.includes('Escape')) { m.result = undefined; return true; }
    return false;
  }

  if (button(ctx, { x: x + w - 84, y: y + h - 22, w: 74, h: 16, label: 'Continue', hotkey: 'Enter' }, clicks, keys)) return true;
  // also dismiss on any interact key
  if (keys.includes('KeyE') || keys.includes('Space')) return true;
  return false;
}

// --- rest & training (Morrowind's "sleep to level," Numenera's four benefits) --
export function openRestMenu(state) {
  if (inCombat(state)) { feedLine(state, 'no rest — something hunts you', PALETTE.rust); return; }
  const canRest = state.player.restsUsed < 3;
  const canTrain = state.player.xp >= 4;
  state.prevMode = 'EXPLORE';
  state.mode = 'MODAL';
  document.exitPointerLock?.();
  state.modal = {
    kind: 'rest', title: 'a moment of stillness',
    text: 'The halls hold their breath. Mend the body, or turn what you have learned into strength.',
    sub: 'training costs 4 XP — four lessons make a tier',
    choices: [
      { label: 'Rest', value: 'rest', disabled: !canRest },
      { label: 'Train', value: 'train', disabled: !canTrain, accent: PALETTE.goldGlow },
      { label: 'Leave', value: 'leave' },
    ],
    onResolve: (v) => {
      if (v === 'rest') {
        const r = recover(state.player, KAVE.recovery, state.rng);
        state.player.armorPenalty = 0;
        feedLine(state, `you rest — recovered ${r.points}`, PALETTE.cyan);
        logEvent(state, `You rest. +${r.points} points.`);
      } else if (v === 'train') {
        openTrainMenu(state);
      }
    },
  };
}

function openTrainMenu(state) {
  const p = state.player;
  state.prevMode = 'EXPLORE';
  state.mode = 'MODAL';
  state.modal = {
    kind: 'train', title: 'training — toward the second tier',
    text: `${p.xp} XP held. Four lessons make a tier. What does Kave hone?`,
    choices: [
      { label: 'Pool +4', value: 'pool' },
      { label: 'Edge +1', value: 'edge' },
      { label: 'Effort', value: 'effort', disabled: p.effort >= 2 },
      { label: 'Sword', value: 'weapon', disabled: !!p.weaponTrained },
    ],
    onResolve: (kind) => {
      if (!kind) return;
      if (kind === 'pool' || kind === 'edge') { openStatPick(state, kind); return; }
      p.xp -= 4; p.xpSpent += 4;
      feedLine(state, applyBenefit(state, kind), PALETTE.goldGlow);
    },
  };
}

function openStatPick(state, kind) {
  state.prevMode = 'EXPLORE';
  state.mode = 'MODAL';
  state.modal = {
    kind: 'train', title: kind === 'pool' ? 'deepen which pool?' : 'sharpen which edge?',
    text: kind === 'pool' ? 'Four points, permanently.' : 'Every action of that kind costs less of you.',
    choices: [
      { label: 'Might', value: 'might' },
      { label: 'Speed', value: 'speed' },
      { label: 'Intellect', value: 'intellect' },
    ],
    onResolve: (stat) => {
      if (!stat) return;
      state.player.xp -= 4; state.player.xpSpent += 4;
      feedLine(state, applyBenefit(state, kind, stat), PALETTE.goldGlow);
    },
  };
}
