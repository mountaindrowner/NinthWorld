// On-screen touch controls (Tech §7 stretch), drawn only when a touch has been
// seen and we're in EXPLORE. Modeled on good mobile FPS layouts (Mark's
// reference shot): round ICON buttons clustered at the right thumb, quiet icon
// tabs top-right, a decorated stick whose base floats to wherever the thumb
// lands, and buttons that answer the finger — pressed glow, a charge ring on
// ATK, an E that lights gold when something is in reach, a cypher count badge.

import { PALETTE } from '../engine/texgen.js';
import { TOUCH_UI } from '../engine/input.js';
import { tileDist, cellAt } from '../game/world.js';
import { CELL } from '../data/map_whisperlock.js';

/** Is there something E would act on right now? (pickup close by, or a
 * door/lock/glyph pillar just ahead) — drives the E button's glow. */
function interactNearby(state) {
  const p = state.player;
  for (const e of state.entities) {
    if (e.kind === 'pickup' && !e.hidden && !e.taken && tileDist(p.x, p.y, e.x, e.y) < 2.2) return true;
  }
  const c = cellAt(Math.floor(p.x + Math.cos(p.angle) * 1.2), Math.floor(p.y + Math.sin(p.angle) * 1.2));
  return c === CELL.DOOR || c === CELL.LOCK || c === CELL.PILLAR;
}

// --- tiny pixel icons (drawn at a center point, logical px) -------------------
function iconSword(ctx, cx, cy, color, guard) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = color;
  ctx.fillRect(-1.5, -10, 3, 14);                                // blade
  ctx.beginPath(); ctx.moveTo(-1.5, -10); ctx.lineTo(0, -13); ctx.lineTo(1.5, -10); ctx.fill(); // tip
  ctx.fillStyle = guard;
  ctx.fillRect(-4.5, 4, 9, 2);                                   // crossguard
  ctx.fillRect(-1, 6, 2, 5);                                     // grip
  ctx.restore();
}

function iconHand(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < 3; i++) ctx.fillRect(cx - 4 + i * 3, cy - 6, 2, 5); // fingers
  ctx.fillRect(cx - 4, cy - 1, 8, 5);                            // palm
  ctx.fillRect(cx + 4, cy, 2, 3);                                // thumb
}

function iconMap(ctx, cx, cy, color) {
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.strokeRect(cx - 6.5, cy - 4.5, 13, 9);
  ctx.beginPath(); ctx.moveTo(cx - 2.5, cy - 4.5); ctx.lineTo(cx - 2.5, cy + 4.5); ctx.stroke(); // fold
  ctx.moveTo(cx + 2.5, cy - 4.5); ctx.lineTo(cx + 2.5, cy + 4.5); ctx.stroke();                 // fold
  ctx.fillStyle = color; ctx.fillRect(cx - 5, cy + 1, 2, 2);     // the "you are here" dot
}

