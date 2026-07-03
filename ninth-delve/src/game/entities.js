// Explore entities: pickups (shins/cyphers/oddities/artifact) and creature
// billboards, spawned from the §3.1 placement table. Creatures idle-wander in
// their home zone until an encounter pulls them (combat AI is M4+). Loot behind
// secret/phase walls spawns `hidden` and reveals when the wall is opened.

import { PLACEMENTS } from '../data/map_whisperlock.js';
import { CREATURES } from '../data/creatures.js';
import { makeCypher, ODDITIES, ARTIFACT } from '../data/cyphers_oddities.js';

let uid = 0;

/** Ring offsets so multiple entities in one cell don't perfectly overlap. */
function cellSlots(cx, cy, n) {
  if (n <= 1) return [[cx + 0.5, cy + 0.5]];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + 0.5 + Math.cos(a) * 0.28, cy + 0.5 + Math.sin(a) * 0.28]);
  }
  return out;
}

/** Expand one loot token ('shins:5' | 'C2' | 'O1' | 'A') into a pickup entity. */
function makePickup(token, x, y, rng, hidden) {
  if (token.startsWith('shins:')) {
    return { uid: uid++, kind: 'pickup', ptype: 'shins', sprite: 'pickup_shins', x, y, hidden, shins: parseInt(token.split(':')[1], 10) };
  }
  if (/^C\d$/.test(token)) {
    return { uid: uid++, kind: 'pickup', ptype: 'cypher', sprite: 'pickup_cypher', x, y, hidden, cypher: makeCypher(token, rng) };
  }
  if (token === 'A') {
    return { uid: uid++, kind: 'pickup', ptype: 'artifact', sprite: 'artifact_key', x, y, hidden, artifact: ARTIFACT.id };
  }
  const odd = ODDITIES[token];
  return { uid: uid++, kind: 'pickup', ptype: 'oddity', sprite: 'pickup_oddity', x, y, hidden, oddity: odd?.id ?? token };
}

/** Build the full explore entity list for a new delve. @param {()=>number} rng */
export function spawnExploreEntities(rng) {
  const entities = [];
  for (const p of PLACEMENTS) {
    const hidden = !!p.sealed; // secret/phase-wall loot appears only once opened
    const enemies = p.enemies || [];
    const loot = p.loot || [];

    // creatures (skip boss/enemy spawn for cells with no enemies)
    const creatureSlots = cellSlots(p.x, p.y, enemies.length + loot.length);
    enemies.forEach((cid, i) => {
      const def = CREATURES[cid];
      if (!def) return;
      const [ex, ey] = creatureSlots[i] || [p.x + 0.5, p.y + 0.5];
      entities.push({
        uid: uid++, kind: 'creature', creatureId: cid, sprite: def.sprite,
        x: ex, y: ey, hp: def.hp, maxHp: def.hp, alive: true, group: p.id, zone: p.zone,
        home: { x: p.x + 0.5, y: p.y + 0.5 }, aggro: def.aggro, engaged: false,
        worldH: def.worldH ?? 1, F: def.F || {},
      });
    });

    // loot pickups (offset after creatures in the ring)
    loot.forEach((token, i) => {
      const [lx, ly] = creatureSlots[enemies.length + i] || [p.x + 0.5, p.y + 0.5];
      entities.push({ ...makePickup(token, lx, ly, rng, hidden), group: p.id, zone: p.zone });
    });
  }
  return entities;
}

/** Renderable creatures — the dead stay as corpses (Morrowind leaves bodies). */
export const liveCreatures = (state) => state.entities.filter((e) => e.kind === 'creature' && !e.hidden);
/** Collectable pickups currently visible. */
export const visiblePickups = (state) => state.entities.filter((e) => e.kind === 'pickup' && !e.hidden && !e.taken);
