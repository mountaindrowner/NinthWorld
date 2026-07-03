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
  // gradient plate with a gold pinstripe + cyan hairline (Arena face-bar energy)
  const g = ctx.createLinearGradient(0, y0, 0, BUF_H);
  g.addColorStop(0, PALETTE.steel); g.addColorStop(0.25, PALETTE.deepSteel); g.addColorStop(1, PALETTE.void);
  ctx.fillStyle = g; ctx.fillRect(0, y0, BUF_W, H);
  ctx.strokeStyle = PALETTE.gold; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(0, y0 + 0.5); ctx.lineTo(BUF_W, y0 + 0.5); ctx.stroke();
  ctx.strokeStyle = PALETTE.cyanDeep; ctx.beginPath();
  ctx.moveTo(0, y0 + 2.5); ctx.lineTo(BUF_W, y0 + 2.5); ctx.stroke();

  // portrait in a double frame with corner notches
  const port = assets.portrait_kave;
  ctx.fillStyle = PALETTE.void; ctx.fillRect(2, y0 + 2, 36, 36);
  if (port) ctx.drawImage(port.frames[TRACK_STATE[p.track] || 0], 4, y0 + 4, 32, 32);
  ctx.strokeStyle = PALETTE.gold; ctx.strokeRect(3.5, y0 + 3.5, 33, 33);
  ctx.fillStyle = PALETTE.goldGlow;
  for (const [nx, ny] of [[2, y0 + 2], [35, y0 + 2], [2, y0 + 35], [35, y0 + 35]]) ctx.fillRect(nx, ny, 3, 3);

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

  // cypher slots: recessed sockets; filled slots glow gold
  const slotX = 150;
  text(ctx, 'CYPHERS', slotX, y0 + 9, { size: 8, color: PALETTE.gold });
  for (let i = 0; i < Math.max(p.cypherLimit, p.cyphers.length); i++) {
    const x = slotX + i * 20, y = y0 + 13;
    const over = i >= p.cypherLimit;
    const cy = p.cyphers[i];
    ctx.fillStyle = PALETTE.void; ctx.fillRect(x, y, 17, 17);
    if (cy && assets.pickup_cypher) ctx.drawImage(assets.pickup_cypher.frames[0], x + 1, y + 1, 15, 15);
    ctx.strokeStyle = cy ? PALETTE.goldGlow : over ? PALETTE.rust : PALETTE.steelLight;
    ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, 16, 16);
    if (cy) { ctx.fillStyle = PALETTE.goldGlow; ctx.fillRect(x + 1, y + 15, 15, 1); }
  }
  if (overLimit(state)) text(ctx, 'OVER LIMIT', slotX, y0 + 39, { size: 8, color: PALETTE.rust });

  // shins + compass (right)
  text(ctx, `${p.shins} shins`, BUF_W - 6, y0 + 12, { size: 8, color: PALETTE.gold, align: 'right' });
  text(ctx, `XP ${p.xp}`, BUF_W - 6, y0 + 24, { size: 8, color: PALETTE.goldGlow, align: 'right' });
  text(ctx, `▲ ${facingLabel(p.angle)}`, BUF_W - 6, y0 + 36, { size: 8, color: PALETTE.cyan, align: 'right' });

  // event ticker (last line) above the bar
  if (state.log.length) text(ctx, state.log[state.log.length - 1], 6, y0 - 5, { size: 8, color: PALETTE.boneShadow });
}
