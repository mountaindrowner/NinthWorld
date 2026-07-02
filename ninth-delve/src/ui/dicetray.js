// The dice tray (GDD pillar #1): every roll shows its base difficulty, each
// modifier chip, the final target, an animated d20, and the outcome — and lets
// the player spend Effort (with a live cost preview) and reroll for 1 XP.
// Drives a small state machine on state.tray; combat opens it and reads the
// resolved audit back through onResolve.

import { PALETTE } from '../engine/texgen.js';
import { panel, text, button } from './widgets.js';
import { resolveTask } from '../game/dice.js';
import { effortCost, payCost, isImpaired } from '../game/player.js';
import { sfx } from '../engine/audio.js';

const BUF_W = 320, BUF_H = 200;
const ROLL_MS = 650;

/**
 * Open a roll. spec: { label, base, eases:[{label,steps}], hinders:[{label,steps}],
 * stat:'might'|'speed'|'intellect', maxEffort, allowReroll, defense?:boolean }.
 * onResolve(audit) fires when the player commits the result.
 */
export function openTray(state, spec, onResolve) {
  state.tray = {
    spec, onResolve,
    returnMode: state.mode,
    stat: spec.stat || 'might',
    isSpeed: (spec.stat || 'might') === 'speed',
    effort: 0,
    maxEffort: Math.min(spec.maxEffort ?? state.player.effort, state.player.effort),
    phase: 'choose',   // choose → rolling → result
    rollT: 0,
    audit: null,
    frame: 0,
    cost: 0,
    chosen: null,
    allowReroll: spec.allowReroll !== false,
  };
  state.mode = 'ROLL';
}

/** Live Effort cost preview for a level (Rules §2). */
function costFor(state, levels) {
  const p = state.player;
  return effortCost(levels, {
    edge: p.edge[state.tray.stat], isSpeed: state.tray.isSpeed,
    speedSurcharge: p.speedSurcharge, impaired: isImpaired(p),
  });
}

function previewTarget(state) {
  const t = state.tray, s = t.spec;
  const ease = s.eases.reduce((a, c) => a + c.steps, 0) + t.effort;
  const hind = s.hinders.reduce((a, c) => a + c.steps, 0);
  const diff = Math.max(0, Math.min(10, s.base - ease + hind));
  return { diff, target: diff * 3 };
}

export function updateTray(state, dt) {
  const t = state.tray;
  if (!t) return;
  if (t.phase === 'rolling') {
    t.rollT += dt * 1000;
    t.frame = Math.floor(t.rollT / 45) % 12;
    if (t.rollT >= ROLL_MS) { t.phase = 'result'; buildResult(state); }
  }
}

function doRoll(state) {
  const t = state.tray, p = state.player;
  t.cost = costFor(state, t.effort);
  payCost(p, t.stat, t.cost); // affordability guaranteed by disabled + button
  t.audit = resolveTask({
    base: t.spec.base, eases: t.spec.eases, effortLevels: t.effort,
    hinders: t.spec.hinders, rng: state.rng, impaired: isImpaired(p),
  });
  sfx.dice();
  if (t.audit.auto) { t.phase = 'result'; buildResult(state); }
  else { t.phase = 'rolling'; t.rollT = 0; }
}

function reroll(state) {
  const t = state.tray, p = state.player;
  if (p.xp <= 0) return;
  p.xp -= 1; p.xpSpent += 1; state.stats.rerolls += 1;
  const prev = t.audit;
  const next = resolveTask({
    base: t.spec.base, eases: t.spec.eases, effortLevels: t.effort,
    hinders: t.spec.hinders, rng: state.rng, impaired: isImpaired(p),
  });
  // take the better outcome (success beats failure; else higher natural)
  const better = (next.success && !prev.success)
    || (next.success === prev.success && (next.natural ?? 0) >= (prev.natural ?? 0));
  t.audit = better ? next : prev;
  t.frame = 0; t.chosen = null; buildResult(state);
}

function buildResult(state) {
  const t = state.tray, a = t.audit;
  t.banner = a.success ? 'SUCCESS' : 'FAILURE';
  t.choices = null;
  const eff = a.special?.effect;
  if (a.success && eff === 'minor') t.choices = [
    { label: '+3 dmg', value: 'damage' }, { label: 'Knockback', value: 'knockback' }, { label: 'Distract', value: 'distract' }];
  else if (a.success && eff === 'major') t.choices = [
    { label: '+4 dmg', value: 'damage' }, { label: 'Knockdown', value: 'knockdown' }, { label: 'Stun', value: 'stun' }];
}

function finalize(state) {
  const t = state.tray;
  t.audit.specialChoice = t.chosen;
  const cb = t.onResolve, audit = t.audit, mode = t.returnMode;
  state.tray = null;
  state.mode = mode;
  cb?.(audit);
}

// --- rendering ---------------------------------------------------------------

