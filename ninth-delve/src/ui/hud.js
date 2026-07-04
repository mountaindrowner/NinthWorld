// HUD (Tech §2), rebuilt minimal after Mark's mobile-FPS reference: corners
// only, no bottom plate. Three slim color-coded pool bars top-left — a pool's
// number appears only while it's hurt — tiny cypher-socket diamonds beneath,
// a small XP counter, and the damage-track word only when it matters. Shins,
// compass, portrait, and full numbers live in the Sheet (Tab / the You tab).

import { PALETTE } from '../engine/texgen.js';
import { text, bar } from './widgets.js';
import { overLimit } from '../game/state.js';

import { BUF_W, BUF_H } from '../engine/screen.js';
const POOL_COLORS = { might: PALETTE.blood, speed: PALETTE.cyan, intellect: PALETTE.gold };

function diamond(ctx, cx, cy, r, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r); ctx.lineTo(cx + r, cy); ctx.lineTo(cx, cy + r); ctx.lineTo(cx - r, cy);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke();
}

export function drawHud(ctx, state, assets, touch) {
  const p = state.player;
  const x0 = 6, w = 64, h = 5;

  // slim pool bars, numbers only while a pool is down
  let y = 8;
  for (const stat of ['might', 'speed', 'intellect']) {
    bar(ctx, x0, y, w, h, p.pools[stat] / p.poolMax[stat], POOL_COLORS[stat]);
    if (p.pools[stat] < p.poolMax[stat]) {
      text(ctx, `${p.pools[stat]}/${p.poolMax[stat]}`, x0 + w + 5, y + 5, { size: 8, color: PALETTE.boneShadow });
    }
    y += h + 3;
  }

  // cypher sockets: small diamonds, gold when carried, rust past the limit
  const slots = Math.max(p.cypherLimit, p.cyphers.length);
  for (let i = 0; i < slots; i++) {
    const cy = p.cyphers[i];
    diamond(ctx, x0 + 4 + i * 11, y + 5, 4,
      cy ? PALETTE.goldGlow : null,
      cy ? PALETTE.gold : (i >= p.cypherLimit ? PALETTE.rust : PALETTE.steelLight));
  }
  text(ctx, `XP ${p.xp}`, x0 + 4 + slots * 11 + 6, y + 8, { size: 8, color: PALETTE.goldGlow });
  y += 14;

  // states that demand attention, and only then
  if (p.track !== 'hale') {
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(state.t / 260);
    text(ctx, p.track, x0, y + 6, { size: 8, color: PALETTE.blood });
    ctx.globalAlpha = 1;
    y += 10;
  }
  if (overLimit(state)) text(ctx, 'too many cyphers', x0, y + 6, { size: 8, color: PALETTE.rust });

  // event ticker: one dim line at the very bottom (centered on touch, where
  // the corners belong to the thumbs)
  if (state.log.length) {
    const tick = state.log[state.log.length - 1];
    if (touch) text(ctx, tick, BUF_W / 2, BUF_H - 5, { size: 8, color: PALETTE.boneShadow, align: 'center' });
    else text(ctx, tick, 6, BUF_H - 5, { size: 8, color: PALETTE.boneShadow });
  }
}
