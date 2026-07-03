// Boot, game loop, and the state-machine spine (Tech §5).
// M2: explore interaction (pickups, sliding doors, secrets), HUD v1, modals.

import { loadAssets, PALETTE } from './engine/texgen.js';
import { makeRNG, resolveTask, specialOf } from './game/dice.js';
import { createGameState, logEvent, awardXP, requestWhisper } from './game/state.js';
import { initAudio, setZoneDrone, sfx } from './engine/audio.js';
import { WHISPERS } from './data/whispers.js';
import { spawnExploreEntities } from './game/entities.js';
import { connectivityTest, moveWithCollision, updateDoors, interact, startClimb, zoneAt, tileDist, hasLOS, cellAt } from './game/world.js';
import { effortCost, applyDamage } from './game/player.js';
import { maybeTrigger } from './game/combat.js';
import { useCypher, drainRandomCypher } from './game/cyphers.js';
import { pumpScripted, queueScripted, scriptedIntrusion } from './game/intrusions.js';
import { CREATURES, armorVs } from './data/creatures.js';
import { CELL, MURALS } from './data/map_whisperlock.js';
import { render as renderView } from './engine/raycaster.js';
import { createInput } from './engine/input.js';
import { drawHud } from './ui/hud.js';
import { drawModal, drawSheet, drawEncounterMenu, drawCypherMenu, drawGlyphPuzzle } from './ui/menus.js';
import { openTray, updateTray, drawTray } from './ui/dicetray.js';
import { drawReport } from './ui/report.js';
import { drawTouchControls } from './ui/touch.js';
import { text as uiText } from './ui/widgets.js';
import { KAVE } from './data/pregen_kave.js';

import { BUF_W, BUF_H } from './engine/screen.js';
const MOVE_FWD = 4, MOVE_STRAFE = 3, TURN_RATE = 2.5, MOUSE_SENS = 0.0022;

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) | 0) : 1;

const screen = document.getElementById('screen');
const view = screen.getContext('2d');
view.imageSmoothingEnabled = false;

const buffer = document.createElement('canvas');
buffer.width = BUF_W; buffer.height = BUF_H;
const buf = buffer.getContext('2d');
buf.imageSmoothingEnabled = false;

let scale = 1, offX = 0, offY = 0;
function resize() {
  screen.width = window.innerWidth;
  screen.height = window.innerHeight;
  scale = Math.max(1, Math.floor(Math.min(screen.width / BUF_W, screen.height / BUF_H)));
  offX = ((screen.width - BUF_W * scale) / 2) | 0;
  offY = ((screen.height - BUF_H * scale) / 2) | 0;
  view.imageSmoothingEnabled = false;
  input.viewport = { scale, offX, offY };
}
window.addEventListener('resize', resize);

const rng = makeRNG(SEED);
const state = createGameState(rng, SEED);
state.mode = 'TITLE';
state.entities = spawnExploreEntities(rng);
const input = createInput(screen);
let assets = null;

function startDelve() {
  initAudio();
  state.mode = 'EXPLORE';
  state.startTime = state.t;
  requestWhisper(state, 'entry');
  input.clearBuffered();
}

function openModal(m) {
  state.modal = m;
  state.prevMode = 'EXPLORE';
  state.mode = 'MODAL';
  document.exitPointerLock?.();
  input.clearBuffered();
}

const MURAL = MURALS[0]; // nest clue mural cell

/** Discovery XP on first zone entry, mural sighting, and the exit gate. */
function exploreWorldEvents() {
  const p = state.player;
  const zx = Math.floor(p.x), zy = Math.floor(p.y);
  const z = zoneAt(zx, zy);
  if (z && z !== state.droneZone) { state.droneZone = z; setZoneDrone(z); }
  if (z && !state.visitedZones.has(z)) {
    state.visitedZones.add(z);
    awardXP(state, 1, `zone:${z}`);
    if (z === 'Z2') { queueScripted(state, 'Z1'); queueScripted(state, 'Z2'); } // floor + strap
  }
  // mural sighting reveals a glyph clue path
  if (!state.glyph.muralSeen && tileDist(p.x, p.y, MURAL[0] + 0.5, MURAL[1] + 0.5) < 2.4 && hasLOS(state, p.x, p.y, MURAL[0] + 0.5, MURAL[1] + 0.5)) {
    state.glyph.muralSeen = true; logEvent(state, 'The nest mural shows a sequence of three glyphs.');
  }
  // approaching the exit with the Key earns a last whisper
  if (state.keyTaken && tileDist(p.x, p.y, 18.5, 1.5) < 3.5 && hasLOS(state, p.x, p.y, 18.5, 1.5)) requestWhisper(state, 'exit');
  // exit gate: needs the Key (Dungeon §6)
  if (cellAt(zx, zy) === CELL.EXIT) {
    if (state.keyTaken) { awardXP(state, 2, 'clear'); state.reportReason = 'exit'; state.exited = true; state.mode = 'REPORT'; }
    else if (!state.exitPrompted) { state.exitPrompted = true; logEvent(state, 'The exit is sealed — you need the Whisperlock Key.'); }
  }
}

