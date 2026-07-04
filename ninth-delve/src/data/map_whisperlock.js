// The Whisperlock — 24×24 map grid + authoritative placement table.
// Source of truth is Dungeon doc §3.1 (placements); geometry was rebuilt clean
// because the doc's ASCII visualization has inconsistent row widths and an
// embedded "Z5 core" text label (flagged in HANDOVER). This grid passes the
// flood-fill connectivity test in game/world.js — see that file for the graph.
//
// Legend (Dungeon §3): # wall · . floor · D door · L glyph-locked door
// · S secret/phase wall · ~ chasm · P start · X exit · G glyph pillar
// · B boss · A artifact key · digits = placement IDs (see PLACEMENTS).

export const MAP_W = 24;
export const MAP_H = 24;

// Z5 is chambered (west→east): cache alcove · warden's arena (B guards A) ·
// exit antechamber, where X is the Whisperlock gate itself. Geometry flex only —
// every §3.1 placement keeps its cell.
/** @type {string[]} row-major, MAP[y][x]. Validated 24×24 by world.connectivityTest. */
export const MAP = [
  '########################',
  '#..1#.........A#..X....#',
  '#...D.....B....D.......#',
  '#...#..........#.......#',
  '######L#############.###',
  '####.........#######D###',
  '####.........######~...#',
  '####..G.G.G..######~...#',
  '#...........######S~...#',
  '#.2.........D......~...#',
  '#...........#######~.4.#',
  '#............S.####~...#',
  '####.........#######...#',
  '#.3#D###################',
  '#....###################',
  '#...####################',
  '#...####################',
  '#...S5##################',
  '##D#####################',
  '#..........#############',
  '#..........#############',
  '#....6.....#############',
  '#.P........#############',
  '########################',
];

/** Legend codes present in MAP, for classification in world.js. */
export const CELL = {
  WALL: '#', FLOOR: '.', DOOR: 'D', LOCK: 'L', SECRET: 'S', CHASM: '~',
  START: 'P', EXIT: 'X', PILLAR: 'G', BOSS: 'B', KEY: 'A',
};

/** Cardinal facings (radians): N faces up (−y) in world space. */
export const FACING = { N: -Math.PI / 2, E: 0, S: Math.PI / 2, W: Math.PI };

// --- Zones (coarse rects, first match wins) for drones/tinting later. ---
export const ZONES = [
  { id: 'Z5', name: 'Lock Core',      x1: 1, y1: 1,  x2: 22, y2: 3 },
  { id: 'Z4', name: 'Coolant Chasm',  x1: 15, y1: 4, x2: 22, y2: 12 },
  { id: 'Z3', name: 'Whisper Gallery',x1: 4, y1: 4,  x2: 14, y2: 12 },
  { id: 'Z2', name: 'Murden Warrens', x1: 1, y1: 8,  x2: 4,  y2: 18 },
  { id: 'Z1', name: 'Collapsed Entry',x1: 1, y1: 18, x2: 10, y2: 22 },
];

/**
 * Authoritative placements (Dungeon §3.1). x/y are grid cells. `sealed` marks
 * cells reachable only by opening an adjacent S wall ('bump' secret-search or
 * 'phase' cypher). Loot ids reference data/cyphers_oddities.js (built in M2+).
 * @type {{id:string,x:number,y:number,zone:string,kind:string,loot?:string[],
 *   enemies?:string[],sealed?:'bump'|'phase',note?:string}[]}
 */
export const PLACEMENTS = [
  { id: 'P', x: 2,  y: 22, zone: 'Z1', kind: 'start',   facing: 'N', note: 'Whisper line #1' },
  { id: '6', x: 5,  y: 21, zone: 'Z1', kind: 'fight',   enemies: ['laak'], loot: ['C1', 'shins:2'], note: 'tutorial' },
  { id: '5', x: 5,  y: 17, zone: 'Z1', kind: 'secret',  sealed: 'bump', loot: ['shins:5', 'O1'] },
  { id: '3', x: 2,  y: 13, zone: 'Z2', kind: 'nest',    enemies: ['murden', 'murden', 'laak'], loot: ['shins:6', 'C2'], note: 'clue mural' },
  { id: '2', x: 2,  y: 9,  zone: 'Z2', kind: 'patrol',  enemies: ['murden'], note: 'may flee & alert nest' },
  { id: 'G1', x: 6, y: 7,  zone: 'Z3', kind: 'pillar' },
  { id: 'G2', x: 8, y: 7,  zone: 'Z3', kind: 'pillar' },
  { id: 'G3', x: 10, y: 7, zone: 'Z3', kind: 'pillar' },
  { id: 'L', x: 6,  y: 4,  zone: 'Z3', kind: 'lock',    note: 'opens on glyph solve → Z5' },
  { id: 'V', x: 14, y: 11, zone: 'Z3', kind: 'vault',   sealed: 'phase', loot: ['C5', 'C6'], note: 'over-limit temptation' },
  { id: '4', x: 21, y: 10, zone: 'Z4', kind: 'den',     enemies: ['hound', 'hound'], loot: ['C4'], note: 'phases to Z3 east' },
  { id: '1', x: 3,  y: 1,  zone: 'Z5', kind: 'cache',   loot: ['shins:4', 'O2'], note: 'O2 = glyph clue' },
  { id: 'B', x: 10, y: 2,  zone: 'Z5', kind: 'boss',    enemies: ['abykos'] },
  { id: 'A', x: 14, y: 1,  zone: 'Z5', kind: 'artifact', loot: ['A'], note: '+3 XP, unlocks X' },
  { id: 'X', x: 18, y: 1,  zone: 'Z5', kind: 'exit',    note: 'needs the Key' },
];

/** 6 coolant-chasm cells (crossed via C3, or 2 Might climb tasks). */
export const CHASM = [[19, 6], [19, 7], [19, 8], [19, 9], [19, 10], [19, 11]];

/** Wall cells textured as the Z2 clue mural (glyph order), beside nest #3. */
export const MURALS = [[4, 15]];

/**
 * Door / key gating for the connectivity graph.
 * - Standard doors always open (M2 adds slide anim).
 * - L opens once all glyph pillars are reachable (puzzle solvable).
 * - X opens once the Key (A) has been reached.
 */
// Every door seals a real doorway now (flanked by wall on the cross axis):
// (2,18) Z1→warrens corridor · (4,13) warrens nest→gallery · (12,9)
// gallery→chasm approach · (20,5) chasm shore→exit antechamber · (4,2)
// arena→cache alcove · (15,2) arena→exit antechamber. The floating
// mid-gallery door at (6,6) was deleted — the glyph lock L is that room's gate.
export const DOORS = [[4, 2], [15, 2], [2, 18], [4, 13], [12, 9], [20, 5]];
export const LOCK_DOOR = { x: 6, y: 4, opensWhen: 'glyphs-solved' };
export const EXIT_GATE = { x: 18, y: 1, opensWhen: 'key-taken' };
