// combat.js — the turn-based encounter controller (Tech §6). Exploration freezes
// into rounds; EVERY roll (initiative, attacks, defenses, flee) goes through the
// dice tray so all math is visible (pillar #1). Enemy phase = the player rolling
// Speed/Might defenses. Advancement is XP-from-discovery only; kills score nothing.

import { CREATURES, armorVs } from '../data/creatures.js';
import { KAVE } from '../data/pregen_kave.js';
import { logEvent } from './state.js';
import { applyDamage, payCost, abilityCost, recover, isDead, isImpaired } from './player.js';
import { tileDist, hasLOS } from './world.js';
import { openTray } from '../ui/dicetray.js';

const BANDS = ['immediate', 'short', 'long'];
const bandFromTiles = (d) => (d <= 2 ? 'immediate' : d <= 10 ? 'short' : 'long');
const bandRank = (b) => BANDS.indexOf(b);
const closer = (b) => BANDS[Math.max(0, bandRank(b) - 1)];
const farther = (b) => BANDS[Math.min(2, bandRank(b) + 1)];

const RETRIGGER_MS = 1500;

/** Check explore for an aggro'd, visible hostile and start an encounter. */
export function maybeTrigger(state) {
  if (state.t < (state.encounterCooldown || 0)) return;
  const p = state.player;
  for (const e of state.entities) {
    if (e.kind !== 'creature' || !e.alive || e.hidden) continue;
    const d = tileDist(p.x, p.y, e.x, e.y);
    if (d > e.aggro || !hasLOS(state, e.x, e.y, p.x, p.y)) continue;
    // pull the whole group + anyone else visible & in aggro
    const group = state.entities.filter((c) => c.kind === 'creature' && c.alive && !c.hidden
      && (c.group === e.group || (tileDist(p.x, p.y, c.x, c.y) <= c.aggro && hasLOS(state, c.x, c.y, p.x, p.y))));
    startEncounter(state, group);
    return;
  }
}

export function startEncounter(state, creatureEntities) {
  const p = state.player;
  const enemies = creatureEntities.map((ent) => {
    const def = CREATURES[ent.creatureId];
    ent.engaged = true;
    return {
      ent, def, id: def.id, name: def.name, level: def.level, target: def.target,
      hp: ent.hp, maxHp: def.hp, damage: def.damage, moveBand: def.moveBand,
      band: bandFromTiles(tileDist(p.x, p.y, ent.x, ent.y)), stunned: false, alive: true,
    };
  });
  state.encounter = { enemies, round: 0, phase: 'init', playerFirst: true, seq: [], seqI: 0, queue: [] };
  state.mode = 'ENCOUNTER';
  p.defending = false;
  logEvent(state, `Encounter — ${enemies.map((e) => e.name).join(', ')}.`);

  const maxLevel = Math.max(...enemies.map((e) => e.level));
  openTray(state, { label: 'initiative (Speed)', base: maxLevel, eases: [], hinders: [], stat: 'speed' }, (a) => {
    state.encounter.playerFirst = a.success;
    logEvent(state, a.success ? 'You read the room — you act first.' : 'They move first.');
    beginRound(state);
  });
}

function living(state) { return state.encounter.enemies.filter((e) => e.alive); }
function livingLaaks(state) { return living(state).filter((e) => e.id === 'laak').length; }

function beginRound(state) {
  const e = state.encounter;
  if (checkEnd(state)) return;
  e.round += 1;
  e.seq = e.playerFirst ? ['player', 'enemy'] : ['enemy', 'player'];
  e.seqI = 0;
  runPhase(state);
}

function runPhase(state) {
  const e = state.encounter;
  if (!e || checkEnd(state)) return;
  if (e.seqI >= e.seq.length) { beginRound(state); return; }
  const ph = e.seq[e.seqI++];
  if (ph === 'player') enterPlayerPhase(state);
  else enterEnemyPhase(state);
}

function enterPlayerPhase(state) {
  const e = state.encounter;
  e.phase = 'player';
  e.acted = false;
  state.player.defending = false; // Defend eased the just-finished enemy phase
}

// --- player actions (called from the encounter menu) -------------------------

