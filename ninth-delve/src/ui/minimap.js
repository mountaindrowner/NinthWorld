// Minimap + full map overlay. The corner map shows what you've SEEN (fog of
// war from world.updateSeen); M opens the full map, which doubles as the
// journal page: current objective, controls, and the rules of the world.

import { MAP, MAP_W, MAP_H, CELL } from '../data/map_whisperlock.js';
import { PALETTE } from '../engine/texgen.js';
import { panel, text, button } from './widgets.js';
import { BUF_W, BUF_H } from '../engine/screen.js';

const keyOf = (x, y) => y * MAP_W + x;
const cellCh = (x, y) => (MAP[y] && MAP[y][x]) || '#';

/** What should the player be doing right now? (the "tutorial on what to do") */
export function objectiveText(state) {
  if (state.keyTaken) return 'escape — the exit lies in the core’s east wall';
  if (state.glyph.solved) return 'the lock stands open — face what drinks in the core';
  const clue = state.glyph.muralSeen || state.player.oddities.includes('O2') || state.glyph.intuited;
  if (clue) return 'return to the gallery — set the three glyphs right';
  if (state.visitedZones.has('Z3')) return 'the pillars want a sequence — the warrens remember it';
  return 'find the whisper gallery at the heart of these halls';
}

function cellColor(state, x, y) {
  const ch = cellCh(x, y);
  const k = keyOf(x, y);
  if (ch === CELL.WALL || ch === ' ' || ch === CELL.PILLAR) return PALETTE.steelLight;
  if (ch === CELL.SECRET) return (state.secretsFound.has(k) || state.phasedCells.has(k)) ? PALETTE.deepSteel : PALETTE.steelLight;
  if (ch === CELL.DOOR) return PALETTE.gold;
  if (ch === CELL.LOCK) return state.glyph.solved ? PALETTE.gold : PALETTE.rust;
  if (ch === CELL.CHASM) return PALETTE.cyanDeep;
  if (ch === CELL.EXIT) return PALETTE.goldGlow;
  return PALETTE.deepSteel;
}

/** Draw the map cells + player arrow into a square region (shared by both sizes). */
function drawCells(ctx, state, x0, y0, cs, revealAll = false) {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (!revealAll && !state.seen.has(keyOf(x, y))) continue;
      ctx.fillStyle = cellColor(state, x, y);
      ctx.fillRect(x0 + x * cs, y0 + y * cs, cs, cs);
    }
  }
  // pickups you can currently see glint on the map
  for (const e of state.entities) {
    if (e.kind !== 'pickup' || e.hidden || e.taken) continue;
    if (!state.seen.has(keyOf(Math.floor(e.x), Math.floor(e.y)))) continue;
    ctx.fillStyle = PALETTE.goldGlow;
    ctx.fillRect(x0 + e.x * cs - 0.5, y0 + e.y * cs - 0.5, 1.5, 1.5);
  }
  // the player: a cyan arrow
  const p = state.player;
  const px = x0 + p.x * cs, py = y0 + p.y * cs;
  ctx.save();
  ctx.translate(px, py); ctx.rotate(p.angle);
  ctx.fillStyle = PALETTE.cyan;
  ctx.beginPath(); ctx.moveTo(cs * 1.4, 0); ctx.lineTo(-cs * 0.8, -cs * 0.9); ctx.lineTo(-cs * 0.8, cs * 0.9); ctx.closePath(); ctx.fill();
  ctx.restore();
}

/** Corner minimap (always on in explore). Top-right; on touch it sits a bit
 * smaller under the icon tabs (top-left belongs to the pool bars). */
export function drawMinimap(ctx, state, touch) {
  const size = touch ? 54 : 62, x0 = BUF_W - size - 6, y0 = touch ? 48 : 14;
  ctx.globalAlpha = 0.75; ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x0 - 2, y0 - 2, size + 4, size + 4);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1;
  ctx.strokeRect(x0 - 1.5, y0 - 1.5, size + 3, size + 3);
  drawCells(ctx, state, x0, y0, size / MAP_W);
  if (!touch) text(ctx, 'M', x0 + size - 5, y0 + size - 2, { color: PALETTE.boneShadow });
}

/** Full map overlay (mode==='MAP'): map + objective + controls. Returns true to close. */
export function drawMapOverlay(ctx, state, clicks, keys, touch) {
  const w = 344, h = 196, x = (BUF_W - w) / 2, y = (BUF_H - h) / 2;
  panel(ctx, x, y, w, h, 'the whisperlock — what the walls remember');

  // the map (seen cells only — the dungeon you've earned)
  const ms = 140, mx = x + 10, my = y + 24;
  ctx.fillStyle = PALETTE.void; ctx.fillRect(mx - 2, my - 2, ms + 4, ms + 4);
  drawCells(ctx, state, mx, my, ms / MAP_W);

  // right column: objective + how to play
  const cx = mx + ms + 12;
  text(ctx, 'GOAL', cx, my + 6, { color: PALETTE.goldGlow });
  wrapLines(ctx, objectiveText(state), cx, my + 16, w - (cx - x) - 12, PALETTE.cyan);

  text(ctx, 'THE RULES OF THIS WORLD', cx, my + 48, { color: PALETTE.goldGlow });
  const lore = [
    'cyphers are one-use miracles.',
    'carry two at most — more, and',
    'the world turns against you.',
    'XP comes from finding things,',
    'never from killing. rest heals;',
    'training (4 XP) makes you more.',
  ];
  lore.forEach((l, i) => text(ctx, l, cx, my + 58 + i * 10, { color: PALETTE.boneLight }));

  text(ctx, 'HANDS', cx, my + 126, { color: PALETTE.goldGlow });
  const ctl = touch
    ? ['stick walks · drag looks', 'sword tap cut · hold heavy', 'hand takes what glows gold', 'top tabs: map · you · devices']
    : ['WASD walk · mouse looks', 'click cut · hold click heavy', 'E take · C devices · R rest', 'F stance · M map · Tab sheet'];
  ctl.forEach((l, i) => text(ctx, l, cx, my + 136 + i * 10, { color: PALETTE.boneShadow }));

  if (button(ctx, { x: mx, y: y + h - 22, w: 52, h: 16, label: 'Close', hotkey: 'Enter' }, clicks, keys)) return true;
  return keys.includes('KeyM') || keys.includes('Escape') || keys.includes('Tab');
}

function wrapLines(ctx, str, x, y, maxW, color) {
  ctx.font = '8px monospace';
  const words = str.split(' ');
  let line = '', cy = y;
  for (const wd of words) {
    const t2 = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(t2).width > maxW && line) { text(ctx, line, x, cy, { color }); line = wd; cy += 10; }
    else line = t2;
  }
  if (line) text(ctx, line, x, cy, { color });
  return cy;
}
