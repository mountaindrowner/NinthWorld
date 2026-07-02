// World: map access + the M0 connectivity flood-fill test.
// Grows in M1+ (collision, LOS, doors, triggers). For now it owns the map grid
// helpers and the door/key connectivity proof required by the build plan.

import {
  MAP, MAP_W, MAP_H, CELL, PLACEMENTS, ZONES, MURALS,
} from '../data/map_whisperlock.js';

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
  if (MURAL_SET.has(keyOf(x, y))) return 'wall_mural';
  const z = zoneAt(x, y);
  if (z === 'Z2') return 'wall_warren';
  if (z === 'Z4' || z === 'Z5') return 'wall_conduit';
  return 'wall_synth';
}

/**
 * Move a {x,y} entity by (dx,dy) with circle-slide collision (r=0.3). Axes are
 * resolved independently so we slide along walls instead of clipping corners.
 */
export function moveWithCollision(p, dx, dy) {
  const r = 0.3;
  const blocked = (fx, fy) => {
    for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) {
      if (isBlocking(Math.floor(fx + ox), Math.floor(fy + oy))) return true;
    }
    return false;
  };
  if (!blocked(p.x + dx, p.y)) p.x += dx;
  if (!blocked(p.x, p.y + dy)) p.y += dy;
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
