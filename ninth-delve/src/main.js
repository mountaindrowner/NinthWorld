// Boot, game loop, and the state machine spine (Tech §5). M0 renders a test
// pattern through the real 320×200 → integer-upscale pipeline and wires the
// ?test=1 harness (connectivity + asset resolution). Systems arrive per milestone.

import { loadAssets, PALETTE } from './engine/texgen.js';
import { connectivityTest } from './game/world.js';

const BUF_W = 320, BUF_H = 200;

/** BOOT → TITLE → EXPLORE ⇄ ENCOUNTER … (Tech §5). M0 stops at TITLE. */
const STATE = { BOOT: 'BOOT', TITLE: 'TITLE' };

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

const game = { state: STATE.BOOT, seed: SEED, assets: null, t: 0, fps: 0 };

/** M0 acceptance: a test pattern at 320×200, upscaled — proves the pipeline. */
function drawTestPattern(t) {
  // distance-fog gradient toward the void (the raycaster's mood, previewed)
  const grad = buf.createLinearGradient(0, 0, 0, BUF_H);
  grad.addColorStop(0, PALETTE.deepSteel);
  grad.addColorStop(0.5, PALETTE.steel);
  grad.addColorStop(1, PALETTE.void);
  buf.fillStyle = grad;
  buf.fillRect(0, 0, BUF_W, BUF_H);

  // 16-color palette swatch grid (proves the locked palette is wired)
  const cols = Object.values(PALETTE);
  const sw = 16, sh = 16, cols8 = 8;
  cols.forEach((hex, i) => {
    const x = 16 + (i % cols8) * (sw + 2);
    const y = 132 + ((i / cols8) | 0) * (sh + 2);
    buf.fillStyle = hex; buf.fillRect(x, y, sw, sh);
    buf.strokeStyle = PALETTE.void; buf.strokeRect(x + 0.5, y + 0.5, sw, sh);
  });

  // a pulsing numenera glow accent (gold + cyan, accents only)
  const pulse = 0.5 + 0.5 * Math.sin(t / 400);
  buf.fillStyle = PALETTE.gold;
  buf.globalAlpha = 0.4 + 0.4 * pulse;
  buf.beginPath(); buf.arc(BUF_W / 2, 60, 10 + pulse * 4, 0, Math.PI * 2); buf.fill();
  buf.globalAlpha = 1;

  // a few resolved-asset thumbnails (proves the fallback registry works)
  if (game.assets) {
    const keys = ['wall_synth', 'door_glyph', 'laak', 'artifact_key', 'd20_strip'];
    keys.forEach((k, i) => {
      const a = game.assets[k];
      if (!a) return;
      const fr = a.frames[((t / 200) | 0) % a.frames.length];
      buf.drawImage(fr, 224 + (i % 3) * 32, 24 + ((i / 3) | 0) * 34, 28, 28);
    });
  }

  // title + FPS
  buf.fillStyle = PALETTE.boneLight;
  buf.font = '16px monospace'; buf.textAlign = 'center';
  buf.fillText('NINTH DELVE', BUF_W / 2, 30);
  buf.font = '8px monospace';
  buf.fillStyle = PALETTE.boneShadow;
  buf.fillText('M0 — scaffold & fallback art', BUF_W / 2, 44);
  buf.textAlign = 'left';
  buf.fillStyle = PALETTE.cyan;
  buf.fillText(`${game.fps} fps`, 6, 12);
  buf.fillText(`seed ${game.seed}`, 6, 22);
}

function blit() {
  view.fillStyle = PALETTE.void;
  view.fillRect(0, 0, screen.width, screen.height);
  view.drawImage(buffer, 0, 0, BUF_W, BUF_H, offX, offY, BUF_W * scale, BUF_H * scale);
}

let last = performance.now(), frames = 0, fpsClock = last;
function loop(now) {
  game.t = now;
  drawTestPattern(now);
  blit();

  frames++;
  if (now - fpsClock >= 500) { game.fps = Math.round((frames * 1000) / (now - fpsClock)); frames = 0; fpsClock = now; }
  last = now;
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
  console.log(`%cM0 acceptance: ${pass ? 'PASS ✓' : 'FAIL ✗'}`, `color:${pass ? '#4FE3C1' : '#7A1F2B'};font-weight:bold`);
  window.__NINTH_TEST = { pass, connectivity: conn, assetsPass };
}

async function boot() {
  resize();
  game.assets = await loadAssets();
  game.state = STATE.TITLE;
  window.__NINTH = game;
  if (TEST) runTests();
  requestAnimationFrame(loop);
}

boot();
