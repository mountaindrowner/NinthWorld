// Software raycaster (Tech §3): Lodev-style DDA wall cast into the 320×200
// buffer. Perpendicular-distance fishbowl correction, per-side shading
// (N/S full, E/W ×0.75), distance fog toward the palette void, textured
// vertical slices from the 64×64 fallback/PNG atlas, and two gradient fills
// for floor/ceiling. Doors render as closed panels (open logic is M2).

import { isRenderSolid, wallTextureKey } from '../game/world.js';
import { PALETTE } from './texgen.js';

const BUF_W = 320, BUF_H = 200, HORIZON = BUF_H / 2;
const TEX = 64;
const FOV = 0.66;          // camera-plane half-length (~66° horizontal)
const FOG_FAR = 13;        // cells at which a wall fully fades to void
const SIDE_SHADE = 0.28;   // E/W wall darkening (≈ ×0.75 brightness)

let ceilGrad = null, floorGrad = null;
function ensureGradients(ctx) {
  if (ceilGrad) return;
  ceilGrad = ctx.createLinearGradient(0, 0, 0, HORIZON);
  ceilGrad.addColorStop(0, PALETTE.void);
  ceilGrad.addColorStop(1, PALETTE.deepSteel);
  floorGrad = ctx.createLinearGradient(0, HORIZON, 0, BUF_H);
  floorGrad.addColorStop(0, PALETTE.steel);
  floorGrad.addColorStop(1, PALETTE.void);
}

/**
 * Render the first-person view for the current player pose.
 * @param {CanvasRenderingContext2D} ctx  the 320×200 buffer context
 * @param {{x:number,y:number,angle:number}} p  player pose (grid units)
 * @param {Record<string,{frames:HTMLCanvasElement[]}>} assets  resolved atlas
 */
export function render(ctx, p, assets) {
  ensureGradients(ctx);
  ctx.fillStyle = ceilGrad; ctx.fillRect(0, 0, BUF_W, HORIZON);
  ctx.fillStyle = floorGrad; ctx.fillRect(0, HORIZON, BUF_W, HORIZON);

  const dirX = Math.cos(p.angle), dirY = Math.sin(p.angle);
  const planeX = -dirY * FOV, planeY = dirX * FOV;

  for (let x = 0; x < BUF_W; x++) {
    const cameraX = (2 * x) / BUF_W - 1;
    const rayX = dirX + planeX * cameraX;
    const rayY = dirY + planeY * cameraX;

    let mapX = Math.floor(p.x), mapY = Math.floor(p.y);
    const deltaX = Math.abs(1 / rayX), deltaY = Math.abs(1 / rayY);

    let stepX, stepY, sideDistX, sideDistY;
    if (rayX < 0) { stepX = -1; sideDistX = (p.x - mapX) * deltaX; }
    else { stepX = 1; sideDistX = (mapX + 1 - p.x) * deltaX; }
    if (rayY < 0) { stepY = -1; sideDistY = (p.y - mapY) * deltaY; }
    else { stepY = 1; sideDistY = (mapY + 1 - p.y) * deltaY; }

    // DDA
    let side = 0, guard = 0;
    while (guard++ < 64) {
      if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
      else { sideDistY += deltaY; mapY += stepY; side = 1; }
      if (isRenderSolid(mapX, mapY)) break;
    }

    const perp = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
    const dist = Math.max(perp, 0.0001);
    const lineH = Math.round(BUF_H / dist);
    const drawStart = Math.round(HORIZON - lineH / 2);

    // texture column
    let wallX = side === 0 ? p.y + dist * rayY : p.x + dist * rayX;
    wallX -= Math.floor(wallX);
    let texX = Math.floor(wallX * TEX);
    if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = TEX - texX - 1;

    const tex = assets[wallTextureKey(mapX, mapY)];
    const slice = tex && tex.frames[0];
    if (slice) {
      ctx.drawImage(slice, texX, 0, 1, TEX, x, drawStart, 1, lineH);
    } else {
      ctx.fillStyle = PALETTE.steel;
      ctx.fillRect(x, Math.max(0, drawStart), 1, Math.min(BUF_H, lineH));
    }

    // side shading + distance fog, one void overlay per column
    const fog = Math.min(1, dist / FOG_FAR);
    const darken = Math.min(0.94, fog * 0.9 + (side === 1 ? SIDE_SHADE : 0));
    if (darken > 0.01) {
      ctx.globalAlpha = darken;
      ctx.fillStyle = PALETTE.void;
      const y0 = Math.max(0, drawStart);
      const y1 = Math.min(BUF_H, drawStart + lineH);
      ctx.fillRect(x, y0, 1, Math.max(0, y1 - y0));
      ctx.globalAlpha = 1;
    }
  }
}
