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
    const { frame, flip } = pickFrame(e, asset, state.t, p);
    const fw = asset.w, fh = asset.h;

    const cellH = BUF_H / tY;
    const floorLine = HORIZON + cellH / 2;
    const worldH = e.kind === 'pickup' ? 0.5 : (e.worldH ?? fh / 64); // per-creature scale (laak is ankle-high)
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
      let texX = Math.floor((col / spriteW) * fw);
      if (flip) texX = fw - 1 - texX; // mirrored side view
      ctx.drawImage(frame, texX, 0, 1, fh, drawX, topY, 1, spriteH);
      if (fog > 0.02) {
        ctx.globalAlpha = fog; ctx.fillStyle = PALETTE.void;
        ctx.fillRect(drawX, topY, 1, spriteH); ctx.globalAlpha = 1;
      }
    }

    // health bar over hurt, visible creatures (realtime combat readability)
    if (e.kind === 'creature' && e.hp < e.maxHp && e.alive) {
      const cx = Math.round(screenX);
      if (cx >= 0 && cx < BUF_W && tY < zBuffer[cx]) {
        const bw = Math.max(10, Math.min(28, spriteW * 0.6));
        const bx = Math.round(screenX - bw / 2), byy = Math.round(topY - 5);
        ctx.fillStyle = PALETTE.void; ctx.fillRect(bx - 1, byy - 1, bw + 2, 4);
        ctx.fillStyle = PALETTE.blood;
        ctx.fillRect(bx, byy, Math.max(1, Math.round(bw * (e.hp / e.maxHp))), 2);
      }
    }
  }

  renderPopups(ctx, state, dirX, dirY, planeX, planeY);
}

/** World-anchored damage popups: project like sprites, rise and fade over 900ms. */
function renderPopups(ctx, state, dirX, dirY, planeX, planeY) {
  if (!state.popups?.length) return;
  const p = state.player;
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  state.popups = state.popups.filter((pop) => state.t - pop.t0 < 900);
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  for (const pop of state.popups) {
    const sx = pop.x - p.x, sy = pop.y - p.y;
    const tX = invDet * (dirY * sx - dirX * sy);
    const tY = invDet * (-planeY * sx + planeX * sy);
    if (tY <= 0.15) continue;
    const cx = Math.round((BUF_W / 2) * (1 + tX / tY));
    if (cx < 0 || cx >= BUF_W || tY >= zBuffer[cx]) continue;
    const age = (state.t - pop.t0) / 900;
    const yy = Math.round(HORIZON - (BUF_H / tY) * 0.35 - age * 14);
    ctx.globalAlpha = 1 - age * 0.7;
    ctx.fillStyle = PALETTE.void;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillText(pop.txt, cx + ox, yy + oy);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.txt, cx, yy);
    ctx.globalAlpha = 1;
  }
}

/**
 * Choose a frame + mirror flag: corpse, explicit combat pose, else a
 * DIRECTIONAL idle — front (facing you), back (facing away), or side
 * (mirrored for the other flank) picked from the creature's heading.
 */
function pickFrame(e, asset, t, p) {
  const n = asset.frames.length;
  const F = e.F || {};
  const clamp = (idx, flip = false) => ({ frame: asset.frames[Math.max(0, Math.min(n - 1, idx))], flip });

  if (e.kind === 'creature' && !e.alive) return clamp(e.frame ?? (F.deathB ?? F.dead ?? n - 1));
  if (e.frame != null) return clamp(e.frame);            // combat pose (lunge/hit/throw/…)
  if (e.kind !== 'creature') return clamp(Math.floor(t / 300) % n);

  const bob = Math.floor(t / 400) % 2;
  const toView = Math.atan2(p.y - e.y, p.x - e.x);        // creature → viewer
  let rel = (e.heading ?? toView) - toView;
  while (rel > Math.PI) rel -= 2 * Math.PI;
  while (rel < -Math.PI) rel += 2 * Math.PI;
  const a = Math.abs(rel);
  if (a < Math.PI / 4 && F.front) return clamp(F.front[bob]);   // walking at you
  if (a > (3 * Math.PI) / 4 && F.back) return clamp(F.back[bob]); // walking away
  return clamp(bob ? (F.idleB ?? 1) : (F.idleA ?? 0), rel > 0);   // side, mirrored per flank
}