const nearestEnemy = (state) => living(state).sort((a, b) => bandRank(a.band) - bandRank(b.band))[0];

export function playerAction(state, id) {
  const e = state.encounter;
  if (!e || e.phase !== 'player' || e.acted) return;
  const p = state.player;

  if (id === 'aggression') { // stance toggle — does not consume the turn
    if (!p.aggression) {
      if (!payCost(p, 'might', abilityCost(KAVE.fightingMoves.aggression.cost.might, p.edge.might))) { logEvent(state, 'Not enough Might for Aggression.'); return; }
      p.aggression = true; logEvent(state, 'Aggression: attacks eased, defenses hindered.');
    } else { p.aggression = false; logEvent(state, 'You drop your aggressive stance.'); }
    return;
  }

  if (id === 'defend') { p.defending = true; logEvent(state, 'You brace — defenses eased.'); consume(state); return; }
  if (id === 'catch') { const r = recover(p, KAVE.recovery, state.rng); logEvent(state, `Catch Breath: +${r.points} (rest slot ${r.slot}).`); consume(state); return; }
  if (id === 'fleet') { for (const en of living(state)) en.band = closer(en.band); logEvent(state, 'Fleet of Foot — you close the distance.'); consume(state); return; }
  if (id === 'flee') { doFlee(state); return; }
  if (id === 'attack') { doAttack(state); return; }
}

function consume(state) { state.encounter.acted = true; runPhase(state); }

function doAttack(state) {
  const p = state.player, enemy = nearestEnemy(state);
  if (!enemy) return;
  let weapon = KAVE.weapons.broadsword;
  if (enemy.band === 'short') weapon = KAVE.weapons.dagger; // thrown
  else if (enemy.band !== 'immediate') { logEvent(state, `${enemy.name} is too far — close first.`); return; }

  const eases = [];
  if (weapon.ease) eases.push({ label: 'light', steps: weapon.ease });
  if (p.aggression) eases.push({ label: 'Aggression', steps: 1 });
  if (p.stimRounds > 0) eases.push({ label: 'Stim', steps: 1 });

  openTray(state, { label: `attack ${enemy.name} (${weapon.name})`, base: enemy.level, eases, hinders: [], stat: 'might' }, (a) => {
    resolveAttack(state, enemy, weapon, a);
    consume(state);
  });
}

function resolveAttack(state, enemy, weapon, a) {
  if (a.special?.effect === 'intrusion') { logEvent(state, 'Natural 1 — the GM smiles.'); return; } // M6 real intrusion
  if (!a.success) { logEvent(state, `You miss the ${enemy.name}.`); return; }

  let dmg = weapon.damage + state.player.weaponBonus;
  const sp = a.special;
  if (sp && (sp.tier === '17' || sp.tier === '18')) dmg += sp.bonusDamage;
  if (a.specialChoice === 'damage') dmg += sp.bonusDamage;
  else if (a.specialChoice === 'knockback') enemy.band = 'short';
  else if (a.specialChoice === 'stun' || a.specialChoice === 'knockdown') enemy.stunned = true;

  const armor = armorVs(enemy.def, 'physical');
  dmg = Math.max(0, dmg - armor);
  enemy.hp -= dmg;
  logEvent(state, `You hit the ${enemy.name} for ${dmg}${armor ? ` (−${armor} Armor)` : ''}.`);
  if (enemy.hp <= 0) {
    enemy.alive = false; enemy.ent.alive = false; state.stats.kills += 1;
    logEvent(state, `The ${enemy.name} falls.`);
  }
}

function doFlee(state) {
  const maxLevel = Math.max(...living(state).map((e) => e.level));
  openTray(state, { label: 'flee (Speed)', base: maxLevel, eases: [], hinders: [], stat: 'speed' }, (a) => {
    if (a.success) { logEvent(state, 'You break away into the dark.'); endEncounter(state, 'fled'); }
    else { logEvent(state, 'You can’t break free!'); consume(state); }
  });
}

// --- enemy phase = player defense rolls --------------------------------------

function enterEnemyPhase(state) {
  const e = state.encounter;
  e.phase = 'enemy';
  e.queue = living(state).slice();
  processEnemy(state);
}