function iconPerson(ctx, cx, cy, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(cx, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();       // head
  ctx.beginPath(); ctx.arc(cx, cy + 5, 4.5, Math.PI, 0); ctx.fill();           // shoulders
}

function iconDevice(ctx, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.strokeRect(-4, -4, 8, 8);                                  // tilted device shell
  ctx.fillStyle = color; ctx.fillRect(-1.5, -1.5, 3, 3);         // core
  ctx.restore();
}

const TAB_ICON = { KeyM: iconMap, Tab: iconPerson, KeyC: iconDevice };

// --- widgets ------------------------------------------------------------------
function circleButton(ctx, b, { held, accent, ringT }, drawIcon) {
  ctx.globalAlpha = held ? 0.85 : 0.55;
  ctx.fillStyle = PALETTE.void;
  ctx.beginPath(); ctx.arc(b.cx + 1, b.cy + 1.5, b.r, 0, Math.PI * 2); ctx.fill(); // seat shadow
  ctx.fillStyle = held ? PALETTE.steel : PALETTE.deepSteel;
  ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = held ? 1 : 0.8;
  ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r, 0, Math.PI * 2); ctx.stroke();
  // charge ring (ATK held): sweeps to full at the heavy threshold, then burns gold
  if (ringT > 0) {
    ctx.strokeStyle = ringT >= 1 ? PALETTE.goldGlow : PALETTE.gold; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(b.cx, b.cy, b.r + 3, -Math.PI / 2, -Math.PI / 2 + Math.min(1, ringT) * Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  drawIcon(ctx, b, held, accent);
}

function tabButton(ctx, b, held, badge) {
  ctx.globalAlpha = held ? 0.9 : 0.45;
  ctx.fillStyle = held ? PALETTE.steel : PALETTE.deepSteel;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = PALETTE.steelLight; ctx.lineWidth = 1;
  ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  ctx.fillStyle = PALETTE.gold; ctx.fillRect(b.x + 0.5, b.y + b.h - 1.5, b.w - 1, 1); // gold footer
  ctx.globalAlpha = held ? 1 : 0.8;
  TAB_ICON[b.id]?.(ctx, b.x + b.w / 2, b.y + b.h / 2, held ? PALETTE.boneLight : PALETTE.boneShadow);
  if (badge > 0) { // carried-cypher count, like ammo pips
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.goldGlow;
    ctx.beginPath(); ctx.arc(b.x + b.w - 2, b.y + b.h - 1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.void; ctx.font = '7px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(badge), b.x + b.w - 2, b.y + b.h + 1.5);
  }
  ctx.globalAlpha = 1;
}

function stickRing(ctx, cx, cy, r) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) { // cardinal notches
    const a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (r - 3), cy + Math.sin(a) * (r - 3));
    ctx.lineTo(cx + Math.cos(a) * (r + 2), cy + Math.sin(a) * (r + 2));
    ctx.stroke();
  }
}

export function drawTouchControls(ctx, input, state) {
  ctx.save();

  // virtual stick: ghost ring at the rest spot; live base floats to the thumb
  const j = TOUCH_UI.joy;
  const base = input.joyBase;
  if (!base) {
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = PALETTE.steelLight; ctx.lineWidth = 1;
    stickRing(ctx, j.cx, j.cy, j.r);
    ctx.fillStyle = PALETTE.steelLight;
    ctx.beginPath(); ctx.arc(j.cx, j.cy, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.globalAlpha = 0.30;
    ctx.fillStyle = PALETTE.deepSteel;
    ctx.beginPath(); ctx.arc(base.x, base.y, j.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = PALETTE.cyanDeep; ctx.lineWidth = 1.5;
    stickRing(ctx, base.x, base.y, j.r);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PALETTE.cyan;
    ctx.beginPath(); ctx.arc(base.x + input.knob.x, base.y + input.knob.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = PALETTE.boneLight; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(base.x + input.knob.x, base.y + input.knob.y, 9, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const canInteract = interactNearby(state);
  for (const b of TOUCH_UI.buttons) {
    const held = input.heldIds.has(b.id);
    if (b.kind === 'circle') {
      if (b.id === 'swing') {
        const ringT = input.swingCharging > 0 ? (performance.now() - input.swingCharging) / 350 : 0;
        circleButton(ctx, b, { held, accent: PALETTE.rust, ringT },
          (c2, bb, h) => iconSword(c2, bb.cx, bb.cy, h ? PALETTE.staticWhite : PALETTE.boneLight, PALETTE.gold));
      } else {
        circleButton(ctx, b, { held, accent: canInteract ? PALETTE.goldGlow : PALETTE.cyanDeep, ringT: 0 },
          (c2, bb, h) => iconHand(c2, bb.cx, bb.cy, canInteract ? PALETTE.goldGlow : (h ? PALETTE.boneLight : PALETTE.boneShadow)));
      }
    } else {
      tabButton(ctx, b, held, b.id === 'KeyC' ? state.player.cyphers.length : 0);
    }
  }

  ctx.restore();
}
