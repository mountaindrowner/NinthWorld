// Software raycaster (Tech §3): Lodev-style DDA wall cast into the 320×200
// buffer. Perpendicular-distance fishbowl correction, per-side shading
// (N/S full, E/W ×0.75), distance fog toward the palette void, textured
// vertical slices from the 64×64 fallback/PNG atlas, and two gradient fills
// for floor/ceiling. Doors render as closed panels (open logic is M2).

import { renderSolidAt, wallTextureKey, doorSlide } from '../game/world.js';
import { visiblePickups, liveCreatures } from '../game/entities.js';
import { PALETTE } from './texgen.js';
import { BUF_W, BUF_H } from './screen.js';

const HORIZON = BUF_H / 2;
const TEX = 64;
// camera-plane half-length: 0.66 (~66°) at 1.6 aspect, scaled so a wider buffer
// widens the horizontal FOV instead of stretching the world.
const FOV = 0.66 * ((BUF_W / BUF_H) / 1.6);
const FOG_FAR = 13;        // cells at which a wall fully fades to void
const SIDE_SHADE = 0.28;   // E/W wall darkening (≈ ×0.75 brightness)

const zBuffer = new Float32Array(BUF_W); // per-column wall depth, for sprite clip

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
 * Render the first-person view: walls (with z-buffer), then billboard sprites
 * clipped against it.
 * @param {CanvasRenderingContext2D} ctx  the pixel buffer context
 * @param {Object} state  GameState (uses state.player, state.entities, state.t)
 * @param {Record<string,{frames:HTMLCanvasElement[],w:number,h:number}>} assets
 */
export function render(ctx, state, assets) {
  const p = state.player;
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

    let side = 0, guard = 0;
    while (guard++ < 64) {
      if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
      else { sideDistY += deltaY; mapY += stepY; side = 1; }
      if (renderSolidAt(state, mapX, mapY)) break;
    }

    const perp = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
    const dist = Math.max(perp, 0.0001);
    zBuffer[x] = dist;
    const lineH = Math.round(BUF_H / dist);
    const drawStart = Math.round(HORIZON - lineH / 2);

    let wallX = side === 0 ? p.y + dist * rayY : p.x + dist * rayX;
    wallX -= Math.floor(wallX);
    let texX = Math.floor(wallX * TEX);
    if ((side === 0 && rayX > 0) || (side === 1 && rayY < 0)) texX = TEX - texX - 1;
    // sliding doors offset the texel u-coordinate as they open (Tech §3)
    const slide = doorSlide(state, mapX, mapY);
    if (slide > 0) texX = (texX + Math.floor(slide * TEX)) % TEX;

    const tex = assets[wallTextureKey(mapX, mapY)];
    const slice = tex && tex.frames[0];
    if (slice) ctx.drawImage(slice, texX, 0, 1, TEX, x, drawStart, 1, lineH);
    else { ctx.fillStyle = PALETTE.steel; ctx.fillRect(x, Math.max(0, drawStart), 1, Math.min(BUF_H, lineH)); }

    const fog = Math.min(1, dist / FOG_FAR);
    const darken = Math.min(0.94, fog * 0.9 + (side === 1 ? SIDE_SHADE : 0));
    if (darken > 0.01) {
      ctx.globalAlpha = darken;
      ctx.fillStyle = PALETTE.void;
      const y0 = Math.max(0, drawStart), y1 = Math.min(BUF_H, drawStart + lineH);
      ctx.fillRect(x, y0, 1, Math.max(0, y1 - y0));
      ctx.globalAlpha = 1;
    }
  }

  renderSprites(ctx, state, assets, dirX, dirY, planeX, planeY);
}

/** Billboard sprite pass: back-to-front, per-column z-buffer clip (Tech §3). */
function renderSprites(ctx, state, assets, dirX, dirY, planeX, planeY) {
  const p = state.player;
  const sprites = [...visiblePickups(state), ...liveCreatures(state)]
    .map((e) => ({ e, d: (e.x - p.x) ** 2 + (e.y - p.y) ** 2 }))
    .sort((a, b) => b.d - a.d);

  const invDet = 1 / (planeX * dirY - dirX * planeY);
  for (const { e } of sprites) {
    const sx = e.x - p.x, sy = e.y - p.y;
    const tX = invDet * (dirY * sx - dirX * sy);
    const tY = invDet * (-planeY * sx + planeX * sy); // depth
    if (tY <= 0.1) continue;

    const asset = assets[e.sprite];
    if (!asset) continue;
    const frame = pickFrame(e, asset, state.t);
    const fw = asset.w, fh = asset.h;

    const cellH = BUF_H / tY;
    const floorLine = HORIZON + cellH / 2;
    const worldH = e.kind === 'pickup' ? 0.5 : fh / 64; // pickups small; abykos (96) = 1.5
    const spriteH = cellH * worldH;
    const spriteW = spriteH * (fw / fh);
    const bob = e.kind === 'pickup' ? Math.sin(state.t / 300 + e.uid) * spriteH * 0.08 : 0;
    const topY = floorLine - spriteH + bob;
    const screenX = (BUF_W / 2) * (1 + tX / tY);
    const startX = Math.floor(screenX - spriteW / 2);
    const fog = Math.min(0.85, tY / FOG_FAR);

    for (let col = 0; col < spriteW; col++) {
      const drawX = startX + col;
      if (drawX < 0 || drawX >= BUF_W) continue;
      if (tY >= zBuffer[drawX]) continue; // occluded by a nearer wall
      const texX = Math.floor((col / spriteW) * fw);
      ctx.drawImage(frame, texX, 0, 1, fh, drawX, topY, 1, spriteH);
      if (fog > 0.02) {
        ctx.globalAlpha = fog; ctx.fillStyle = PALETTE.void;
        ctx.fillRect(drawX, topY, 1, spriteH); ctx.globalAlpha = 1;
      }
    }
  }
}

/** Choose a frame canvas: explicit combat frame, else idle 2-frame / pickup cycle. */
function pickFrame(e, asset, t) {
  const n = asset.frames.length;
  let idx;
  if (e.frame != null) idx = e.frame;
  else if (e.kind === 'creature') idx = Math.floor(t / 400) % Math.min(2, n); // idle×2
  else idx = Math.floor(t / 300) % n;
  return asset.frames[Math.max(0, Math.min(n - 1, idx))];
}