function processEnemy(state) {
  const e = state.encounter;
  if (!e || checkEnd(state)) return;
  if (e.queue.length === 0) { runPhase(state); return; } // enemy phase done
  const enemy = e.queue.shift();
  if (!enemy.alive) { processEnemy(state); return; }
  if (enemy.stunned) { enemy.stunned = false; logEvent(state, `The ${enemy.name} is reeling.`); processEnemy(state); return; }
  if (enemy.band !== 'immediate' && !(enemy.moveBand === 'short' && enemy.band === 'short')) {
    enemy.band = closer(enemy.band);
    if (enemy.band !== 'immediate') { logEvent(state, `The ${enemy.name} closes.`); processEnemy(state); return; }
  }
  enemyAttack(state, enemy);
}

function enemyAttack(state, enemy) {
  const p = state.player;
  const touch = enemy.def.special.includes('might_touch');
  const stat = touch ? 'might' : 'speed';
  const eases = [];
  if (!touch) eases.push({ label: 'shield', steps: 1 });          // shield = Speed asset
  if (p.defending) eases.push({ label: 'Defend', steps: 1 });
  if (touch && KAVE.skills.mightDefense === 'trained') eases.push({ label: 'trained', steps: 1 });
  const hinders = [];
  if (p.aggression) hinders.push({ label: 'Aggression', steps: 1 });
  if (enemy.id === 'laak' && livingLaaks(state) >= 2) hinders.push({ label: 'skitter', steps: 1 });

  openTray(state, { label: `defend vs ${enemy.name} (${stat})`, base: enemy.level, eases, hinders, stat }, (a) => {
    resolveDefense(state, enemy, a);
    processEnemy(state);
  });
}

function resolveDefense(state, enemy, a) {
  const p = state.player;
  if (a.success) {
    if (a.special?.effect) { enemy.stunned = true; logEvent(state, `You turn the ${enemy.name}’s attack against it.`); }
    else logEvent(state, `You evade the ${enemy.name}.`);
    return;
  }
  // failed defense → take the hit
  const ignoresArmor = enemy.def.special.includes('phase_lunge') && enemy.id === 'hound'; // M5 nuance
  const armor = ignoresArmor ? 0 : Math.max(0, p.armor - p.armorPenalty);
  const dmg = Math.max(0, enemy.damage - armor);
  applyDamage(p, dmg);
  logEvent(state, `The ${enemy.name} hits you for ${dmg}${a.special?.effect === 'intrusion' ? ' — the GM smiles' : ''}.`);
}

// --- end conditions ----------------------------------------------------------

function checkEnd(state) {
  const e = state.encounter;
  if (!e) return true;
  if (isDead(state.player)) { defeat(state); return true; }
  if (living(state).length === 0) { victory(state); return true; }
  return false;
}

function victory(state) {
  logEvent(state, 'The way is clear.');
  endEncounter(state, 'victory');
}

function defeat(state) {
  logEvent(state, 'You fall in the dark.');
  state.encounter = null;
  state.mode = 'REPORT';
  state.reportReason = 'defeat';
}

function endEncounter(state, reason) {
  for (const e of state.encounter?.enemies || []) e.ent.engaged = false;
  state.encounter = null;
  state.mode = 'EXPLORE';
  state.encounterCooldown = state.t + RETRIGGER_MS; // brief re-aggro grace
}

/** Actions available this turn (for the menu). */
export function availableActions(state) {
  const e = state.encounter;
  if (!e || e.phase !== 'player') return [];
  const near = nearestEnemy(state);
  const canAttack = near && (near.band === 'immediate' || near.band === 'short');
  return [
    { id: 'attack', label: canAttack ? 'Attack' : 'Attack (too far)', disabled: !canAttack },
    { id: 'fleet', label: 'Fleet of Foot' },
    { id: 'aggression', label: state.player.aggression ? 'Aggression ✓' : 'Aggression' },
    { id: 'catch', label: 'Catch Breath' },
    { id: 'defend', label: 'Defend' },
    { id: 'flee', label: 'Flee' },
  ];
}
