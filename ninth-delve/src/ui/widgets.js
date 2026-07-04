// Shared immediate-mode UI primitives for the pixel HUD/tray/menus/report.
// Everything draws into the pixel buffer; buttons test against per-frame
// click/key lists (mutated on hit) so the same lists thread through all panels.

import { PALETTE } from '../engine/texgen.js';

export function panel(ctx, x, y, w, h, title) {
  // drop shadow → body gradient → void outer edge → gold pinstripe → notched corners
  ctx.globalAlpha = 0.55; ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x + 3, y + 3, w, h);
  ctx.globalAlpha = 0.96;
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, PALETTE.steel); g.addColorStop(0.18, PALETTE.deepSteel); g.addColorStop(1, PALETTE.void);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.void; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = PALETTE.gold;
  ctx.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
  ctx.fillStyle = PALETTE.goldGlow;
  for (const [cx, cy] of [[x + 1, y + 1], [x + w - 4, y + 1], [x + 1, y + h - 4], [x + w - 4, y + h - 4]]) ctx.fillRect(cx, cy, 3, 3);
  if (title) {
    ctx.globalAlpha = 0.4; ctx.fillStyle = PALETTE.void;
    ctx.fillRect(x + 4, y + 4, w - 8, 11); ctx.globalAlpha = 1;
    text(ctx, title.toUpperCase(), x + 8, y + 12, { color: PALETTE.goldGlow });
    ctx.strokeStyle = PALETTE.cyanDeep;
    ctx.beginPath(); ctx.moveTo(x + 6, y + 15.5); ctx.lineTo(x + w - 6, y + 15.5); ctx.stroke();
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
  const accent = dim ? PALETTE.boneShadow : (b.accent || PALETTE.cyan);
  // raised body: gradient fill, top highlight, void seat
  ctx.fillStyle = PALETTE.void; ctx.fillRect(b.x + 1, b.y + 1, b.w, b.h); // seat shadow
  const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
  g.addColorStop(0, dim ? PALETTE.deepSteel : PALETTE.steel);
  g.addColorStop(1, PALETTE.deepSteel);
  ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = accent; ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  if (!dim) { // top light + accent tick
    ctx.globalAlpha = 0.35; ctx.fillStyle = PALETTE.staticWhite;
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1); ctx.globalAlpha = 1;
    ctx.fillStyle = accent; ctx.fillRect(b.x + 1, b.y + b.h - 3, 2, 2);
  }
  ctx.font = '8px monospace'; ctx.textAlign = 'left';
  const hk = b.hotkey ? `${b.hotkey === 'Enter' ? '\u21B5' : b.hotkey.replace('Digit', '').replace('Key', '')} ` : '';
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

/** A horizontal value bar (pool/health): filled gradient, sheen, quarter ticks. */
export function bar(ctx, x, y, w, h, frac, color) {
  ctx.fillStyle = PALETTE.void; ctx.fillRect(x, y, w, h);
  const fw = Math.max(0, Math.round((w - 2) * Math.min(1, frac)));
  if (fw > 0) {
    ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, fw, h - 2);
    ctx.globalAlpha = 0.35; ctx.fillStyle = PALETTE.void;          // depth on lower half
    ctx.fillRect(x + 1, y + Math.ceil(h / 2), fw, Math.floor(h / 2) - 1);
    ctx.globalAlpha = 0.45; ctx.fillStyle = PALETTE.staticWhite;   // sheen on top
    ctx.fillRect(x + 1, y + 1, fw, 1);
    ctx.globalAlpha = 1;
  }
  ctx.globalAlpha = 0.5; ctx.fillStyle = PALETTE.void;             // quarter ticks
  for (let q = 1; q < 4; q++) ctx.fillRect(x + Math.round((w * q) / 4), y + 1, 1, h - 2);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = PALETTE.boneShadow; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}
