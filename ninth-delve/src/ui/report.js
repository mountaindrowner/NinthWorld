// Delve Report end screen (GDD §6). M4 ships a functional stub; M7 adds the full
// breakdown (cyphers used vs hoarded, Tier-2 progress tease) and title art.

import { PALETTE } from '../engine/texgen.js';
import { panel, text, button } from './widgets.js';

const BUF_W = 320, BUF_H = 200;

export function drawReport(ctx, state, clicks, keys) {
  const p = state.player, s = state.stats;
  const w = 260, h = 150, x = (BUF_W - w) / 2, y = 20;
  panel(ctx, x, y, w, h, 'Delve Report');

  const win = state.reportReason !== 'defeat';
  text(ctx, win ? (state.keyTaken ? 'The Whisperlock opens.' : 'You leave the dark.') : 'The dark keeps you.',
    x + 10, y + 24, { size: 8, color: win ? PALETTE.cyan : PALETTE.blood });

  const lines = [
    `XP earned:        ${p.xp}`,
    `XP spent (reroll): ${p.xpSpent}`,
    `Secrets found:    ${s.secrets}`,
    `Cyphers used:     ${s.cyphersUsed}`,
    `Cyphers hoarded:  ${p.cyphers.length}`,
    `Shins:            ${p.shins}`,
    `Foes felled:      ${s.kills}`,
    `Tier 2 progress:  ${Math.min(4, Math.floor(p.xp / 4))}/4 benefits`,
  ];
  let ly = y + 40;
  for (const l of lines) { text(ctx, l, x + 12, ly, { size: 8, color: PALETTE.boneLight }); ly += 12; }

  if (button(ctx, { x: x + w / 2 - 45, y: y + h - 22, w: 90, h: 16, label: 'Delve again', hotkey: 'Enter', accent: PALETTE.goldGlow }, clicks, keys)) {
    location.reload();
  }
}
