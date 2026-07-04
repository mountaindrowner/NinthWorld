// bot.js — the autoplayer (?bot=1). Plays the delve the way a player would,
// through the same game-layer verbs (moveWithCollision, playerSwing, interact,
// tryRest, useCypher) so every roll and rule fires exactly as in a human run.
// Exists for difficulty tuning: it reports a metrics object per run
// (window.__NINTH_BOT via main.js) that the balance harness aggregates across
// seeds. It is NOT an AI showcase — it follows the intended critical path
// (fight → nest → mural → glyphs → arena → Key → gate) with optional detours.

import {
  moveWithCollision, interact, startClimb, tileDist, cellAt, blockedAt,
} from './world.js';
import { playerSwing, tryRest } from './combat.js';
import { useCypher, examineSpec, applyExamine } from './cyphers.js';
import { scriptedIntrusion } from './intrusions.js';
import { glyphAttempt } from '../ui/menus.js';
import { isDead, isImpaired, applyBenefit } from './player.js';
import { feedLine } from './state.js';
import { resolveTask } from './dice.js';
import { PALETTE } from '../engine/texgen.js';
import { MAP_W, MAP_H, CELL } from '../data/map_whisperlock.js';

const MOVE_SPEED = 4;            // matches main.js MOVE_FWD
const keyOf = (x, y) => y * MAP_W + x;

/** Two policy profiles for the balance sweep. */
export const PROFILES = {
  // fights everything head-on, heavy swings, no detours, minimal self-care
  brave: { explore: false, kite: false, heavy: true, train: false, restBelow: 0.45, healBelow: 0.35 },
  // takes the secret + chasm detours, examines cyphers, kites, rests, trains
  careful: { explore: true, kite: true, heavy: true, train: true, restBelow: 0.65, healBelow: 0.5 },
};

/** The intended critical path, as data. `until` marks a step done; steps
 * without one finish on arrival. */
function makePlan(profile) {
  const steps = [
    { id: 'tutorial-fight', goto: [5.5, 21.5] },
  ];
  if (profile.explore) {
    steps.push(
      { id: 'secret-cache', goto: [3.4, 17.5], face: [4.5, 17.5], act: 'bump', until: (s) => s.secretsFound.has(keyOf(4, 17)) },
      { id: 'cache-loot', goto: [5.5, 17.5] },
    );
  }
  steps.push(
    { id: 'nest', goto: [2.5, 13.5] },
    { id: 'mural', goto: [4.4, 14.2], until: (s) => s.glyph.muralSeen },
    { id: 'glyphs', goto: [6.5, 8.6], face: [6.5, 7.5], act: 'pillar', until: (s) => s.glyph.solved },
  );
  if (profile.explore) {
    steps.push(
      { id: 'chasm-cross', goto: [18.6, 9.5], face: [19.5, 9.5], act: 'climb', until: (s) => s.player.crossing },
      { id: 'hound-den', goto: [21.5, 10.5], allowChasm: true },
      { id: 'chasm-north', goto: [20.5, 3.5], allowChasm: true },
    );
  }
  steps.push(
    { id: 'the-key', goto: [14.5, 1.5], until: (s) => s.keyTaken },
    { id: 'the-gate', goto: [18.5, 1.5], until: (s) => !!s.ascend },
  );
  return steps;
}

// ---------------------------------------------------------------------------