function chip(ctx, x, y, label, kind) {
  const col = kind === 'ease' ? PALETTE.cyan : kind === 'hinder' ? PALETTE.rust : PALETTE.steelLight;
  ctx.font = '8px monospace'; ctx.textAlign = 'left';
  const w = ctx.measureText(label).width + 8;
  ctx.fillStyle = PALETTE.deepSteel; ctx.fillRect(x, y, w, 12);
  ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 11);
  ctx.fillStyle = PALETTE.boneLight; ctx.fillText(label, x + 4, y + 9);
  return x + w + 4;
}

export function drawTray(ctx, state, clicks, keys, assets) {
  const t = state.tray;
  if (!t) return;
  const w = 268, h = 130, x = (BUF_W - w) / 2, y = 26;
  panel(ctx, x, y, w, h, t.spec.label || 'task');

  // chip row
  const pv = previewTarget(state);
  let cx = x + 8; const cy = y + 20;
  cx = chip(ctx, cx, cy, `diff ${t.spec.base}`, 'base');
  for (const e of t.spec.eases) cx = chip(ctx, cx, cy, `${e.label} −${e.steps}`, 'ease');
  if (t.effort > 0) cx = chip(ctx, cx, cy, `Effort ${t.effort} −${t.effort}`, 'ease');
  for (const hnd of t.spec.hinders) cx = chip(ctx, cx, cy, `${hnd.label} +${hnd.steps}`, 'hinder');

  // target
  text(ctx, `target ${pv.target}${pv.diff === 0 ? '  (auto)' : ''}`, x + 8, y + 46, { color: PALETTE.goldGlow, size: 8 });

  // d20 + result
  const die = assets.d20_strip;
  const dieX = x + w - 44, dieY = y + 30;
  if (die) ctx.drawImage(die.frames[t.frame % die.frames.length], dieX, dieY, 32, 32);
  if (t.phase === 'result' && t.audit && !t.audit.auto) {
    text(ctx, String(t.audit.natural), dieX + 16, dieY + 21, { color: PALETTE.boneLight, size: 14, align: 'center' });
  }

  if (t.phase === 'choose') drawChoose(ctx, state, clicks, keys, pv);
  else if (t.phase === 'result') drawResult(ctx, state, clicks, keys, x, y, w, h);
}

function drawChoose(ctx, state, clicks, keys, pv) {
  const t = state.tray, p = state.player;
  const w = 268, x = (BUF_W - w) / 2, y = 26;
  const cost = costFor(state, t.effort);
  text(ctx, `Effort ${t.effort}/${t.maxEffort}`, x + 8, y + 66, { size: 8, color: PALETTE.cyan });
  text(ctx, `cost ${cost} ${t.stat} (${p.pools[t.stat]} left)`, x + 70, y + 66, { size: 8, color: PALETTE.boneShadow });

  const canMore = t.effort < t.maxEffort && costFor(state, t.effort + 1) <= p.pools[t.stat];
  if (button(ctx, { x: x + 8, y: y + 74, w: 22, h: 16, label: '−', hotkey: 'Digit1' }, clicks, keys) && t.effort > 0) t.effort--;
  if (button(ctx, { x: x + 34, y: y + 74, w: 22, h: 16, label: '+', hotkey: 'Digit2', disabled: !canMore }, clicks, keys)) t.effort++;
  if (button(ctx, { x: x + 70, y: y + 74, w: 80, h: 16, label: 'ROLL', hotkey: 'Enter', accent: PALETTE.goldGlow }, clicks, keys)) doRoll(state);
}

function drawResult(ctx, state, clicks, keys, x, y, w, h) {
  const t = state.tray, a = t.audit;
  const col = a.success ? PALETTE.cyan : PALETTE.blood;
  text(ctx, t.banner, x + 8, y + 66, { size: 12, color: col });
  if (a.special?.tier && a.special.tier !== null) {
    const st = a.special;
    const label = st.tier === '1' ? 'natural 1 — intrusion'
      : st.effect ? `natural ${st.tier} — ${st.effect} effect`
      : `natural ${st.tier} — +${st.bonusDamage} dmg`;
    text(ctx, label, x + 8, y + 80, { size: 8, color: PALETTE.goldGlow });
  }

  let by = y + h - 22;
  if (t.choices) {
    let bx = x + 8;
    for (let i = 0; i < t.choices.length; i++) {
      const c = t.choices[i];
      if (button(ctx, { x: bx, y: by, w: 74, h: 16, label: c.label, hotkey: `Digit${i + 1}` }, clicks, keys)) { t.chosen = c.value; finalize(state); return; }
      bx += 78;
    }
    return;
  }
  if (t.allowReroll && state.player.xp > 0
    && button(ctx, { x: x + 8, y: by, w: 96, h: 16, label: `Reroll (1 XP)`, hotkey: 'Digit3', accent: PALETTE.gold }, clicks, keys)) { reroll(state); return; }
  if (button(ctx, { x: x + w - 84, y: by, w: 74, h: 16, label: 'Continue', hotkey: 'Enter' }, clicks, keys)) finalize(state);
}
