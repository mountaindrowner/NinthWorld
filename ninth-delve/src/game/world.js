// World: map access + the M0 connectivity flood-fill test.
// Grows in M1+ (collision, LOS, doors, triggers). For now it owns the map grid
// helpers and the door/key connectivity proof required by the build plan.

import {
  MAP, MAP_W, MAP_H, CELL, PLACEMENTS, ZONES, MURALS, DOORS, EXIT_GATE,
} from '../data/map_whisperlock.js';
import { ODDITIES, ARTIFACT } from '../data/cyphers_oddities.js';
import { awardXP, logEvent, overLimit, requestWhisper, feedLine } from './state.js';
import { visiblePickups } from './entities.js';
import { applyDamage } from './player.js';
import { resolveTask } from './dice.js';
import { tableIntrusion, scriptedIntrusion, queueScripted } from './intrusions.js';
import { sfx } from '../engine/audio.js';
import { PALETTE } from '../engine/texgen.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const keyOf = (x, y) => y * MAP_W + x;

/** @returns {string} legend char at cell, or '#' out of bounds. */
export function cellAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return CELL.WALL;
  return MAP[y][x];
}

// --- M1 rendering + movement helpers ----------------------------------------

// Cells the raycaster draws as a full-height wall slice. Doors/lock render as
// closed door panels; pillars and secret/phase walls are opaque.
const RENDER_SOLID = new Set([CELL.WALL, ' ', CELL.PILLAR, CELL.SECRET, CELL.DOOR, CELL.LOCK]);
/** @returns {boolean} does a ray stop at this cell? */
export function isRenderSolid(x, y) { return RENDER_SOLID.has(cellAt(x, y)); }

// Cells that block movement. In M1 doors (open-logic is M2) and the chasm
// (crossing is M6) are passable so the whole layout is walkable for the perf
// and texture pass; only true walls, pillars, and secret/phase walls block.
const BLOCKING = new Set([CELL.WALL, ' ', CELL.PILLAR, CELL.SECRET]);
export function isBlocking(x, y) { return BLOCKING.has(cellAt(x, y)); }

/** @returns {string|null} zone id for a cell (first matching rect). */
export function zoneAt(x, y) {
  for (const z of ZONES) if (x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2) return z.id;
  return null;
}

const MURAL_SET = new Set(MURALS.map(([x, y]) => keyOf(x, y)));
/** Asset key for a wall cell (Asset §2 per-zone mapping). */
export function wallTextureKey(x, y) {
  const c = cellAt(x, y);
  if (c === CELL.PILLAR) return 'pillar_glyph';
  if (c === CELL.DOOR) return 'door_slide';
  if (c === CELL.LOCK) return 'door_glyph';
  if (c === CELL.SECRET) return 'wall_scuffed';
  // the wall the exit gate is set into reads as the great glyph seal
  if (x === EXIT_GATE.x && y === EXIT_GATE.y - 1) return 'door_glyph';
  if (MURAL_SET.has(keyOf(x, y))) return 'wall_mural';
  const z = zoneAt(x, y);
  if (z === 'Z2') return 'wall_warren';
  if (z === 'Z4' || z === 'Z5') return 'wall_conduit';
  return 'wall_synth';
}

// --- M2: doors, state-aware solidity, interaction --------------------------

const OPEN_DIST = 1.9;   // door auto-opens within this range (tiles)
const DOOR_SPEED = 4;    // slide fraction per second (≈0.25 s open/close)

/** Which S cells open by bump-search (guard a sealed:'bump' placement). */
const BUMP_SECRETS = new Set();
for (const p of PLACEMENTS) {
  if (p.sealed !== 'bump') continue;
  for (const [dx, dy] of N4) if (cellAt(p.x + dx, p.y + dy) === CELL.SECRET) BUMP_SECRETS.add(keyOf(p.x + dx, p.y + dy));
}

/** Door slide fraction 0..1 (0 closed). L follows the glyph solve. */
export function doorSlide(state, x, y) {
  const c = cellAt(x, y);
  if (c === CELL.LOCK) return state.glyph.solved ? 1 : 0;
  if (c !== CELL.DOOR) return 0;
  return state.doors[keyOf(x, y)]?.t ?? 0;
}

/** Does a ray stop here, accounting for opened doors/secrets? */
export function renderSolidAt(state, x, y) {
  const c = cellAt(x, y);
  if (c === CELL.SECRET && state.secretsFound.has(keyOf(x, y))) return false;
  if (c === CELL.DOOR && doorSlide(state, x, y) >= 1) return false;
  if (c === CELL.LOCK && state.glyph.solved) return false;
  return isRenderSolid(x, y);
}

