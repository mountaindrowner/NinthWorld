// Modal panels (Tech §5 MODAL state): pickup, secret, examine, intrusion, and
// the glyph puzzle share this renderer. Encounter action menus live in
// combat/dicetray. Each draw fn returns true when the modal is dismissed.

import { PALETTE } from '../engine/texgen.js';
import { panel, text, wrapText, button } from './widgets.js';

const BUF_W = 320, BUF_H = 200;

/**
 * Render the current modal (state.modal). Returns true when the player dismisses
 * it (Continue / click / Enter). Choice modals (intrusion, examine) set fields
 * on state.modal.result instead and also return true when resolved.
 */
export function drawModal(ctx, state, clicks, keys) {
  const m = state.modal;
  if (!m) return true;
  const w = 220, h = 110, x = (BUF_W - w) / 2, y = (BUF_H - h) / 2;
  panel(ctx, x, y, w, h, m.title || m.kind);

  let cy = y + 26;
  cy = wrapText(ctx, m.text || '', x + 10, cy, w - 20, 11, { size: 8, color: PALETTE.boneLight });
  if (m.sub) cy = wrapText(ctx, m.sub, x + 10, cy + 4, w - 20, 11, { size: 8, color: PALETTE.rust });

  // Choice buttons (e.g. intrusion accept/refuse); else a single Continue.
  if (m.choices && m.choices.length) {
    let bx = x + 10;
    for (let i = 0; i < m.choices.length; i++) {
      const c = m.choices[i];
      const bw = Math.min(96, (w - 20) / m.choices.length - 4);
      if (button(ctx, { x: bx, y: y + h - 22, w: bw, h: 16, label: c.label, hotkey: `Digit${i + 1}`, disabled: c.disabled, accent: c.accent }, clicks, keys)) {
        m.result = c.value;
        return true;
      }
      bx += bw + 4;
    }
    return false;
  }

  if (button(ctx, { x: x + w - 84, y: y + h - 22, w: 74, h: 16, label: 'Continue', hotkey: 'Enter' }, clicks, keys)) return true;
  // also dismiss on any interact key
  if (keys.includes('KeyE') || keys.includes('Space')) return true;
  return false;
}
