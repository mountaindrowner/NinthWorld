// On-screen touch controls (Tech §7 stretch): a left virtual stick, right-side
// look area, and E/Cyphers/Sheet buttons — drawn into the buffer only when a
// touch has been seen and we're in EXPLORE. Menus/combat are already tap-driven.

import { PALETTE } from '../engine/texgen.js';
import { TOUCH_UI } from '../engine/input.js';
import { BUF_W, BUF_H } from '../engine/screen.js';

export function drawTouchControls(ctx, input) {
  ctx.save();
  ctx.globalAlpha = 0.5;

  // virtual stick base + knob
  const j = TOUCH_UI.joy;
  ctx.strokeStyle = PALETTE.steelLight; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = PALETTE.cyan;
  ctx.beginPath(); ctx.arc(j.cx + (input.knob?.x || 0), j.cy + (input.knob?.y || 0), 8, 0, Math.PI * 2); ctx.fill();

  // action buttons
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  for (const b of TOUCH_UI.buttons) {
    ctx.fillStyle = PALETTE.deepSteel; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = PALETTE.cyan; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    ctx.fillStyle = PALETTE.boneLight; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 3);
  }

  ctx.globalAlpha = 0.3;
  ctx.fillStyle = PALETTE.boneShadow; ctx.textAlign = 'right';
  ctx.fillText('drag to look', BUF_W - 66, BUF_H - 46);
  ctx.restore();
}
