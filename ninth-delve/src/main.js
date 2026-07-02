// Boot, game loop, and the state-machine spine (Tech §5).
// M2: explore interaction (pickups, sliding doors, secrets), HUD v1, modals.

import { loadAssets, PALETTE } from './engine/texgen.js';
import { makeRNG } from './game/dice.js';
import { createGameState } from './game/state.js';
import { spawnExploreEntities } from './game/entities.js';
import { connectivityTest, moveWithCollision, updateDoors, interact } from './game/world.js';
import { render as renderView } from './engine/raycaster.js';
import { createInput } from './engine/input.js';
import { drawHud } from './ui/hud.js';
import { drawModal } from './ui/menus.js';

const BUF_W = 320, BUF_H = 200;
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
state.entities = spawnExploreEntities(rng);
const input = createInput(screen);
let assets = null;

function openModal(m) {
  state.modal = m;
  state.mode = 'MODAL';
  document.exitPointerLock?.();
  input.clearBuffered();
}

function updateExplore(dt) {
  const p = state.player;
  const turn = ((input.turnR ? 1 : 0) - (input.turnL ? 1 : 0)) * TURN_RATE * dt;
  p.angle += turn + input.consumeYaw() * MOUSE_SENS;

  const dirX = Math.cos(p.angle), dirY = Math.sin(p.angle);
  const mvF = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const mvS = (input.strafeR ? 1 : 0) - (input.strafeL ? 1 : 0);
  const dx = dirX * mvF * MOVE_FWD * dt + (-dirY) * mvS * MOVE_STRAFE * dt;
  const dy = dirY * mvF * MOVE_FWD * dt + (dirX) * mvS * MOVE_STRAFE * dt;
  if (dx || dy) moveWithCollision(state, p, dx, dy);

  updateDoors(state, dt);

  if (input.takeInteract()) {
    const ev = interact(state);
    if (ev) openModal(ev);
  }
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

  const modeAtStart = state.mode; // so the E that opens a modal can't also dismiss it
  input.wantPointerLock = modeAtStart === 'EXPLORE';
  const clicks = []; for (let c; (c = input.takeClick());) clicks.push(c);
  const keys = []; for (let k; (k = input.takeKey());) keys.push(k);

  if (modeAtStart === 'EXPLORE') updateExplore(dt);

  renderView(buf, state, assets);
  if (state.mode !== 'MODAL') drawCrosshair();
  drawHud(buf, state, assets);

  if (modeAtStart === 'MODAL' && state.mode === 'MODAL') {
    if (drawModal(buf, state, clicks, keys)) { state.modal = null; state.mode = 'EXPLORE'; input.clearBuffered(); }
  }

  // fps
  buf.fillStyle = PALETTE.cyan; buf.font = '8px monospace'; buf.textAlign = 'left';
  buf.fillText(`${fps} fps`, 4, 10);

  view.fillStyle = PALETTE.void; view.fillRect(0, 0, screen.width, screen.height);
  view.drawImage(buffer, 0, 0, BUF_W, BUF_H, offX, offY, BUF_W * scale, BUF_H * scale);

  frames++;
  if (now - fpsClock >= 500) { fps = Math.round((frames * 1000) / (now - fpsClock)); frames = 0; fpsClock = now; }
  requestAnimationFrame(loop);
}

function runTests() {
  console.log('%c[Ninth Delve] ?test=1', 'color:#4FE3C1;font-weight:bold');
  const conn = connectivityTest();
  console.group(`connectivity: ${conn.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  conn.checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
  console.groupEnd();
  const unresolved = Object.entries(assets).filter(([, a]) => !a || !a.frames.length);
  const files = Object.values(assets).filter((a) => a.source === 'file').length;
  const fb = Object.values(assets).filter((a) => a.source === 'fallback').length;
  const assetsPass = unresolved.length === 0;
  console.log(`assets: ${assetsPass ? 'PASS ✓' : 'FAIL ✗'} — ${files} file / ${fb} fallback, ${unresolved.length} unresolved`);
  const pass = conn.pass && assetsPass;
  console.log(`%ctest suite: ${pass ? 'PASS ✓' : 'FAIL ✗'}`, `color:${pass ? '#4FE3C1' : '#7A1F2B'};font-weight:bold`);
  window.__NINTH_TEST = { pass, connectivity: conn, assetsPass };
}

async function boot() {
  resize();
  assets = await loadAssets();
  window.__NINTH = { state, get fps() { return fps; } };
  if (TEST) runTests();
  requestAnimationFrame(loop);
}

boot();
