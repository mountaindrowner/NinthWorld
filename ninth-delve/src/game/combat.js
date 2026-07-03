// combat.js — REAL-TIME combat (the Morrowind pivot). No turn freeze, no modal
// tray: you swing in first person and the Cypher math resolves in the background.
// Every roll still surfaces honestly — as a line in the roll feed and a damage
// popup — it just never interrupts. Hold the swing for a heavy attack: that IS
// Effort (paid from Might, easing the roll), Cypher under Morrowind's skin.

import { CREATURES, armorVs } from '../data/creatures.js';
import { KAVE } from '../data/pregen_kave.js';
import { logEvent, requestWhisper, shake, flash, feedLine, addPopup } from './state.js';
import { applyDamage, payCost, abilityCost, effortCost, recover, isDead, isImpaired, isDebilitated } from './player.js';
import { tileDist, hasLOS, blockedAt, cellAt } from './world.js';
import { tableIntrusion } from './intrusions.js';
import { sfx } from '../engine/audio.js';
import { PALETTE } from '../engine/texgen.js';
import { resolveTask } from './dice.js';
import { CELL } from '../data/map_whisperlock.js';
import { overLimit } from './state.js';

const SWING_MS = 550, HEAVY_MS = 800;      // attack cooldowns
const REACH = 2.2;                          // melee reach in tiles (a broadsword is long)
const ARC = Math.PI / 2.8;                  // swing arc half-angle
const LEASH = 7;                            // disengage beyond aggro + this

// per-creature realtime tuning: move speed (tiles/s), attack cooldown (ms), reach
const RT = {
  laak: { speed: 2.4, cd: 1200, reach: 1.0 },
  hound: { speed: 3.0, cd: 1500, reach: 1.1 },
  murden: { speed: 2.2, cd: 1800, reach: 1.1 },
  abykos: { speed: 1.5, cd: 2200, reach: 1.3 },
};

const engagedCreatures = (state) => state.entities.filter((e) => e.kind === 'creature' && e.alive && !e.hidden && e.engaged);
export const inCombat = (state) => engagedCreatures(state).length > 0;

/** Intrusion odds: nat 1, or nat 1–2 while over the cypher limit (Rules §9). */
const intrusionTriggered = (state, audit) =>
  audit.natural === 1 || (overLimit(state) && audit.natural === 2);

// The message log speaks plain Morrowind ("you strike / your swing goes wide");
// the Cypher rolls stay entirely under the hood.

// ---------------------------------------------------------------------------
// player swing
// ---------------------------------------------------------------------------

/**
 * Swing the broadsword. heavy = held attack → Effort 1 on the roll, paid from
 * Might (Rules §2). Resolves vs every living creature inside reach + arc
 * (usually one). All math goes to the roll feed; nothing blocks.
 */
export function playerSwing(state, heavy = false) {
  const p = state.player;
  if (state.t < (p.swingCooldownUntil || 0) || isDebilitated(p) || isDead(p)) return;
  p.swingCooldownUntil = state.t + (heavy ? HEAVY_MS : SWING_MS);
  p.swingT0 = state.t; p.swingHeavy = heavy;   // viewmodel animation
  p.swingCombo = ((p.swingCombo || 0) + 1);    // alternating cut animation
  sfx.swing?.();

  // Effort on the heavy swing — costs Might, eases the roll. Free if broke.
  let effortLevels = 0;
  if (heavy) {
    const cost = effortCost(1, { edge: p.edge.might, impaired: isImpaired(p) });
    if (p.pools.might > cost && payCost(p, 'might', cost)) effortLevels = 1;
    else feedLine(state, 'too drained for a heavy swing', PALETTE.rust);
  }

  const target = pickTarget(state);
  if (!target) { feedLine(state, 'swing — nothing in reach', PALETTE.boneShadow); return; }

  const def = CREATURES[target.creatureId];
  const eases = [];
  if (p.aggression) eases.push('Aggr');
  if (state.t < (p.stimUntil || 0)) eases.push('Stim');
  const audit = resolveTask({
    base: def.level,
    eases: eases.map((l) => ({ label: l, steps: 1 })),
    effortLevels,
    hinders: [],
    rng: state.rng, impaired: isImpaired(p),
  });

  if (intrusionTriggered(state, audit)) {
    feedLine(state, `you overreach — something gives`, PALETTE.blood);
    tableIntrusion(state, { creature: target.creatureId, zone: target.zone });
    return;
  }
  if (!audit.success) {
    feedLine(state, `your swing goes wide of the ${def.name}`, PALETTE.boneShadow);
    addPopup(state, target.x, target.y, 'miss', PALETTE.boneShadow);
    return;
  }

  // damage: weapon + bonuses + specials (auto-resolved, still reported)
  let dmg = KAVE.weapons.broadsword.damage + p.weaponBonus;
  let note = '';
  const sp = audit.special;
  if (sp.tier === '17' || sp.tier === '18') { dmg += sp.bonusDamage; note = ` +${sp.bonusDamage}!`; }
  else if (sp.tier === '19') { dmg += 3; note = ' minor!'; knockback(state, target); }
  else if (sp.tier === '20') { dmg += 4; note = ' MAJOR!'; target.stunUntil = state.t + 1800; }
  const armor = armorVs(def, 'physical');
  dmg = Math.max(0, dmg - armor);

  target.hp -= dmg;
  target.engaged = true;
  poseFrame(state, target, target.F?.hit ?? 3, 260);
  sfx.hit(); shake(state, 1, 70);
  addPopup(state, target.x, target.y, String(dmg), PALETTE.goldGlow);
  feedLine(state, `you strike the ${def.name} — ${dmg}${note}`, PALETTE.cyan);
  if (target.hp <= 0) killCreature(state, target);
}

