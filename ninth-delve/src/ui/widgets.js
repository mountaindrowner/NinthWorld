// Shared immediate-mode UI primitives for the pixel HUD/tray/menus/report.
// Everything draws into the pixel buffer; buttons test against per-frame
// click/key lists (mutated on hit) so the same lists thread through all panels.

import { PALETTE } from '../engine/texgen.js';

export function panel(ctx, x, y, w, h, title) {
  ctx.fillStyle = PALETTE.deepSteel;
  ctx.globalAlpha = 0.94; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  if (title) {
    ctx.fillStyle = PALETTE.gold; ctx.font = '8px monospace'; ctx.textAlign = 'left';
    ctx.fillText(title.toUpperCase(), x + 5, y + 9);
  }
}

/** fillText with a 1px void outline so text stays legible on any backdrop. */
function outlined(ctx, str, x, y, color) {
  ctx.fillStyle = PALETTE.void;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(str, x + dx, y + dy);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

export function text(ctx, str, x, y, { color = PALETTE.boneLight, size = 8, align = 'left' } = {}) {
  ctx.font = `${size}px monospace`; ctx.textAlign = align;
  outlined(ctx, str, x, y, color);
}

/** Word-wrap into the buffer; returns the y after the last line. */
export function wrapText(ctx, str, x, y, maxW, lineH, opts = {}) {
  ctx.font = `${opts.size || 8}px monospace`; ctx.textAlign = 'left';
  const color = opts.color || PALETTE.boneLight;
  const words = str.split(' ');
  let line = '', cy = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) { outlined(ctx, line, x, cy, color); line = w; cy += lineH; }
    else line = test;
  }
  if (line) { outlined(ctx, line, x, cy, color); cy += lineH; }
  return cy;
}

const inside = (c, b) => c.x >= b.x && c.x <= b.x + b.w && c.y >= b.y && c.y <= b.y + b.h;

/**
 * Draw a button; return true if clicked (mouse in bounds) or its hotkey pressed.
 * Consumes the matching click/key from the per-frame lists.
 * @param {{x,y,w,h,label:string,hotkey?:string,disabled?:boolean,accent?:string}} b
 */
export function button(ctx, b, clicks, keys) {
  const dim = b.disabled;
  ctx.fillStyle = dim ? PALETTE.steel : PALETTE.deepSteel;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = dim ? PALETTE.boneShadow : (b.accent || PALETTE.cyan); ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.font = '8px monospace'; ctx.textAlign = 'left';
  const hk = b.hotkey ? `${b.hotkey.replace('Digit', '')} ` : '';
  outlined(ctx, hk + b.label, b.x + 4, b.y + Math.round(b.h / 2) + 3, dim ? PALETTE.boneShadow : PALETTE.boneLight);
  if (dim) return false;

  const ci = clicks.findIndex((c) => inside(c, b));
  if (ci >= 0) { clicks.splice(ci, 1); return true; }
  if (b.hotkey) {
    const ki = keys.indexOf(b.hotkey);
    if (ki >= 0) { keys.splice(ki, 1); return true; }
  }
  return false;
}

/** A horizontal value bar (pool/health). */
export function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = PALETTE.void; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, Math.max(0, Math.round((w - 2) * frac)), h - 2);
  ctx.strokeStyle = PALETTE.boneShadow; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
