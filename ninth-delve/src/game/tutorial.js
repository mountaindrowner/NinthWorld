// First-time teaching popups ("calibration records"). Each lesson fires ONCE,
// as a pausing modal, the first time the player meets the thing it explains —
// walking room to room IS the tutorial. The passive one-line cyan prompts
// (mains' tutPrompt) still handle moment-to-moment verbs; these popups carry
// the ideas: what doors do, what cyphers are, how growth works.

import { tileDist } from './world.js';
import { DOORS, CHASM, PLACEMENTS } from '../data/map_whisperlock.js';

const PILLARS = PLACEMENTS.filter((p) => p.kind === 'pillar');
const nearAny = (p, cells, r) => cells.some(([x, y]) => tileDist(p.x, p.y, x + 0.5, y + 0.5) < r);

/**
 * Ordered lessons. `when(state)` is checked only while exploring with no other
 * UI open; `text`/`sub` may vary by input (touch phones vs desktop).
 */
const LESSONS = [
  {
    id: 'welcome',
    when: (s) => s.t - s.startTime > 1500,
    title: 'calibration record 1 — the delve',
    text: () => 'You are inside the Whisperlock — a machine that thinks you are one of its parts. Somewhere deeper, a gallery of whispers holds the way down. Find it. The map remembers every hall you see.',
    sub: (touch) => (touch ? 'the map is the first tab, top right' : 'M opens the map · it also lists your goal'),
  },
  {
    id: 'fight',
    when: (s) => s.entities.some((e) => e.kind === 'creature' && e.alive && !e.hidden && e.engaged),
    title: 'calibration record 2 — the blade',
    text: () => 'Something hunts you. Quick cuts land fast; a held blow released late cuts far deeper, but it spends your Might — the red bar. Step back while a creature winds up, then answer.',
    sub: (touch) => (touch ? 'tap the sword to cut · hold it, then let go, for a heavy blow' : 'click to cut · hold, release for a heavy blow'),
  },
  {
    id: 'pickup',
    when: (s) => s.entities.some((e) => e.kind === 'pickup' && !e.hidden && !e.taken && tileDist(s.player.x, s.player.y, e.x, e.y) < 2.2),
    title: 'calibration record 3 — what the dead left',
    text: () => 'Take what you find. In this place you grow by NOTICING — XP comes from discovery, from secrets, from firsts. Killing earns nothing but quiet.',
    sub: (touch) => (touch ? 'the hand button burns gold when something is in reach' : 'E takes what is in reach'),
  },
  {
    id: 'door',
    when: (s) => nearAny(s.player, DOORS, 1.8),
    title: 'calibration record 4 — sealed slabs',
    text: () => 'The slab ahead is a door, and the lock still counts you among its parts: stand close and it slides aside. Only the great glyph lock above the gallery refuses — that one wants an answer.',
    sub: () => 'doors gate each region — what lives behind one stays behind it',
  },
  {
    id: 'cypher',
    when: (s) => s.player.cyphers.length > 0,
    title: 'calibration record 5 — a cypher',
    text: () => 'The device you carry is a cypher: a one-use miracle. Spend it when it would matter — hoarding more than two draws the world’s attention, and never kindly.',
    sub: (touch) => (touch ? 'the diamond tab opens your devices' : 'C opens your devices'),
  },
  {
    id: 'glyphs',
    when: (s) => nearAny(s.player, PILLARS.map((p) => [p.x, p.y]), 3.2),
    title: 'calibration record 6 — the whisper gallery',
    text: () => 'Three pillars, three glyphs, one true order. The warrens to the west remember it — a mural, a dead courier’s oddity, or your own intuition can surface the sequence. Guess wrong and the gallery answers.',
  },
  {
    id: 'chasm',
    when: (s) => nearAny(s.player, CHASM, 2.6),
    title: 'calibration record 7 — the coolant chasm',
    text: () => 'A gap the lock never meant its parts to cross. Strong hands can climb it — it will cost you — or a certain cypher makes the air itself a floor.',
  },
  {
    id: 'train',
    when: (s) => s.player.xp >= 4,
    title: 'calibration record 8 — growth',
    text: () => 'You have noticed enough to change shape: 4 XP buys a permanent lesson — a deeper pool, a sharper edge, a harder blow. Rest somewhere quiet and train. Four lessons make the next tier.',
    sub: (touch) => (touch ? 'the person tab → Rest' : 'R opens rest & training'),
  },
];

/** Fire at most one due lesson; call from updateExplore after pumpScripted. */
export function pumpTutorial(state, touch) {
  if (state.mode !== 'EXPLORE') return;
  const seen = (state.tutSeen ||= new Set());
  for (const l of LESSONS) {
    if (seen.has(l.id) || !l.when(state)) continue;
    seen.add(l.id);
    state.prevMode = 'EXPLORE';
    state.mode = 'MODAL';
    document.exitPointerLock?.();
    state.modal = { kind: 'tutorial', title: l.title, text: l.text(touch), sub: l.sub?.(touch) };
    return;
  }
}