/** Nearest living creature inside reach and the frontal arc. */
function pickTarget(state) {
  const p = state.player;
  let best = null, bestD = REACH;
  for (const e of state.entities) {
    if (e.kind !== 'creature' || !e.alive || e.hidden) continue;
    const d = tileDist(p.x, p.y, e.x, e.y);
    if (d > bestD) continue;
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    let da = ang - p.angle;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    if (Math.abs(da) > ARC) continue;
    best = e; bestD = d;
  }
  return best;
}

function knockback(state, e) {
  const p = state.player;
  const ang = Math.atan2(e.y - p.y, e.x - p.x);
  const nx = e.x + Math.cos(ang) * 1.2, ny = e.y + Math.sin(ang) * 1.2;
  if (!creatureBlocked(state, e, nx, ny)) { e.x = nx; e.y = ny; }
}

function killCreature(state, e) {
  e.alive = false;
  state.stats.kills += 1;
  const def = CREATURES[e.creatureId];
  // death pose plays briefly, then the corpse settles on its final frame
  poseFrame(state, e, e.F?.deathA ?? e.F?.dead ?? 4, 450);
  feedLine(state, `the ${def.name} falls`, PALETTE.goldGlow);
  logEvent(state, `The ${def.name} falls.`);
  if (state.stats.kills === 1) requestWhisper(state, 'kill');
  if (e.stolen) { // murden drops what it snatched
    state.entities.push({ uid: 9e6 + e.uid, kind: 'pickup', ptype: 'cypher', sprite: 'pickup_cypher', x: e.x, y: e.y, cypher: e.stolen });
    e.stolen = null;
    logEvent(state, 'It drops what it stole.');
  }
}

// ---------------------------------------------------------------------------
// creature AI + attacks (per frame)
// ---------------------------------------------------------------------------