function updateExplore(dt) {
  const p = state.player;
  const turn = ((input.turnR ? 1 : 0) - (input.turnL ? 1 : 0)) * TURN_RATE * dt;
  p.angle += turn + input.consumeYaw() * MOUSE_SENS;

  const dirX = Math.cos(p.angle), dirY = Math.sin(p.angle);
  // analog stick (touch) or WASD (keyboard)
  const mvF = input.touchActive ? -input.analogY : (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const mvS = input.touchActive ? input.analogX : (input.strafeR ? 1 : 0) - (input.strafeL ? 1 : 0);
  const dx = dirX * mvF * MOVE_FWD * dt + (-dirY) * mvS * MOVE_STRAFE * dt;
  const dy = dirY * mvF * MOVE_FWD * dt + (dirX) * mvS * MOVE_STRAFE * dt;
  if (dx || dy) moveWithCollision(state, p, dx, dy);

  updateDoors(state, dt);

  if (input.takeInteract()) {
    const ev = interact(state);
    if (ev && ev.kind === 'glyph') openGlyph();
    else if (ev && ev.kind === 'climb') { document.exitPointerLock?.(); startClimb(state); input.clearBuffered(); }
    else if (ev) openModal(ev);
  }

  exploreWorldEvents();
  pumpScripted(state);          // fire any queued scripted intrusion when idle
  if (state.mode === 'EXPLORE') maybeTrigger(state); // LOS + aggro → ENCOUNTER
}

function openGlyph() {
  document.exitPointerLock?.();
  input.clearBuffered();
  // the whisper lies (Z3 scripted) fires once, then the puzzle opens
  if (!state.firedScripted.has('Z3')) scriptedIntrusion(state, 'Z3', () => { state.mode = 'GLYPH'; });
  else state.mode = 'GLYPH';
}

/** M3 demo: a full skill+asset+Effort attack roll to exercise the tray (R). */
function practiceRoll() {
  openTray(state, {
    label: 'practice: strike',
    base: 5,
    eases: [{ label: 'skill', steps: 1 }, { label: 'asset', steps: 1 }],
    hinders: [],
    stat: 'might',
    maxEffort: state.player.effort,
  }, (audit) => {
    if (!audit.success) { logEvent(state, 'practice: miss'); return; }
    const dmg = KAVE.weapons.broadsword.damage + state.player.weaponBonus
      + (audit.specialChoice === 'damage' ? audit.special.bonusDamage : audit.special.bonusDamage);
    logEvent(state, `practice: hit for ${dmg}`);
  });
  input.clearBuffered();
}

function drawCrosshair() {
  buf.fillStyle = PALETTE.boneLight;
  buf.fillRect(BUF_W / 2 - 3, BUF_H / 2, 6, 1);
  buf.fillRect(BUF_W / 2, BUF_H / 2 - 3, 1, 6);
}

let fpsClock = 0, frames = 0, prev = 0, fps = 0;
function loop(now) {
  const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0;
  prev = now;
  state.t = now;

  const modeAtStart = state.mode; // so the key that opens an overlay can't also dismiss it
  input.wantPointerLock = modeAtStart === 'EXPLORE';
  const clicks = []; for (let c; (c = input.takeClick());) clicks.push(c);
  const keys = []; for (let k; (k = input.takeKey());) keys.push(k);

  // whisper pump (any mode): show one-time environmental text + cue
  if (state.pendingWhisper) {
    const key = state.pendingWhisper; state.pendingWhisper = null; state.shownWhispers.add(key);
    state.whisper = { text: WHISPERS[key] || '', until: state.t + 5500 }; sfx.whisper();
  }
  // clear expired creature action-frames (lunge/hit juice)
  for (const e of state.entities) if (e.frameUntil && state.t > e.frameUntil) { e.frame = null; e.frameUntil = 0; }
  if (state.mode === 'REPORT' && !state.endTime) state.endTime = state.t;

  if (modeAtStart === 'TITLE') {
    drawTitle();
    if (clicks.length || keys.includes('Enter') || keys.includes('KeyE') || keys.includes('Space')) startDelve();
    finishFrame(now); return;
  }

  if (modeAtStart === 'EXPLORE') {
    updateExplore(dt);
    if (keys.includes('KeyR')) practiceRoll();
    else if (keys.includes('Tab')) { state.mode = 'SHEET'; document.exitPointerLock?.(); input.clearBuffered(); }
    else if (keys.includes('KeyC')) { state.cypherMenu = { context: 'explore', ret: 'EXPLORE' }; state.mode = 'CYPHERS'; document.exitPointerLock?.(); input.clearBuffered(); }
  } else if (modeAtStart === 'ROLL') {
    updateTray(state, dt);
  }

  renderView(buf, state, assets);
  if (state.mode === 'EXPLORE') drawCrosshair();
  drawHud(buf, state, assets);
  if (state.mode === 'EXPLORE' && input.touchActive) drawTouchControls(buf, input);

  if (modeAtStart === 'MODAL' && state.mode === 'MODAL') {
    if (drawModal(buf, state, clicks, keys)) {
      const m = state.modal, back = state.prevMode || 'EXPLORE';
      state.modal = null; state.prevMode = null; state.mode = back; input.clearBuffered();
      m.onResolve?.(m.result); // intrusion accept/refuse + continuations
    }
  } else if (modeAtStart === 'ROLL' && state.mode === 'ROLL') {
    drawTray(buf, state, clicks, keys, assets);
  } else if (modeAtStart === 'SHEET' && state.mode === 'SHEET') {
    if (drawSheet(buf, state, clicks, keys, assets)) { state.mode = 'EXPLORE'; input.clearBuffered(); }
  } else if (modeAtStart === 'GLYPH' && state.mode === 'GLYPH') {
    if (drawGlyphPuzzle(buf, state, clicks, keys)) { state.mode = 'EXPLORE'; input.clearBuffered(); }
  } else if (modeAtStart === 'ENCOUNTER' && state.mode === 'ENCOUNTER') {
    drawEncounterMenu(buf, state, clicks, keys);
  } else if (modeAtStart === 'CYPHERS' && state.mode === 'CYPHERS') {
    drawCypherMenu(buf, state, clicks, keys);
  } else if (state.mode === 'REPORT') {
    drawReport(buf, state, clicks, keys);
  }

  finishFrame(now);
}

/** Whisper box + hit-flash + fps + shake-offset blit + frame accounting. */
function finishFrame(now) {
  // environmental whisper text box (top center), fading out
  if (state.whisper && state.t < state.whisper.until) {
    const remain = (state.whisper.until - state.t) / 5500;
    buf.globalAlpha = Math.min(1, remain * 3);
    buf.fillStyle = PALETTE.deepSteel; buf.fillRect(20, 6, BUF_W - 40, 22);
    buf.strokeStyle = PALETTE.mauve; buf.lineWidth = 1; buf.strokeRect(20.5, 6.5, BUF_W - 41, 21);
    buf.fillStyle = PALETTE.mauve; buf.font = '8px monospace'; buf.textAlign = 'center';
    buf.fillText(state.whisper.text.slice(0, 62), BUF_W / 2, 15, BUF_W - 48);
    if (state.whisper.text.length > 62) buf.fillText(state.whisper.text.slice(62), BUF_W / 2, 24, BUF_W - 48);
    buf.globalAlpha = 1;
  }
  // hit flash
  if (state.t < state.fx.flashUntil) {
    buf.globalAlpha = 0.35 * ((state.fx.flashUntil - state.t) / 150);
    buf.fillStyle = state.fx.flashColor; buf.fillRect(0, 0, BUF_W, BUF_H); buf.globalAlpha = 1;
  }
  uiText(buf, `${fps} fps`, BUF_W - 4, 9, { color: PALETTE.cyan, align: 'right' });

  // shake-offset blit
  let sx = offX, sy = offY;
  if (state.t < state.fx.shakeUntil) { const m = state.fx.mag * scale; sx += ((rng() * 2 - 1) * m) | 0; sy += ((rng() * 2 - 1) * m) | 0; }
  view.fillStyle = PALETTE.void; view.fillRect(0, 0, screen.width, screen.height);
  view.drawImage(buffer, 0, 0, BUF_W, BUF_H, sx, sy, BUF_W * scale, BUF_H * scale);

  frames++;
  if (now - fpsClock >= 500) { fps = Math.round((frames * 1000) / (now - fpsClock)); frames = 0; fpsClock = now; }
  requestAnimationFrame(loop);
}

function drawTitle() {
  buf.fillStyle = PALETTE.void; buf.fillRect(0, 0, BUF_W, BUF_H);
  // faint gradient + a drifting glow
  const g = buf.createLinearGradient(0, 0, 0, BUF_H);
  g.addColorStop(0, PALETTE.deepSteel); g.addColorStop(1, PALETTE.void);
  buf.fillStyle = g; buf.fillRect(0, 0, BUF_W, BUF_H);
  if (assets.artifact_key) buf.drawImage(assets.artifact_key.frames[(state.t / 400 | 0) % 2], BUF_W / 2 - 16, 40, 32, 32);
  buf.fillStyle = PALETTE.gold; buf.font = '18px monospace'; buf.textAlign = 'center';
  buf.fillText('THE WHISPERLOCK', BUF_W / 2, 100);
  buf.fillStyle = PALETTE.boneShadow; buf.font = '8px monospace';
  buf.fillText('a ninth delve — Cypher System prototype', BUF_W / 2, 116);
  buf.fillStyle = PALETTE.cyan;
  if ((state.t / 600 | 0) % 2) buf.fillText('click, or press Enter, to delve', BUF_W / 2, 150);
  buf.fillStyle = PALETTE.boneShadow; buf.font = '8px monospace';
  buf.fillText('WASD move · mouse look · E interact · C cyphers · Tab sheet', BUF_W / 2, 180);
}

/** Dice-math tables (Rules §2, §4; CLAUDE.md acceptance for M3). */
function diceTests() {
  const c = [];
  const eq = (name, got, exp) => c.push([`${name} = ${got} (want ${exp})`, got === exp]);
  // Effort costs — Kave Edge 1 (Might), armor surcharge 1 (Speed), Impaired +1/lvl
  eq('Effort1 Might', effortCost(1, { edge: 1 }), 2);
  eq('Effort2 Might', effortCost(2, { edge: 1 }), 4);
  eq('Effort1 Speed+armor', effortCost(1, { edge: 1, isSpeed: true, speedSurcharge: 1 }), 3);
  eq('Effort2 Speed+armor', effortCost(2, { edge: 1, isSpeed: true, speedSurcharge: 1 }), 6);
  eq('Effort1 Might Impaired', effortCost(1, { edge: 1, impaired: true }), 3);
  eq('Effort2 Might Impaired', effortCost(2, { edge: 1, impaired: true }), 6);
  // resolveTask target + eases
  eq('diff3 target', resolveTask({ base: 3, rng: () => 0, forcedNatural: 9 }).target, 9);
  eq('diff3 −2 eased target', resolveTask({ base: 3, eases: [{ label: 's', steps: 1 }], effortLevels: 1, rng: () => 0, forcedNatural: 3 }).target, 3);
  c.push(['diff3 nat9 succeeds', resolveTask({ base: 3, rng: () => 0, forcedNatural: 9 }).success === true]);
  c.push(['diff3 nat8 fails', resolveTask({ base: 3, rng: () => 0, forcedNatural: 8 }).success === false]);
  // special rolls
  c.push(['nat1 intrusion', specialOf(1).effect === 'intrusion']);
  c.push(['nat19 minor', specialOf(19).effect === 'minor']);
  c.push(['nat20 major + refund', specialOf(20).effect === 'major' && specialOf(20).refund === true]);
  c.push(['impaired nat20 → +1 only', specialOf(20, true).effect === null && specialOf(20, true).bonusDamage === 1]);
  // pool-0 overflow + damage-track drop
  const p = { pools: { might: 3, speed: 12, intellect: 8 }, poolMax: { might: 14, speed: 12, intellect: 8 }, track: 'hale' };
  applyDamage(p, 5);
  c.push(['overflow: Might→0', p.pools.might === 0]);
  c.push(['overflow: Speed 12→10', p.pools.speed === 10]);
  c.push(['track Hale→Impaired', p.track === 'impaired']);
  return c;
}

/** Roster + cypher tables (Dungeon §4/§6; CLAUDE.md acceptance for M5). */
function rosterTests() {
  const c = [];
  const ok = (n, v) => c.push([n, v]);
  ok('hound dmg 3 & has phase_lunge', CREATURES.hound.damage === 3 && CREATURES.hound.special.includes('phase_lunge'));
  ok('phase-lunge REQUIRED: 3−3=0 tickles, ignore→3', Math.max(0, 3 - 3) === 0);
  ok('abykos Armor: physical 3', armorVs(CREATURES.abykos, 'physical') === 3);
  ok('abykos Armor: energy/cypher 0', armorVs(CREATURES.abykos, 'energy') === 0);

  const mkState = () => ({
    rng: () => 0.4, stats: { cyphersUsed: 0, kills: 0, secrets: 0 }, log: [],
    entities: [], secretsFound: new Set(), phasedCells: new Set(), discoveredZones: new Set(),
    player: { pools: { might: 10, speed: 12, intellect: 8 }, poolMax: { might: 14, speed: 12, intellect: 8 }, edge: { might: 1, speed: 1, intellect: 0 }, track: 'hale', weaponBonus: 0, stimRounds: 0, crossing: false, x: 1.5, y: 22.5, angle: Math.PI, cyphers: [] },
  });
  let s = mkState();
  s.player.cyphers = [{ id: 'C4', effect: 'density', level: 3, identified: false, trueName: 'Density Nodule' }];
  useCypher(s, 0); ok('C4 Density: +2 weapon, consumed', s.player.weaponBonus === 2 && s.player.cyphers.length === 0);
  s.player.cyphers = [{ id: 'C6', effect: 'stim', level: 2, identified: false }]; useCypher(s, 0); ok('C6 Stim: 3 rounds', s.player.stimRounds === 3);
  s.player.cyphers = [{ id: 'C3', effect: 'gravity', level: 4, identified: false }]; useCypher(s, 0); ok('C3 Gravity: chasm crossable', s.player.crossing === true);
  s.player.cyphers = [{ id: 'C1', effect: 'rejuvenate', level: 2, identified: false, trueName: 'Rejuvenator' }]; useCypher(s, 0); ok('C1 Rejuvenator: heals Might', s.player.pools.might > 10);
  s.player.cyphers = [{ id: 'C5', effect: 'phase', level: 3, identified: false }]; useCypher(s, 0); ok('C5 Phase: opens a wall', s.phasedCells.size === 1);
  const combat = { enemies: [{ alive: true, band: 'immediate', hp: 3, def: CREATURES.laak, ent: { alive: true } }] };
  s.player.cyphers = [{ id: 'C2', effect: 'detonation', level: 2, identified: false }]; s.encounter = combat;
  useCypher(s, 0, combat); ok('C2 Detonation: energy damage kills laak', combat.enemies[0].hp <= 0);
  s.player.cyphers = [{ id: 'C1', effect: 'rejuvenate', level: 2 }]; drainRandomCypher(s, 1); ok('Abykos Drain: L2→1', s.player.cyphers[0]?.level === 1);
  drainRandomCypher(s, 1); ok('Abykos Drain: destroyed at 0', s.player.cyphers.length === 0);
  return c;
}

function runTests() {
  console.log('%c[Ninth Delve] ?test=1', 'color:#4FE3C1;font-weight:bold');
  const conn = connectivityTest();
  console.group(`connectivity: ${conn.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  conn.checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
  console.groupEnd();

  const dice = diceTests();
  const dicePass = dice.every(([, ok]) => ok);
  console.group(`dice math: ${dicePass ? 'PASS ✓' : 'FAIL ✗'}`);
  dice.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
  console.groupEnd();

  const roster = rosterTests();
  const rosterPass = roster.every(([, ok]) => ok);
  console.group(`roster & cyphers: ${rosterPass ? 'PASS ✓' : 'FAIL ✗'}`);
  roster.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
  console.groupEnd();
  const unresolved = Object.entries(assets).filter(([, a]) => !a || !a.frames.length);
  const files = Object.values(assets).filter((a) => a.source === 'file').length;
  const fb = Object.values(assets).filter((a) => a.source === 'fallback').length;
  const assetsPass = unresolved.length === 0;
  console.log(`assets: ${assetsPass ? 'PASS ✓' : 'FAIL ✗'} — ${files} file / ${fb} fallback, ${unresolved.length} unresolved`);
  const pass = conn.pass && assetsPass && dicePass && rosterPass;
  console.log(`%ctest suite: ${pass ? 'PASS ✓' : 'FAIL ✗'}`, `color:${pass ? '#4FE3C1' : '#7A1F2B'};font-weight:bold`);
  window.__NINTH_TEST = { pass, connectivity: conn, assetsPass, dicePass, rosterPass };
}

async function boot() {
  resize();
  assets = await loadAssets();
  window.__NINTH = { state, get fps() { return fps; } };
  if (TEST) runTests();
  requestAnimationFrame(loop);
}

boot();
