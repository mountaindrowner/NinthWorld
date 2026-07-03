// HUD (Tech §2): portrait face-bar, pool bars, damage track, cypher slots,
// shins, and a compass — an Arena-style bottom strip drawn into the buffer.

import { PALETTE } from '../engine/texgen.js';
import { text, bar } from './widgets.js';
import { facingLabel } from '../game/world.js';
import { overLimit } from '../game/state.js';

import { BUF_W, BUF_H } from '../engine/screen.js';
const TRACK_STATE = { hale: 0, impaired: 1, debilitated: 2, dead: 2 };
const POOL_COLORS = { might: PALETTE.blood, speed: PALETTE.cyan, intellect: PALETTE.gold };

export function drawHud(ctx, state, assets) {
  const p = state.player;
  const H = 40, y0 = BUF_H - H;
  ctx.fillStyle = PALETTE.deepSteel; ctx.fillRect(0, y0, BUF_W, H);
  ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(0, y0 + 0.5); ctx.lineTo(BUF_W, y0 + 0.5); ctx.stroke();

  // portrait (state by damage track)
  const port = assets.portrait_kave;
  if (port) ctx.drawImage(port.frames[TRACK_STATE[p.track] || 0], 4, y0 + 4, 32, 32);

  // pool bars
  let bx = 42, by = y0 + 5;
  for (const stat of ['might', 'speed', 'intellect']) {
    text(ctx, stat[0].toUpperCase(), bx - 8, by + 7, { size: 8, color: POOL_COLORS[stat] });
    bar(ctx, bx, by, 60, 7, p.pools[stat] / p.poolMax[stat], POOL_COLORS[stat]);
    text(ctx, `${p.pools[stat]}/${p.poolMax[stat]}`, bx + 64, by + 7, { size: 8, color: PALETTE.boneShadow });
    by += 11;
  }

  // damage track label
  text(ctx, p.track.toUpperCase(), 42, y0 + 39, { size: 8, color: p.track === 'hale' ? PALETTE.moss : PALETTE.blood });

  // cypher slots
  const slotX = 150;
  text(ctx, 'CYPHERS', slotX, y0 + 9, { size: 8, color: PALETTE.gold });
  for (let i = 0; i < Math.max(p.cypherLimit, p.cyphers.length); i++) {
    const x = slotX + i * 20, y = y0 + 13;
    const over = i >= p.cypherLimit;
    ctx.strokeStyle = over ? PALETTE.rust : PALETTE.steelLight; ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, 16, 16);
    const cy = p.cyphers[i];
    if (cy && assets.pickup_cypher) ctx.drawImage(assets.pickup_cypher.frames[0], x, y, 16, 16);
  }
  if (overLimit(state)) text(ctx, 'OVER LIMIT', slotX, y0 + 39, { size: 8, color: PALETTE.rust });

  // shins + compass (right)
  text(ctx, `${p.shins} shins`, BUF_W - 6, y0 + 12, { size: 8, color: PALETTE.gold, align: 'right' });
  text(ctx, `XP ${p.xp}`, BUF_W - 6, y0 + 24, { size: 8, color: PALETTE.goldGlow, align: 'right' });
  text(ctx, `▲ ${facingLabel(p.angle)}`, BUF_W - 6, y0 + 36, { size: 8, color: PALETTE.cyan, align: 'right' });

  // event ticker (last line) above the bar
  if (state.log.length) text(ctx, state.log[state.log.length - 1], 6, y0 - 5, { size: 8, color: PALETTE.boneShadow });
}