/** Real-time creature update: aggro, chase, attack, leash. Call every frame. */
export function updateCombat(state, dt) {
  const p = state.player;
  if (isDead(p)) return;

  for (const e of state.entities) {
    if (e.kind !== 'creature' || !e.alive || e.hidden) continue;
    const def = CREATURES[e.creatureId];
    const rt = RT[e.creatureId] || RT.laak;
    const d = tileDist(p.x, p.y, e.x, e.y);

    // engage / leash
    if (!e.engaged) {
      if (d <= e.aggro && hasLOS(state, e.x, e.y, p.x, p.y)) {
        e.engaged = true;
        if (e.creatureId === 'abykos') { requestWhisper(state, 'boss'); e.nextDrain = state.t + 4000; }
        feedLine(state, `the ${def.name} has noticed you`, PALETTE.rust);
      } else {
        // drift home
        const hd = tileDist(e.x, e.y, e.home.x, e.home.y);
        if (hd > 0.4) stepToward(state, e, e.home.x, e.home.y, rt.speed * 0.5 * dt);
        continue;
      }
    }
    if (e.engaged && d > e.aggro + LEASH) { e.engaged = false; continue; }
    if (state.t < (e.stunUntil || 0)) continue;

    // Abykos: the Drain on a timer while engaged; repositions if you hug it
    if (e.creatureId === 'abykos') {
      if (state.t >= (e.nextDrain || 0) && p.cyphers.length) {
        sfx.drain();
        poseFrame(state, e, e.F.drain, 900); // arms spread, gold pulled inward
        addPopup(state, e.x, e.y, 'drain', PALETTE.goldGlow);
        drainTick(state);
        e.nextDrain = state.t + 9000;
      }
      if (d < 1.0) {
        e.hugTime = (e.hugTime || 0) + dt * 1000;
        if (e.hugTime > 2200) { e.hugTime = 0; blinkAway(state, e); }
      } else e.hugTime = 0;
    }

    // murden: pelts you with stones from range (its throw frame earns its keep)
    if (def.ranged && d > rt.reach && d <= def.ranged.range
      && state.t >= (e.nextThrow || 0) && hasLOS(state, e.x, e.y, p.x, p.y)) {
      e.nextThrow = state.t + def.ranged.cd;
      enemyStrike(state, e, def, { ranged: true });
    }

    // movement — each creature closes differently:
    if (def.ranged && d < 3.5) {
      // murden is a skirmisher: it backs off to throwing range (knives you only
      // when cornered — the retreat step fails against a wall). It retreats
      // FACING you — you back a murden off, you never turn it around.
      stepToward(state, e, e.x * 2 - p.x, e.y * 2 - p.y, rt.speed * 0.8 * dt);
      e.heading = Math.atan2(p.y - e.y, p.x - e.x);
    } else if (d > rt.reach * 0.85) {
      let tx = p.x, ty = p.y;
      if (e.creatureId === 'laak') { // skitter: zigzag approach
        const ph = Math.sin(state.t / 140 + e.uid * 3);
        const side = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
        tx += Math.cos(side) * ph * 1.1; ty += Math.sin(side) * ph * 1.1;
      }
      stepToward(state, e, tx, ty, rt.speed * dt, e.creatureId === 'hound');
      // mid-wall the hound is elsewhere: show its static-white phase frame
      if (e.creatureId === 'hound' && cellAt(Math.floor(e.x), Math.floor(e.y)) === CELL.SECRET) {
        poseFrame(state, e, e.F.phase, 140);
      }
    }

    // in reach it squares up to you (directional sprite shows its face)
    if (e.engaged && d <= rt.reach * 1.2) e.heading = Math.atan2(p.y - e.y, p.x - e.x);

    // attack when in reach and off cooldown
    if (d <= rt.reach && state.t >= (e.nextAttack || 0) && hasLOS(state, e.x, e.y, p.x, p.y)) {
      e.nextAttack = state.t + rt.cd;
      enemyStrike(state, e, def);
    }
  }

  if (isDead(p)) { state.reportReason = 'defeat'; state.mode = 'REPORT'; logEvent(state, 'You fall in the dark.'); }
}

/** One enemy attack = one background player defense roll (you still roll everything). */
function enemyStrike(state, e, def, { ranged = false } = {}) {
  const p = state.player;
  const touch = !ranged && def.special.includes('might_touch');
  const stat = touch ? 'might' : 'speed';
  poseFrame(state, e, ranged ? e.F.throw : (e.F.atk ?? 2), 320);
  const label = ranged ? `${def.name} (stone)` : def.name;

  const eases = [];
  if (!touch) eases.push({ label: 'shield', steps: 1 });
  if (touch && KAVE.skills.mightDefense === 'trained') eases.push({ label: 'trained', steps: 1 });
  if (state.t < (p.stimUntil || 0)) eases.push({ label: 'Stim', steps: 1 });
  const hinders = [];
  if (p.aggression) hinders.push({ label: 'Aggr', steps: 1 });
  if (p.nextDefenseHinder) { hinders.push({ label: 'phased', steps: 1 }); p.nextDefenseHinder = false; }
  const laaksNear = state.entities.filter((c) => c.kind === 'creature' && c.alive && c.creatureId === 'laak' && tileDist(p.x, p.y, c.x, c.y) < 4).length;
  if (e.creatureId === 'laak' && laaksNear >= 2) hinders.push({ label: 'skitter', steps: 1 });

  const audit = resolveTask({ base: def.level, eases, hinders, rng: state.rng, impaired: isImpaired(p) });

  if (audit.success) {
    feedLine(state, `you evade the ${label}`, PALETTE.cyan);
    if (audit.special.tier === '20') { e.stunUntil = state.t + 1500; feedLine(state, `you turn it aside — the ${def.name} reels`, PALETTE.goldGlow); }
    return;
  }

  // hit taken — phase-lunge ignores Armor (Appendix REQUIRED); a thrown stone
  // always finds a gap for at least 1 (harassment, not artillery)
  const ignoresArmor = !ranged && def.special.includes('phase_lunge');
  const armor = ignoresArmor ? 0 : Math.max(0, p.armor - p.armorPenalty);
  const dmg = ranged ? Math.max(1, def.ranged.damage - armor) : Math.max(0, def.damage - armor);
  applyDamage(p, dmg);
  sfx.hurt(); shake(state, 2, 130); flash(state, PALETTE.blood, 150);
  feedLine(state, `the ${label} hits you — ${dmg}${ignoresArmor ? ' (through armor)' : ''}`, PALETTE.blood);

  if (intrusionTriggered(state, audit)) creatureIntrusion(state, e, def);
}

