// Boot, game loop, and the state machine spine (Tech §5). M1 renders the
// first-person raycaster view and drives explore-mode movement. The ?test=1
// harness (connectivity + asset resolution) still runs before the loop.

import { loadAssets, PALETTE } from './engine/texgen.js';
import { connectivityTest, moveWithCollision } from './game/world.js';
import { render as renderView } from './engine/raycaster.js';
import { createInput } from './engine/input.js';
import { PLACEMENTS, FACING } from './data/map_whisperlock.js';

const BUF_W = 320, BUF_H = 200;

/** BOOT → TITLE → EXPLORE ⇄ ENCOUNTER … (Tech §5). M1 boots into EXPLORE. */
const STATE = { BOOT: 'BOOT', EXPLORE: 'EXPLORE' };

// Explore movement (Tech §4): 4 fwd / 3 strafe cells·s⁻¹, ~2.5 rad·s⁻¹ turn.
const MOVE_FWD = 4, MOVE_STRAFE = 3, TURN_RATE = 2.5, MOUSE_SENS = 0.0022;

const params = new URLSearchParams(location.search);
const TEST = params.has('test');
const SEED = params.has('seed') ? (parseInt(params.get('seed'), 10) | 0) : 1; // RNG lands in M3

const screen = document.getElementById('screen');
const view = screen.getContext('2d');
view.imageSmoothingEnabled = false;

// Offscreen 320×200 buffer; everything draws here, then integer-upscales.
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
}
window.addEventListener('resize', resize);

const spawn = PLACEMENTS.find((pl) => pl.id === 'P');
const game = {
  state: STATE.BOOT,
  seed: SEED,
  assets: null,
  fps: 0,
  player: { x: spawn.x + 0.5, y: spawn.y + 0.5, angle: FACING[spawn.facing] },
};
const input = createInput(screen);

function update(dt) {
  const p = game.player;
  // turning: Q/E or arrows, plus consumed pointer-lock yaw
  const turn = ((input.turnR ? 1 : 0) - (input.turnL ? 1 : 0)) * TURN_RATE * dt;
  p.angle += turn + input.consumeYaw() * MOUSE_SENS;

  // movement relative to facing (right vector = (−dirY, dirX))
  const dirX = Math.cos(p.angle), dirY = Math.sin(p.angle);
  const mvF = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const mvS = (input.strafeR ? 1 : 0) - (input.strafeL ? 1 : 0);
  const dx = dirX * mvF * MOVE_FWD * dt + (-dirY) * mvS * MOVE_STRAFE * dt;
  const dy = dirY * mvF * MOVE_FWD * dt + (dirX) * mvS * MOVE_STRAFE * dt;
  if (dx || dy) moveWithCollision(p, dx, dy);
}

function drawHud() {
  buf.fillStyle = PALETTE.cyan;
  buf.font = '8px monospace'; buf.textAlign = 'left';
  buf.fillText(`${game.fps} fps`, 4, 10);
  if (!input.locked) {
    buf.fillStyle = PALETTE.boneShadow; buf.textAlign = 'center';
    buf.fillText('click to look · WASD move · Q/E turn', BUF_W / 2, BUF_H - 8);
  }
  // crosshair
  buf.fillStyle = PALETTE.boneLight;
  buf.fillRect(BUF_W / 2 - 3, BUF_H / 2, 6, 1);
  buf.fillRect(BUF_W / 2, BUF_H / 2 - 3, 1, 6);
}

function blit() {
  view.fillStyle = PALETTE.void;
  view.fillRect(0, 0, screen.width, screen.height);
  view.drawImage(buffer, 0, 0, BUF_W, BUF_H, offX, offY, BUF_W * scale, BUF_H * scale);
}

let fpsClock = 0, frames = 0, prev = 0;
function loop(now) {
  const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 0; // clamp long frames
  prev = now;

  if (game.state === STATE.EXPLORE) update(dt);
  renderView(buf, game.player, game.assets);
  drawHud();
  blit();

  frames++;
  if (now - fpsClock >= 500) { game.fps = Math.round((frames * 1000) / (now - fpsClock)); frames = 0; fpsClock = now; }
  requestAnimationFrame(loop);
}

/** ?test=1 harness — logs pass/fail (CLAUDE.md run & test). */
function runTests() {
  console.log('%c[Ninth Delve] ?test=1', 'color:#4FE3C1;font-weight:bold');

  const conn = connectivityTest();
  console.group(`connectivity: ${conn.pass ? 'PASS ✓' : 'FAIL ✗'}`);
  conn.checks.forEach(([name, ok]) => console.log(`${ok ? '✓' : '✗'} ${name}`));
  console.groupEnd();

  const unresolved = Object.entries(game.assets).filter(([, a]) => !a || !a.frames.length);
  const files = Object.values(game.assets).filter((a) => a.source === 'file').length;
  const fb = Object.values(game.assets).filter((a) => a.source === 'fallback').length;
  const assetsPass = unresolved.length === 0;
  console.log(`assets: ${assetsPass ? 'PASS ✓' : 'FAIL ✗'} — ${files} file / ${fb} fallback, ${unresolved.length} unresolved`);

  const pass = conn.pass && assetsPass;
  console.log(`%ctest suite: ${pass ? 'PASS ✓' : 'FAIL ✗'}`, `color:${pass ? '#4FE3C1' : '#7A1F2B'};font-weight:bold`);
  window.__NINTH_TEST = { pass, connectivity: conn, assetsPass };
}

async function boot() {
  resize();
  game.assets = await loadAssets();
  game.state = STATE.EXPLORE;
  window.__NINTH = game;
  if (TEST) runTests();
  requestAnimationFrame(loop);
}

boot();
