// The bonded shard — the tutorial IS a character. A thinking cypher grafted
// itself to the player at the delve's start; the binding took their memories
// (simple amnesia frame: neither of them knows who the player is). It teaches
// as they walk, in first person, once per subject. The passive cyan one-line
// prompts (mains' tutPrompt) are its short whispers; these popups are it
// actually speaking. Voice: patient, a little guilty about the binding,
// practical — it knows the Whisperlock, not the host.

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
    title: '◇ something speaks inside your skull',
    text: () => 'Steady. I am a cypher — a thinking shard of the prior worlds. When you touched me, I bound to you, and the binding took your memories. I am sorry. I do not know your name either. But I know this place: the Whisperlock. Below us a gallery of whispers holds the way through. Walk — I will teach you as we go.',
    sub: (touch) => (touch ? 'I keep a map — the first tab, top right' : 'I keep a map — press M'),
  },
  {
    id: 'fight',
    when: (s) => s.entities.some((e) => e.kind === 'creature' && e.alive && !e.hidden && e.engaged),
    title: '◇ the shard — it means to eat you',
    text: () => 'Your body remembers the sword even if you do not. Quick cuts land fast; hold the blow and release it late to cut far deeper — that draws on your Might, the red measure I keep for you. Step back while it winds up. Then answer.',
    sub: (touch) => (touch ? 'tap the sword to cut · hold it, then let go, for a heavy blow' : 'click to cut · hold, release for a heavy blow'),
  },
  {
    id: 'pickup',
    when: (s) => s.entities.some((e) => e.kind === 'pickup' && !e.hidden && !e.taken && tileDist(s.player.x, s.player.y, e.x, e.y) < 2.2),
    title: '◇ the shard — take what the dead left',
    text: () => 'Take it. Understand how I grow you: by NOTICING. Every discovery, every secret, every first etches you deeper — you would call it XP. Killing teaches me nothing about you.',
    sub: (touch) => (touch ? 'the hand button burns gold when something is in reach' : 'E takes what is in reach'),
  },
  {
    id: 'door',
    when: (s) => nearAny(s.player, DOORS, 1.8),
    title: '◇ the shard — the sealed slabs',
    text: () => 'A door. The lock still mistakes us for one of its parts — stand close and it slides aside. Each slab seals a region; what lives behind one stays behind it. Only the great glyph lock above the gallery will not be fooled so easily.',
  },
  {
    id: 'cypher',
    when: (s) => s.player.cyphers.length > 0,
    title: '◇ the shard — you carry my kin',
    text: () => 'That device is a cypher, like me — but unbound, single-use, a miracle waiting to be spent. Spend it when it would matter; do not save it for a perfect moment that never comes. And heed me: carry more than two, and the world begins to look back.',
    sub: (touch) => (touch ? 'the diamond tab opens your devices' : 'C opens your devices'),
  },
  {
    id: 'glyphs',
    when: (s) => nearAny(s.player, PILLARS.map((p) => [p.x, p.y]), 3.2),
    title: '◇ the shard — the whisper gallery',
    text: () => 'This is the gallery I promised. Three pillars, three glyphs, one true order. The answer is scattered west, in the warrens — a mural, a dead courier’s trinket — or stand at the lock and I will help you intuit it. Guess wrong, and the room answers.',
  },
  {
    id: 'chasm',
    when: (s) => nearAny(s.player, CHASM, 2.6),
    title: '◇ the shard — the coolant chasm',
    text: () => 'The lock never meant its parts to cross this. Strong hands can climb it — it will cost you, and I will feel it too — or one of my kin could make the air itself a floor.',
  },
  {
    id: 'train',
    when: (s) => s.player.xp >= 4,
    title: '◇ the shard — you can grow now',
    text: () => 'You have noticed enough for me to work with. Rest somewhere quiet and I will braid what you have seen into you, permanently — a deeper pool, a sharper edge, a harder blow. Four such braidings, and you become something more.',
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