/** Creature intrusions on a fumbled defense (nat 1 / over-limit 1–2). */
function creatureIntrusion(state, e, def) {
  const p = state.player;
  if (e.creatureId === 'murden' && p.cyphers.length) {
    const i = Math.floor(state.rng() * p.cyphers.length);
    e.stolen = p.cyphers.splice(i, 1)[0];
    e.engaged = false; // snatch-and-flee: it bolts for home with your cypher
    feedLine(state, `the murden SNATCHES your ${e.stolen.identified ? e.stolen.trueName : 'cypher'} and bolts!`, PALETTE.rust);
  } else if (e.creatureId === 'hound') {
    p.nextDefenseHinder = true;
    feedLine(state, 'the hound phases behind you — next defense hindered', PALETTE.rust);
  } else if (e.creatureId === 'abykos') {
    applyDamage(p, 2);
    feedLine(state, 'static crawls the armor straps — 2 Might drained', PALETTE.rust);
  } else {
    tableIntrusion(state, { creature: e.creatureId, zone: e.zone });
  }
}

function drainTick(state) {
  // avoid a circular import: cyphers.js also imports from here? (it doesn't — safe)
  const p = state.player;
  if (!p.cyphers.length) return;
  const i = Math.floor(state.rng() * p.cyphers.length);
  const cy = p.cyphers[i];
  cy.level -= 1;
  if (cy.level <= 0) {
    p.cyphers.splice(i, 1);
    feedLine(state, `the Abykos drinks your ${cy.identified ? cy.trueName : 'cypher'} to NOTHING`, PALETTE.rust);
  } else {
    feedLine(state, 'it drinks what you carry — a cypher weakens', PALETTE.rust);
  }
}

function blinkAway(state, e) {
  // phase across the room: try a few spots ~4 tiles out
  for (let i = 0; i < 8; i++) {
    const a = state.rng() * Math.PI * 2;
    const nx = e.x + Math.cos(a) * 4, ny = e.y + Math.sin(a) * 4;
    if (!creatureBlocked(state, e, nx, ny)) {
      e.x = nx; e.y = ny;
      poseFrame(state, e, 2, 300);
      feedLine(state, 'the Abykos phases across the room', PALETTE.mauve);
      return;
    }
  }
}

// simple slide movement for creatures (hound may pass secret/phase walls)
function creatureBlocked(state, e, x, y, ghostly = false) {
  const r = 0.28;
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
    const cx = Math.floor(x + ox), cy = Math.floor(y + oy);
    if (ghostly && cellAt(cx, cy) === CELL.SECRET) continue; // hound den phasing
    if (blockedAt(state, cx, cy)) return true;
  }
  return false;
}

function stepToward(state, e, tx, ty, step, ghostly = false) {
  const ang = Math.atan2(ty - e.y, tx - e.x);
  e.heading = ang; // directional sprites read this
  const dx = Math.cos(ang) * step, dy = Math.sin(ang) * step;
  if (!creatureBlocked(state, e, e.x + dx, e.y, ghostly)) e.x += dx;
  if (!creatureBlocked(state, e, e.x, e.y + dy, ghostly)) e.y += dy;
}

function poseFrame(state, ent, idx, ms = 220) { ent.frame = idx; ent.frameUntil = state.t + ms; }

// ---------------------------------------------------------------------------
// rest + stance (explore verbs that used to be combat menu actions)
// ---------------------------------------------------------------------------

/** R: rest — a recovery roll from the daily sequence. Not while hunted. */
export function tryRest(state) {
  const p = state.player;
  if (inCombat(state)) { feedLine(state, 'no rest — something hunts you', PALETTE.rust); return; }
  if (p.restsUsed >= 3) { feedLine(state, 'no rest slots left before a long sleep', PALETTE.rust); return; }
  const r = recover(p, KAVE.recovery, state.rng);
  p.armorPenalty = 0; // a strapped-down rest re-cinches the armor
  feedLine(state, `rest (${KAVE.restSequence[p.restsUsed - 1] || ''}) — recovered ${r.points}`, PALETTE.cyan);
  logEvent(state, `You rest. +${r.points} points.`);
}

/** F: toggle Aggression stance (2 Might −Edge; eases attacks, hinders defenses). */
export function toggleAggression(state) {
  const p = state.player;
  if (!p.aggression) {
    if (!payCost(p, 'might', abilityCost(KAVE.fightingMoves.aggression.cost.might, p.edge.might))) {
      feedLine(state, 'not enough Might for Aggression', PALETTE.rust); return;
    }
    p.aggression = true;
    feedLine(state, 'AGGRESSION — attacks eased, defenses hindered', PALETTE.gold);
  } else {
    p.aggression = false;
    feedLine(state, 'you drop the aggressive stance', PALETTE.boneShadow);
  }
}