/** Movement blocking (state-aware): doors block until half-open, chasm until crossing. */
export function blockedAt(state, x, y) {
  if (state.phasedCells.has(keyOf(x, y))) return false; // Phase Disruptor opened it
  const c = cellAt(x, y);
  if (c === CELL.WALL || c === ' ' || c === CELL.PILLAR) return true;
  if (c === CELL.SECRET) return !state.secretsFound.has(keyOf(x, y));
  if (c === CELL.DOOR) return doorSlide(state, x, y) < 0.5;
  if (c === CELL.LOCK) return !state.glyph.solved;
  if (c === CELL.CHASM) return !state.player.crossing;
  return false;
}

/**
 * Phase Disruptor (C5): open the solid/secret cell directly in front so the
 * player can step through one wall. Reveals loot behind a phase-sealed vault.
 * @returns {boolean} whether a wall was phased
 */
export function phaseFront(state) {
  const p = state.player;
  const fx = Math.floor(p.x + Math.cos(p.angle) * 0.9);
  const fy = Math.floor(p.y + Math.sin(p.angle) * 0.9);
  const c = cellAt(fx, fy);
  if (c !== CELL.WALL && c !== CELL.SECRET && c !== CELL.PILLAR) return false;
  state.phasedCells.add(keyOf(fx, fy));
  if (c === CELL.SECRET) {
    state.secretsFound.add(keyOf(fx, fy));
    const placement = PLACEMENTS.find((pl) => pl.sealed === 'phase' && Math.abs(pl.x - fx) + Math.abs(pl.y - fy) === 1);
    if (placement) {
      for (const e of state.entities) if (e.group === placement.id) e.hidden = false;
      awardXP(state, 2, `secret:${placement.id}`);
      state.stats.secrets += 1;
      requestWhisper(state, 'vault');
    }
  }
  return true;
}

/**
 * Move the player by (dx,dy) with circle-slide collision (r=0.3), axes resolved
 * independently so we slide along walls instead of clipping corners.
 */
export function moveWithCollision(state, p, dx, dy) {
  const r = 0.3;
  const blocked = (fx, fy) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      if (blockedAt(state, Math.floor(fx + ox), Math.floor(fy + oy))) return true;
    }
    return false;
  };
  if (!blocked(p.x + dx, p.y)) p.x += dx;
  if (!blocked(p.x, p.y + dy)) p.y += dy;
}

/** Animate doors: auto-open within range, slide closed otherwise. */
export function updateDoors(state, dt) {
  for (const [x, y] of DOORS) {
    const k = keyOf(x, y);
    const d = state.doors[k] || (state.doors[k] = { t: 0 });
    const near = Math.hypot(state.player.x - (x + 0.5), state.player.y - (y + 0.5)) < OPEN_DIST;
    const target = near ? 1 : 0;
    const before = d.t;
    if (d.t < target) d.t = Math.min(1, d.t + DOOR_SPEED * dt);
    else if (d.t > target) d.t = Math.max(0, d.t - DOOR_SPEED * dt);
    if (before < 0.5 && d.t >= 0.5) sfx.door(); // just slid open
  }
}

/** Compass label for a facing angle. */
export function facingLabel(angle) {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  if (a < Math.PI / 4 || a >= (7 * Math.PI) / 4) return 'E';
  if (a < (3 * Math.PI) / 4) return 'S';
  if (a < (5 * Math.PI) / 4) return 'W';
  return 'N';
}

/** Distance in tiles between two points. */
export const tileDist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);

/**
 * Fog-of-war memory for the minimap: mark cells the player can currently see
 * (radius ~3.6, LOS-checked; walls count if their near face is visible).
 */
export function updateSeen(state) {
  const p = state.player;
  const px = Math.floor(p.x), py = Math.floor(p.y);
  const seen = (state.seen ||= new Set());
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      if (Math.hypot(dx, dy) > 4.2) continue;
      const x = px + dx, y = py + dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const k = keyOf(x, y);
      if (seen.has(k)) continue;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) { seen.add(k); continue; }
      // aim at a point pulled toward the player so wall faces register
      const cx = x + 0.5, cy = y + 0.5;
      const vx = cx - p.x, vy = cy - p.y;
      const len = Math.hypot(vx, vy) || 1;
      const t = Math.max(0, (len - 0.7) / len);
      if (hasLOS(state, p.x, p.y, p.x + vx * t, p.y + vy * t)) seen.add(k);
    }
  }
}

/**
 * Can the player see the face of a wall cell (mural etc.)? Aims at a point
 * pulled toward the viewer so the ray never samples inside the target cell —
 * hasLOS straight to a wall cell's center always self-blocks.
 */
export function canSeeWallFace(state, cx, cy, maxDist = 2.4) {
  const p = state.player;
  const tx = cx + 0.5, ty = cy + 0.5;
  const vx = tx - p.x, vy = ty - p.y;
  const len = Math.hypot(vx, vy);
  if (len > maxDist) return false;
  const t = Math.max(0, (len - 0.75) / len);
  return hasLOS(state, p.x, p.y, p.x + vx * t, p.y + vy * t);
}

