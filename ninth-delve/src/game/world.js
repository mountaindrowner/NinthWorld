// World: map access + the M0 connectivity flood-fill test.
// Grows in M1+ (collision, LOS, doors, triggers). For now it owns the map grid
// helpers and the door/key connectivity proof required by the build plan.

import {
  MAP, MAP_W, MAP_H, CELL, PLACEMENTS,
} from '../data/map_whisperlock.js';

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const keyOf = (x, y) => y * MAP_W + x;

/** @returns {string} legend char at cell, or '#' out of bounds. */
export function cellAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return CELL.WALL;
  return MAP[y][x];
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