export function createBot(state, profileName = 'brave') {
  const profile = PROFILES[profileName] || PROFILES.brave;
  const plan = makePlan(profile);
  let stepIdx = 0;
  let path = null, pathGoal = null, allowChasm = false;
  let stuckT = 0, lastPos = { x: 0, y: 0 };
  let modalDelay = 0, actNextAt = 0;
  const examined = new Set();      // cypher uids we already tried to examine
  const seenFeed = new Set();      // rollFeed line objects already parsed

  const metrics = {
    profile: profileName, seed: state.seed,
    done: false, result: null,           // 'exit' | 'defeat' | 'stuck'
    gameMs: 0, steps: [],
    damageTaken: 0, hitsTaken: 0, missesByFoe: 0, swings: 0, swingHits: 0,
    rests: 0, restPoints: 0,
    bossEngagedAt: null, bossKilledAt: null, bossFightMs: null,
    poolLowPct: 1, timeline: [],
  };
  const mark = (ev) => metrics.timeline.push({ t: Math.round(state.t), ev });

  // ---- feed parsing: damage + swing accounting off the honest message log ----
  function parseFeed() {
    for (const line of state.rollFeed || []) {
      if (seenFeed.has(line)) continue;
      seenFeed.add(line);
      let m;
      if ((m = line.txt.match(/hits you — (\d+)/))) { metrics.damageTaken += +m[1]; metrics.hitsTaken += 1; }
      else if (/^you evade the /.test(line.txt)) metrics.missesByFoe += 1;
      else if (/^you strike the /.test(line.txt)) metrics.swingHits += 1;
      else if (/^you slip|^you lose your grip/.test(line.txt)) metrics.damageTaken += 3;
      else if (/static crawls/.test(line.txt)) metrics.damageTaken += 2;
      else if ((m = line.txt.match(/^rest .*recovered (\d+)/))) metrics.restPoints += +m[1];
    }
  }

  // ---- grid pathing (BFS — the map is 24×24) -------------------------------
  function passable(x, y) {
    const c = cellAt(x, y);
    if (c === CELL.WALL || c === ' ' || c === CELL.PILLAR) return false;
    if (c === CELL.SECRET) return state.secretsFound.has(keyOf(x, y)) || state.phasedCells.has(keyOf(x, y));
    if (c === CELL.LOCK) return state.glyph.solved;
    if (c === CELL.CHASM) return allowChasm || state.player.crossing;
    return true;
  }
  function findPath(tx, ty) {
    const p = state.player;
    const s = [Math.floor(p.x), Math.floor(p.y)], g = [Math.floor(tx), Math.floor(ty)];
    const prev = new Map([[keyOf(...s), null]]);
    const q = [s];
    while (q.length) {
      const [x, y] = q.shift();
      if (x === g[0] && y === g[1]) {
        const out = [];
        for (let k = keyOf(x, y); k != null; k = prev.get(k) == null ? null : keyOf(...prev.get(k))) {
          out.unshift([k % MAP_W + 0.5, Math.floor(k / MAP_W) + 0.5]);
          if (prev.get(k) === null) break;
        }
        out[out.length - 1] = [tx, ty];   // land on the exact goal point
        if (out.length > 1) out.shift();  // node 0 is the CURRENT cell — heading
        return out;                       // to it walks backward mid-cell
      }
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = keyOf(nx, ny);
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || prev.has(k) || !passable(nx, ny)) continue;
        prev.set(k, [x, y]);
        q.push([nx, ny]);
      }
    }
    return null;
  }
  function walkToward(tx, ty, dt) {
    const p = state.player;
    if (!path || pathGoal?.[0] !== tx || pathGoal?.[1] !== ty) {
      path = findPath(tx, ty); pathGoal = [tx, ty];
      if (!path) { mark(`no path to ${tx},${ty}`); return false; }
    }
    while (path.length > 1 && tileDist(p.x, p.y, path[0][0], path[0][1]) < 0.35) path.shift();
    const [nx, ny] = path[0];
    p.angle = Math.atan2(ny - p.y, nx - p.x);
    moveWithCollision(state, p, Math.cos(p.angle) * MOVE_SPEED * dt, Math.sin(p.angle) * MOVE_SPEED * dt);
    // stuck watchdog: repath after ~1.5s of no movement (doors mid-slide etc.)
    if (Math.hypot(p.x - lastPos.x, p.y - lastPos.y) < 0.01) {
      stuckT += dt;
      if (stuckT > 1.5) { path = null; stuckT = 0; }
    } else stuckT = 0;
    lastPos = { x: p.x, y: p.y };
    return tileDist(p.x, p.y, tx, ty) < 0.3;
  }

  // ---- sub-behaviors --------------------------------------------------------
  const poolPct = () => {
    const p = state.player;
    return (p.pools.might + p.pools.speed + p.pools.intellect) / (p.poolMax.might + p.poolMax.speed + p.poolMax.intellect);
  };
  // a foe only counts if we could actually walk to it — hounds glaring across
  // the chasm are scenery until the crossing opens (BFS answers, cached briefly)
  const reachCache = new Map();   // uid -> {t, ok}
  const ignoreUntil = new Map();  // uid -> state.t deadline (stalemate backstop)
  let fightIdleT = 0, lastExchange = 0;
  function foeReachable(e) {
    if (tileDist(state.player.x, state.player.y, e.x, e.y) < 2.0) return true;
    const c = reachCache.get(e.uid);
    if (c && state.t - c.t < 1500) return c.ok;
    const ok = !!findPath(e.x, e.y);
    reachCache.set(e.uid, { t: state.t, ok });
    return ok;
  }
  const engagedFoes = () => state.entities.filter((e) => {
    if (e.kind !== 'creature' || !e.alive || e.hidden || !e.engaged) return false;
    if ((ignoreUntil.get(e.uid) || 0) > state.t) {
      if (tileDist(state.player.x, state.player.y, e.x, e.y) < 2.2) ignoreUntil.delete(e.uid); // it reached us after all
      else return false;
    }
    return foeReachable(e);
  });

  function fight(dt) {
    const p = state.player;
    const foes = engagedFoes();
    // stalemate watch: no damage traded for 5s against a distant foe → ignore it
    const exchange = metrics.swingHits + metrics.hitsTaken;
    if (exchange !== lastExchange) { lastExchange = exchange; fightIdleT = 0; }
    else fightIdleT += dt;
    if (fightIdleT > 5) {
      fightIdleT = 0;
      for (const e of foes) if (tileDist(p.x, p.y, e.x, e.y) > 2.2) { ignoreUntil.set(e.uid, state.t + 15000); mark(`ignore unreachable ${e.creatureId}`); }
      return;
    }
    const boss = foes.find((e) => e.creatureId === 'abykos');
    if (boss && metrics.bossEngagedAt === null) { metrics.bossEngagedAt = state.t; mark('boss engaged'); }
    // emergency heal mid-fight
    const rejIdx = p.cyphers.findIndex((c) => c.identified && c.effect === 'rejuvenate');
    if (rejIdx >= 0 && poolPct() < profile.healBelow) { mark('use rejuvenator'); state.log.push(useCypher(state, rejIdx)); return; }
    // detonation when it counts: a pack, or the boss (energy ignores its armor)
    const detIdx = p.cyphers.findIndex((c) => c.identified && c.effect === 'detonation');
    if (detIdx >= 0 && (foes.length >= 2 || boss)) { mark('use detonation'); state.log.push(useCypher(state, detIdx)); return; }

    const t = foes.sort((a, b) => tileDist(p.x, p.y, a.x, a.y) - tileDist(p.x, p.y, b.x, b.y))[0];
    const d = tileDist(p.x, p.y, t.x, t.y);
    p.angle = Math.atan2(t.y - p.y, t.x - p.x);
    const coolingDown = state.t < (p.swingCooldownUntil || 0);
    if (profile.kite && coolingDown && d < 1.9) {
      // step back out of its reach while the sword recovers
      moveWithCollision(state, p, -Math.cos(p.angle) * MOVE_SPEED * 0.8 * dt, -Math.sin(p.angle) * MOVE_SPEED * 0.8 * dt);
      return;
    }
    if (d > 1.35) {
      // direct chase; if geometry snags us (arena columns), fall back to pathing
      if (fightIdleT > 1.2) walkToward(t.x, t.y, dt);
      else moveWithCollision(state, p, Math.cos(p.angle) * MOVE_SPEED * dt, Math.sin(p.angle) * MOVE_SPEED * dt);
      return;
    }
    if (!coolingDown) {
      const heavy = profile.heavy && p.pools.might > 7;
      metrics.swings += 1;
      playerSwing(state, heavy);
    }
  }

  function selfCare() {
    const p = state.player;
    // rest between fights while slots remain
    if ((poolPct() < profile.restBelow || isImpaired(p)) && p.restsUsed < 3) {
      const before = p.pools.might + p.pools.speed + p.pools.intellect;
      tryRest(state);
      const after = p.pools.might + p.pools.speed + p.pools.intellect;
      if (after > before) { metrics.rests += 1; mark(`rest (+${after - before})`); return true; }
    }
    // training (careful profile): spend banked XP like a player would —
    // sword skill first, then a deeper Might pool (mirrors menus.js Train)
    if (profile.train && p.xp >= 6) {
      const kind = !p.weaponTrained ? 'weapon' : 'pool';
      p.xp -= 4; p.xpSpent += 4;
      feedLine(state, applyBenefit(state, kind, 'might'), PALETTE.goldGlow);
      metrics.trainings = (metrics.trainings || 0) + 1;
      mark(`train:${kind}`);
      return true;
    }
    // examine one unidentified cypher (the real hindered Intellect roll)
    const idx = p.cyphers.findIndex((c) => !c.identified && !examined.has(c.id + ':' + c.level));
    if (idx >= 0) {
      const cy = p.cyphers[idx];
      examined.add(cy.id + ':' + cy.level);
      const spec = examineSpec(state, idx);
      const audit = resolveTask({ base: spec.base, eases: spec.eases, hinders: spec.hinders, rng: state.rng, impaired: isImpaired(p) });
      state.log.push(applyExamine(state, idx, audit));
      return true;
    }
    // pre-identified boons: density is a strict upgrade, use on sight
    const denIdx = p.cyphers.findIndex((c) => c.identified && c.effect === 'density');
    if (denIdx >= 0) { mark('use density'); state.log.push(useCypher(state, denIdx)); return true; }
    return false;
  }

  let lootTarget = null; // sticky, so the loot/plan goals can't thrash at the radius edge
  function nearbyPickup() {
    const p = state.player;
    if (lootTarget && !lootTarget.taken && !lootTarget.hidden && tileDist(p.x, p.y, lootTarget.x, lootTarget.y) < 5) return lootTarget;
    lootTarget = null;
    let bestD = 2.6;
    for (const e of state.entities) {
      if (e.kind !== 'pickup' || e.hidden || e.taken) continue;
      const d = tileDist(p.x, p.y, e.x, e.y);
      if (d < bestD && passable(Math.floor(e.x), Math.floor(e.y))) { lootTarget = e; bestD = d; }
    }
    return lootTarget;
  }

  // ---- modal / glyph auto-resolution ---------------------------------------
  function resolveModal(dt) {
    modalDelay += dt;
    if (modalDelay < 0.25) return;    // a beat, so scripted flows settle
    modalDelay = 0;
    const m = state.modal;
    const back = state.prevMode || 'EXPLORE';
    state.modal = null; state.prevMode = null; state.mode = back;
    let result;
    if (m.kind === 'intrusion') result = m.choices?.[0]?.value ?? 'accept'; // always accept (+2 XP, the tuned experience)
    mark(`modal:${m.kind}${result ? ':' + result : ''}`);
    m.onResolve?.(result);
  }
  function solveGlyph() {
    if (!(state.glyph.muralSeen || state.glyph.intuited || state.player.oddities.includes('O2'))) {
      state.mode = 'EXPLORE'; return; // shouldn't happen — plan sees the mural first
    }
    state.glyph.rotation = [...state.glyph.correct];
    glyphAttempt(state);
    state.mode = 'EXPLORE';
    mark('glyphs solved');
  }

  // ---- the tick -------------------------------------------------------------
  function tick(dt) {
    metrics.gameMs = Math.round(state.t - (state.startTime || 0));
    parseFeed();
    const p = state.player;

    if (state.mode === 'REPORT' || isDead(p)) {
      if (!metrics.done) {
        metrics.done = true;
        metrics.result = state.reportReason || (isDead(p) ? 'defeat' : 'exit');
        metrics.kills = state.stats.kills; metrics.secrets = state.stats.secrets;
        metrics.cyphersUsed = state.stats.cyphersUsed; metrics.xp = p.xp;
        metrics.shins = p.shins; metrics.endPoolPct = +poolPct().toFixed(3);
        if (metrics.bossEngagedAt && state.entities.some((e) => e.creatureId === 'abykos' && !e.alive)) {
          metrics.bossKilledAt ??= state.t;
          metrics.bossFightMs = Math.round(metrics.bossKilledAt - metrics.bossEngagedAt);
        }
        mark(`done:${metrics.result}`);
      }
      return;
    }
    if (state.mode === 'MODAL') return resolveModal(dt);
    if (state.mode === 'GLYPH') return solveGlyph();
    if (state.mode === 'ASCEND') return;
    if (state.mode !== 'EXPLORE') { state.mode = 'EXPLORE'; return; }

    metrics.poolLowPct = Math.min(metrics.poolLowPct, +poolPct().toFixed(3));
    const bossDead = state.entities.some((e) => e.creatureId === 'abykos' && !e.alive);
    if (bossDead && metrics.bossKilledAt === null && metrics.bossEngagedAt !== null) {
      metrics.bossKilledAt = state.t; mark('boss killed');
    }

    if (engagedFoes().length) { metrics.branch = 'fight'; return fight(dt); }
    if (selfCare()) { metrics.branch = 'selfcare'; return; }

    // opportunistic loot within a couple tiles
    const loot = nearbyPickup();
    if (loot) {
      metrics.branch = `loot:${loot.ptype}@${loot.x.toFixed(1)},${loot.y.toFixed(1)}`;
      if (tileDist(p.x, p.y, loot.x, loot.y) > 0.85) { walkToward(loot.x, loot.y, dt); return; }
      p.angle = Math.atan2(loot.y - p.y, loot.x - p.x);
      interact(state);   // collect (modal descriptor is UI-only; effects applied)
      return;
    }

    // advance the plan
    const step = plan[stepIdx];
    if (!step) { metrics.done = true; metrics.result = 'stuck'; mark('plan exhausted'); return; }
    metrics.branch = `plan:${step.id} path=${path ? path.length : 'none'}`;
    allowChasm = !!step.allowChasm;
    const arrived = walkToward(step.goto[0], step.goto[1], dt);
    const satisfied = step.until ? step.until(state) : arrived;
    if (satisfied) {
      mark(`step:${step.id}`);
      metrics.steps.push({ id: step.id, t: Math.round(state.t) });
      stepIdx += 1; path = null;
      return;
    }
    if (arrived && step.act && state.t >= actNextAt) {
      actNextAt = state.t + 1500;  // a player re-attempts after a beat, not 60/s
      if (step.face) p.angle = Math.atan2(step.face[1] - p.y, step.face[0] - p.x);
      if (step.act === 'bump') interact(state);
      else if (step.act === 'climb') {
        const gravIdx = p.cyphers.findIndex((c) => c.identified && c.effect === 'gravity');
        if (gravIdx >= 0) { mark('use gravity'); state.log.push(useCypher(state, gravIdx)); return; }
        if (poolPct() < 0.45 && p.restsUsed < 3) return; // patch up before risking slips
        const ev = interact(state);
        if (ev?.kind === 'climb') startClimb(state);
      }
      else if (step.act === 'pillar') {
        const ev = interact(state);
        if (ev?.kind === 'glyph') {
          if (!state.firedScripted.has('Z3')) scriptedIntrusion(state, 'Z3', () => { state.mode = 'GLYPH'; });
          else state.mode = 'GLYPH';
        }
      }
    }
  }

  return { tick, report: () => metrics };
}