/**
 * Line-of-sight between two points: march the segment; blocked by any wall or
 * closed door/lock (Tech §4). Chasm and open doors don't block sight.
 */
export function hasLOS(state, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const steps = Math.ceil(Math.hypot(dx, dy) / 0.1);
  for (let i = 1; i < steps; i++) {
    const x = x1 + (dx * i) / steps, y = y1 + (dy * i) / steps;
    const c = cellAt(Math.floor(x), Math.floor(y));
    if (c === CELL.WALL || c === ' ' || c === CELL.PILLAR) return false;
    if (c === CELL.SECRET && !state.secretsFound.has(keyOf(Math.floor(x), Math.floor(y)))) return false;
    if (c === CELL.DOOR && doorSlide(state, Math.floor(x), Math.floor(y)) < 0.5) return false;
    if (c === CELL.LOCK && !state.glyph.solved) return false;
  }
  return true;
}

/** Cell directly in front of the player (for interact). */
function frontCell(p) {
  const fx = p.x + Math.cos(p.angle) * 0.9;
  const fy = p.y + Math.sin(p.angle) * 0.9;
  return [Math.floor(fx), Math.floor(fy)];
}

/**
 * E-interact: collect the nearest pickup, else bump-search a scuffed wall ahead.
 * @returns {?Object} a modal descriptor for main.js, or null if nothing happened.
 */
export function interact(state) {
  const p = state.player;
  // nearest collectable pickup
  let best = null, bestD = 0.9 * 0.9;
  for (const e of visiblePickups(state)) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < bestD) { bestD = d; best = e; }
  }
  if (best) return collectPickup(state, best);

  const [fx, fy] = frontCell(p);
  const k = keyOf(fx, fy);
  const c = cellAt(fx, fy);
  // bump-search a secret wall in front
  if (c === CELL.SECRET && BUMP_SECRETS.has(k) && !state.secretsFound.has(k)) return revealSecret(state, fx, fy);
  // glyph pillar → open the puzzle; chasm edge → start a climb
  if (c === CELL.PILLAR) return { kind: 'glyph' };
  if (c === CELL.CHASM && !p.crossing) return { kind: 'climb' };
  return null;
}

/**
 * Chasm climb route (Dungeon §3.1): two Might climb tasks (diff 4, trained → 3)
 * with a wandering Z4 intrusion between. Success opens the crossing; a slip costs
 * 3. The other route is the Gravity Nullifier (C3), which just sets `crossing`.
 */
export function startClimb(state) {
  requestWhisper(state, 'chasm');
  // the Z4 handhold intrusion fires once before the first climb
  if (!state.firedScripted?.has('Z4')) { scriptedIntrusion(state, 'Z4', () => climbRolls(state)); return; }
  climbRolls(state);
}

function climbRolls(state) {
  const p = state.player;
  const roll = (label) => {
    const audit = resolveTask({
      base: 4,
      eases: [{ label: 'trained climbing', steps: 1 }],
      hinders: state.climbPenalty ? [{ label: 'crumbling hold', steps: 1 }] : [],
      rng: state.rng,
    });
    state.climbPenalty = 0; // the crumbling hold crumbles ONCE, not every retry
    feedLine(state, audit.success ? `you ${label} — solid holds` : `you slip on the ${label}`,
      audit.success ? PALETTE.cyan : PALETTE.blood);
    return audit.success;
  };
  if (!roll('way down')) { applyDamage(p, 3); logEvent(state, 'You slip on the descent — 3 damage. Try again.'); return; }
  tableIntrusion(state, { zone: 'Z4' }); // the wandering-intrusion roll
  if (!roll('way up')) { applyDamage(p, 3); logEvent(state, 'You lose your grip on the ascent — 3 damage. Try again.'); return; }
  p.crossing = true; state.climbPenalty = 0;
  logEvent(state, 'You haul yourself up the far wall — the chasm is behind you.');
}

function collectPickup(state, e) {
  e.taken = true;
  const p = state.player;
  if (e.ptype === 'shins') {
    p.shins += e.shins;
    logEvent(state, `+${e.shins} shins`);
    return { kind: 'pickup', title: 'shins', text: `You pocket ${e.shins} shins.` };
  }
  if (e.ptype === 'cypher') {
    p.cyphers.push(e.cypher);
    requestWhisper(state, 'cypher');
    const warn = overLimit(state) ? 'Over your cypher limit — the numenera grows restless.' : '';
    return { kind: 'pickup', title: 'unidentified cypher', text: e.cypher.unidName, sub: warn };
  }
  if (e.ptype === 'artifact') {
    state.keyTaken = true;
    awardXP(state, ARTIFACT.xp, 'artifact');
    requestWhisper(state, 'key');
    queueScripted(state, 'Z5'); // the Key sparks (fires after this modal closes)
    return { kind: 'pickup', title: ARTIFACT.name, text: ARTIFACT.text };
  }
  // oddity
  const odd = ODDITIES[e.oddity] || { name: e.oddity, text: '', xp: 1 };
  p.oddities.push(e.oddity);
  if (odd.xp) awardXP(state, odd.xp, `oddity:${e.oddity}`);
  return { kind: 'pickup', title: odd.name, text: odd.text };
}

