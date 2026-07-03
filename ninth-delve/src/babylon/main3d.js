// main3d.js — the Babylon build of Ninth Delve. Forked from src/main.js: the
// GAME layer (state, movement+collision, combat, doors, intrusions, XP, modes)
// is byte-identical imports of the same modules; only the world renderer
// changed (scene3d instead of the raycaster) and the UI draws onto a
// transparent canvas floated above the 3D view. The classic build remains at
// index.html; this one lives at babylon.html.

import { loadAssets, PALETTE } from '../engine/texgen.js';
import { makeRNG } from '../game/dice.js';
import { createGameState, logEvent, awardXP, requestWhisper, feedLine as feedLine2 } from '../game/state.js';
import { initAudio, setZoneDrone, sfx } from '../engine/audio.js';
import { WHISPERS } from '../data/whispers.js';
import { spawnExploreEntities } from '../game/entities.js';
import { moveWithCollision, updateDoors, interact, startClimb, zoneAt, tileDist, hasLOS, cellAt, updateSeen } from '../game/world.js';
import { updateCombat, playerSwing, toggleAggression } from '../game/combat.js';
import { pumpScripted, queueScripted, scriptedIntrusion } from '../game/intrusions.js';
import { CELL, MURALS } from '../data/map_whisperlock.js';
import { createInput } from '../engine/input.js';
import { drawHud } from '../ui/hud.js';
import { drawModal, drawSheet, drawCypherMenu, drawGlyphPuzzle, openRestMenu } from '../ui/menus.js';
import { drawReport } from '../ui/report.js';
import { drawMinimap, drawMapOverlay, objectiveText } from '../ui/minimap.js';
import { drawTouchControls } from '../ui/touch.js';
import { text as uiText, bar as uiBar } from '../ui/widgets.js';
import { BUF_W, BUF_H } from '../engine/screen.js';
import { createScene3D } from './scene3d.js';

const MOVE_FWD = 4, MOVE_STRAFE = 3, TURN_RATE = 2.5, MOUSE_SENS = 0.0022;
const params = new URLSearchParams(location.search);
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) | 0) : 1;

const view3d = document.getElementById('view3d');
const uiCanvas = document.getElementById('ui');
const buf = uiCanvas.getContext('2d');

const rng = makeRNG(SEED);
const state = createGameState(rng, SEED);
state.mode = 'TITLE';
state.entities = spawnExploreEntities(rng);
const input = createInput(uiCanvas);   // the UI canvas is the interaction surface

let K = 1, offX = 0, offY = 0, scene3;
function resize() {
  uiCanvas.width = window.innerWidth;
  uiCanvas.height = window.innerHeight;
  K = Math.min(uiCanvas.width / BUF_W, uiCanvas.height / BUF_H);
  offX = (uiCanvas.width - BUF_W * K) / 2;
  offY = (uiCanvas.height - BUF_H * K) / 2;
  input.viewport = { scale: K, offX, offY };
  scene3?.engine.resize();
}
window.addEventListener('resize', resize);

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

const MURAL = MURALS[0];
function exploreWorldEvents() {
  const p = state.player;
  const zx = Math.floor(p.x), zy = Math.floor(p.y);
  const z = zoneAt(zx, zy);
  if (z && z !== state.droneZone) { state.droneZone = z; setZoneDrone(z); }
  if (z && !state.visitedZones.has(z)) {
    state.visitedZones.add(z);
    awardXP(state, 1, `zone:${z}`);
    if (z === 'Z2') { queueScripted(state, 'Z1'); queueScripted(state, 'Z2'); }
  }
  if (!state.glyph.muralSeen && tileDist(p.x, p.y, MURAL[0] + 0.5, MURAL[1] + 0.5) < 2.4 && hasLOS(state, p.x, p.y, MURAL[0] + 0.5, MURAL[1] + 0.5)) {
    state.glyph.muralSeen = true; logEvent(state, 'The nest mural shows a sequence of three glyphs.');
  }
  if (state.keyTaken && tileDist(p.x, p.y, 18.5, 1.5) < 3.5 && hasLOS(state, p.x, p.y, 18.5, 1.5)) requestWhisper(state, 'exit');
  if (cellAt(zx, zy) === CELL.EXIT) {
    if (state.keyTaken) { awardXP(state, 2, 'clear'); state.reportReason = 'exit'; state.exited = true; state.mode = 'REPORT'; }
    else if (!state.exitPrompted) { state.exitPrompted = true; logEvent(state, 'The exit is sealed — you need the Whisperlock Key.'); }
  }
}