function revealSecret(state, x, y) {
  const k = keyOf(x, y);
  state.secretsFound.add(k);
  state.stats.secrets += 1;
  // unhide the loot behind it (entities tagged with the guarded placement's group)
  const placement = PLACEMENTS.find((p) => p.sealed === 'bump' && Math.abs(p.x - x) + Math.abs(p.y - y) === 1);
  if (placement) for (const e of state.entities) if (e.group === placement.id) e.hidden = false;
  awardXP(state, 2, `secret:${placement ? placement.id : k}`);
  logEvent(state, 'A scuffed panel gives way.');
  return { kind: 'secret', title: 'hidden cache', text: 'The scratched wall was hollow. Something waits behind it.' };
}

// Cells a walker can stand on for the connectivity graph. Doors always open;
// chasm is crossable (C3 or climb); the locked door is added conditionally.
const WALKABLE = new Set([
  CELL.FLOOR, CELL.START, CELL.EXIT, CELL.BOSS, CELL.KEY,
  '1', '2', '3', '4', '5', '6',
]);
const isWalkBase = (c) => WALKABLE.has(c) || c === CELL.DOOR || c === CELL.CHASM;

function floodFrom(sx, sy, passable) {
  const seen = new Set([keyOf(sx, sy)]);
  const stack = [[sx, sy]];
  while (stack.length) {
    const [x, y] = stack.pop();
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      const k = keyOf(nx, ny);
      if (seen.has(k) || !passable(cellAt(nx, ny))) continue;
      seen.add(k);
      stack.push([nx, ny]);
    }
  }
  return seen;
}

const adjTo = (x, y, reach) => N4.some(([dx, dy]) => reach.has(keyOf(x + dx, y + dy)));

/**
 * Reachable if in the flood, adjacent to it, or sealed behind one S wall
 * (secret bump-search / phase disruptor) whose far side touches the flood.
 */
function cellReachable(x, y, reach) {
  if (reach.has(keyOf(x, y)) || adjTo(x, y, reach)) return true;
  return N4.some(([dx, dy]) => {
    const sx = x + dx, sy = y + dy;
    return cellAt(sx, sy) === CELL.SECRET && adjTo(sx, sy, reach);
  });
}

function findChar(ch) {
  for (let y = 0; y < MAP_H; y++) {
    const x = MAP[y].indexOf(ch);
    if (x !== -1) return [x, y];
  }
  return null;
}

/**
 * Flood-fill connectivity proof (CLAUDE.md prime directive #2):
 * P reaches X through the door/key graph, glyphs are solvable, and every
 * §3.1 placement is reachable (secret/phase vaults via their S wall).
 * @returns {{pass:boolean, checks:[string,boolean][]}}
 */
export function connectivityTest() {
  const [px, py] = findChar(CELL.START);

  // Base graph with the locked door treated as a wall.
  const reachBase = floodFrom(px, py, isWalkBase);

  // Glyph puzzle is solvable iff every pillar can be reached (stood beside).
  const pillars = PLACEMENTS.filter((p) => p.kind === 'pillar');
  const glyphsSolvable = pillars.every((p) => cellReachable(p.x, p.y, reachBase));

  // Full graph: the locked door opens once the puzzle is solvable.
  const reach = floodFrom(px, py, (c) => isWalkBase(c) || (glyphsSolvable && c === CELL.LOCK));

  const [ax, ay] = findChar(CELL.KEY);
  const [xx, xy] = findChar(CELL.EXIT);
  const keyReachable = cellReachable(ax, ay, reach);   // key must be grabbed…
  const exitReachable = cellReachable(xx, xy, reach);  // …to open the exit.

  const checks = [
    ['grid is 24×24', MAP.length === MAP_H && MAP.every((r) => r.length === MAP_W)],
    ['glyphs solvable (all pillars reachable)', glyphsSolvable],
    ['key (A) reachable', keyReachable],
    ['exit (X) reachable', exitReachable],
  ];
  for (const p of PLACEMENTS) {
    checks.push([`placement ${p.id} (${p.kind}) reachable`, cellReachable(p.x, p.y, reach)]);
  }

  const pass = checks.every(([, ok]) => ok);
  return { pass, checks };
}