function updateExplore(dt) {
  const p = state.player;
  const turn = ((input.turnR ? 1 : 0) - (input.turnL ? 1 : 0)) * TURN_RATE * dt;
  const yawD = input.consumeYaw() * MOUSE_SENS;
  p.angle += turn + yawD;
  tut.looked += Math.abs(turn) + Math.abs(yawD);

  const dirX = Math.cos(p.angle), dirY = Math.sin(p.angle);
  let mvF = input.touchActive ? -input.analogY : (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  let mvS = input.touchActive ? input.analogX : (input.strafeR ? 1 : 0) - (input.strafeL ? 1 : 0);
  const mvLen = Math.hypot(mvF, mvS);
  if (mvLen > 1) { mvF /= mvLen; mvS /= mvLen; }
  const dx = dirX * mvF * MOVE_FWD * dt + (-dirY) * mvS * MOVE_STRAFE * dt;
  const dy = dirY * mvF * MOVE_FWD * dt + (dirX) * mvS * MOVE_STRAFE * dt;
  if (dx || dy) moveWithCollision(state, p, dx, dy);   // the game's collision, unchanged

  updateDoors(state, dt);

  if (input.takeInteract()) {
    const ev = interact(state);
    if (ev && ev.kind === 'glyph') openGlyph();
    else if (ev && ev.kind === 'climb') { document.exitPointerLock?.(); startClimb(state); input.clearBuffered(); }
    else if (ev) openModal(ev);
  }

  for (let s; (s = input.takeSwing());) playerSwing(state, s.heavy);
  updateCombat(state, dt);

  exploreWorldEvents();
  updateSeen(state);
  const obj = objectiveText(state);
  if (obj !== state.lastObjective) { state.lastObjective = obj; feedLine2(state, `goal — ${obj}`, PALETTE.goldGlow); }
  pumpScripted(state);
}

function openGlyph() {
  document.exitPointerLock?.();
  input.clearBuffered();
  if (!state.firedScripted.has('Z3')) scriptedIntrusion(state, 'Z3', () => { state.mode = 'GLYPH'; });
  else state.mode = 'GLYPH';
}

// --- calibration prompts (same as classic) ------------------------------------
const tut = { looked: 0, heavy: false, cyMenu: false };
function tutPrompt() {
  const p = state.player;
  const engaged = state.entities.some((e) => e.kind === 'creature' && e.alive && !e.hidden && e.engaged);
  const nearPickup = state.entities.some((e) => e.kind === 'pickup' && !e.hidden && !e.taken && tileDist(p.x, p.y, e.x, e.y) < 2.2);
  const collected = p.shins > 5 || p.cyphers.length > 0 || p.oddities.length > 0;
  const touch = input.touchActive;
  if (engaged && state.stats.kills === 0) return touch ? 'calibration: ATK — swing your blade' : 'calibration: click — swing your blade';
  if (!touch && engaged && state.stats.kills >= 1 && !tut.heavy) return 'calibration: hold, then release — a heavier cut';
  if (nearPickup && !collected) return 'calibration: E — take what you find';
  if (p.cyphers.length > 0 && !tut.cyMenu) return 'calibration: C — the devices you carry';
  const spawnDist = tileDist(p.x, p.y, 2.5, 22.5);
  if (spawnDist < 2.5) return touch ? 'calibration: push the stick — walk' : 'calibration: W A S D — walk';
  if (tut.looked < 1.2) return touch ? 'calibration: drag the view — look' : 'calibration: move the mouse — look';
  return null;
}
function drawTutorial() {
  if (state.player.swingHeavy) tut.heavy = true;
  const msg = tutPrompt();
  if (!msg) return;
  buf.globalAlpha = 0.65 + 0.35 * Math.sin(state.t / 350);
  uiText(buf, msg, BUF_W / 2, BUF_H - 46, { color: PALETTE.cyan, align: 'center' });
  buf.globalAlpha = 1;
}

function drawCrosshair() {
  buf.fillStyle = PALETTE.boneLight;
  buf.fillRect(BUF_W / 2 - 3, BUF_H / 2, 6, 1);
  buf.fillRect(BUF_W / 2, BUF_H / 2 - 3, 1, 6);
}

function drawTitle() {
  buf.globalAlpha = 0.62;
  buf.fillStyle = PALETTE.void; buf.fillRect(0, 0, BUF_W, BUF_H);
  buf.globalAlpha = 1;
  uiText(buf, 'THE WHISPERLOCK', BUF_W / 2, 96, { color: PALETTE.gold, size: 18, align: 'center' });
  uiText(buf, 'the lock will calibrate you as you go', BUF_W / 2, 114, { color: PALETTE.boneShadow, align: 'center' });
  if ((state.t / 600 | 0) % 2) uiText(buf, 'click, or press Enter, to delve', BUF_W / 2, 150, { color: PALETTE.cyan, align: 'center' });
  uiText(buf, 'WASD move · mouse look (up & down!) · click swing, hold heavy · E take · C cyphers · Tab sheet', BUF_W / 2, 182, { color: PALETTE.boneShadow, align: 'center' });
}

// world-anchored popups + creature health bars, projected onto the UI canvas
const BAR_H = { laak: 0.9, hound: 1.5, murden: 1.85, abykos: 2.9 };
function drawWorldOverlays() {
  state.popups = (state.popups || []).filter((pop) => state.t - pop.t0 < 900);
  for (const pop of state.popups) {
    const age = (state.t - pop.t0) / 900;
    const pr = scene3.project(pop.x, pop.y, 1.1 + age * 0.7);
    if (!pr.visible) continue;
    const lx = (pr.x * uiCanvas.width - offX) / K, ly = (pr.y * uiCanvas.height - offY) / K;
    buf.globalAlpha = Math.max(0, 1 - age * 0.8);
    uiText(buf, pop.txt, lx, ly, { color: pop.color || PALETTE.goldGlow, align: 'center' });
    buf.globalAlpha = 1;
  }
  for (const e of state.entities) {
    if (e.kind !== 'creature' || !e.alive || e.hidden || e.hp >= e.maxHp) continue;
    if (tileDist(state.player.x, state.player.y, e.x, e.y) > 12) continue;
    const pr = scene3.project(e.x, e.y, BAR_H[e.creatureId] ?? 1.6);
    if (!pr.visible) continue;
    const lx = (pr.x * uiCanvas.width - offX) / K, ly = (pr.y * uiCanvas.height - offY) / K;
    uiBar(buf, lx - 12, ly - 3, 24, 4, Math.max(0, e.hp / e.maxHp), PALETTE.blood);
  }
}

function drawFeedAndFx() {
  // message log: bottom-left, newest nearest the HUD (Morrowind's spot).
  // Explore only — menus and the map get the screen to themselves.
  if (state.mode === 'EXPLORE' && state.rollFeed?.length) {
    const vis = state.rollFeed.filter((l) => (state.t - l.t0) / 4500 <= 1);
    let fy = BUF_H - 52 - (vis.length - 1) * 10;
    for (const l of vis) {
      const age = (state.t - l.t0) / 4500;
      buf.globalAlpha = Math.min(1, (1 - age) * 3);
      uiText(buf, l.txt, 4, fy, { color: l.color || PALETTE.boneLight });
      fy += 10;
    }
    buf.globalAlpha = 1;
  }
  // whisper box (hidden while the map covers its spot)
  if (state.mode !== 'MAP' && state.whisper && state.t < state.whisper.until) {
    const remain = (state.whisper.until - state.t) / 5500;
    buf.globalAlpha = Math.min(1, remain * 3);
    buf.fillStyle = PALETTE.deepSteel; buf.fillRect(20, 6, BUF_W - 40, 22);
    buf.strokeStyle = PALETTE.mauve; buf.lineWidth = 1; buf.strokeRect(20.5, 6.5, BUF_W - 41, 21);
    buf.fillStyle = PALETTE.mauve; buf.font = '8px monospace'; buf.textAlign = 'center';
    const wtxt = state.whisper.text;
    let cut = wtxt.length > 62 ? wtxt.lastIndexOf(' ', 62) : wtxt.length;
    if (cut <= 0) cut = 62;
    buf.fillText(wtxt.slice(0, cut), BUF_W / 2, 15, BUF_W - 48);
    if (cut < wtxt.length) buf.fillText(wtxt.slice(cut + 1), BUF_W / 2, 24, BUF_W - 48);
    buf.globalAlpha = 1;
  }
  // hurt flash
  if (state.t < state.fx.flashUntil) {
    buf.globalAlpha = 0.30 * ((state.fx.flashUntil - state.t) / 150);
    buf.fillStyle = state.fx.flashColor; buf.fillRect(0, 0, BUF_W, BUF_H);
    buf.globalAlpha = 1;
  }
  uiText(buf, `${scene3.engine.getFps().toFixed(0)} fps · 3D`, BUF_W - 4, 9, { color: PALETTE.cyan, align: 'right' });
}

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, scene3.engine.getDeltaTime() / 1000) || 0.016;
  state.t = now;

  const modeAtStart = state.mode;
  input.wantPointerLock = modeAtStart === 'EXPLORE';
  const clicks = []; for (let c; (c = input.takeClick());) clicks.push(c);
  const keys = []; for (let k; (k = input.takeKey());) keys.push(k);

  if (state.pendingWhisper) {
    const key = state.pendingWhisper; state.pendingWhisper = null; state.shownWhispers.add(key);
    state.whisper = { text: WHISPERS[key] || '', until: state.t + 5500 }; sfx.whisper();
  }
  for (const e of state.entities) if (e.frameUntil && state.t > e.frameUntil) { e.frame = null; e.frameUntil = 0; }
  if (state.mode === 'REPORT' && !state.endTime) state.endTime = state.t;

  if (modeAtStart === 'TITLE') {
    if (clicks.length || keys.includes('Enter') || keys.includes('KeyE') || keys.includes('Space')) startDelve();
  } else if (modeAtStart === 'EXPLORE') {
    updateExplore(dt);
    if (keys.includes('KeyR')) { openRestMenu(state); input.clearBuffered(); }
    if (keys.includes('KeyF')) toggleAggression(state);
    if (keys.includes('KeyM')) { state.mode = 'MAP'; document.exitPointerLock?.(); input.clearBuffered(); }
    if (keys.includes('KeyP')) scene3.cyclePixel();
    if (keys.includes('Tab')) { state.mode = 'SHEET'; document.exitPointerLock?.(); input.clearBuffered(); }
    else if (keys.includes('KeyC')) { tut.cyMenu = true; state.cypherMenu = { context: 'explore', ret: 'EXPLORE' }; state.mode = 'CYPHERS'; document.exitPointerLock?.(); input.clearBuffered(); }
  }

  // the 3D body mirrors the game, then renders
  scene3.sync(input, dt);
  scene3.scene.render();

  // UI pass on the transparent overlay (identical modules to classic)
  buf.setTransform(1, 0, 0, 0 + 1, 0, 0);
  buf.clearRect(0, 0, uiCanvas.width, uiCanvas.height);
  buf.setTransform(K, 0, 0, K, offX, offY);
  buf.imageSmoothingEnabled = false;

  if (state.mode === 'TITLE') { drawTitle(); drawFeedAndFx(); return; }
  if (state.mode === 'EXPLORE') { drawCrosshair(); drawTutorial(); drawMinimap(buf, state); }
  drawWorldOverlays();
  drawHud(buf, state, assets);
  if (state.mode === 'EXPLORE' && input.touchActive) drawTouchControls(buf, input);

  if (modeAtStart === 'MODAL' && state.mode === 'MODAL') {
    if (drawModal(buf, state, clicks, keys)) {
      const m = state.modal, back = state.prevMode || 'EXPLORE';
      state.modal = null; state.prevMode = null; state.mode = back; input.clearBuffered();
      m.onResolve?.(m.result);
    }
  } else if (modeAtStart === 'SHEET' && state.mode === 'SHEET') {
    if (drawSheet(buf, state, clicks, keys, assets)) { state.mode = 'EXPLORE'; input.clearBuffered(); }
  } else if (modeAtStart === 'GLYPH' && state.mode === 'GLYPH') {
    if (drawGlyphPuzzle(buf, state, clicks, keys)) { state.mode = 'EXPLORE'; input.clearBuffered(); }
  } else if (modeAtStart === 'MAP' && state.mode === 'MAP') {
    if (drawMapOverlay(buf, state, clicks, keys, input.touchActive)) { state.mode = 'EXPLORE'; input.clearBuffered(); }
  } else if (modeAtStart === 'CYPHERS' && state.mode === 'CYPHERS') {
    drawCypherMenu(buf, state, clicks, keys);
  } else if (state.mode === 'REPORT') {
    drawReport(buf, state, clicks, keys);
  }
  drawFeedAndFx();
}

let assets = null;
async function boot() {
  assets = await loadAssets();
  scene3 = createScene3D(view3d, state, assets);
  resize();
  window.__NINTH = { state, scene3, get fps() { return scene3.engine.getFps(); } };
  scene3.engine.runRenderLoop(frame);
}
boot();
