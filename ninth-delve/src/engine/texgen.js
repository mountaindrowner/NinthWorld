// Procedural fallback art + asset loader. Every asset key in Asset doc §2–§4 has
// a code-drawn placeholder here, so the game is fully playable with zero PNGs.
// loadAssets() tries the on-disk PNG first (drop art into /assets to override),
// then falls back to the recipe. All colors come from the "Buried Aeon" palette.

/** Buried Aeon — 16 colors (Asset §1). Use exclusively. */
export const PALETTE = {
  void: '#0A0A12', deepSteel: '#1C222B', steel: '#2E3A45', steelLight: '#4A5A66',
  rust: '#8C4A2F', rustDeep: '#5A2E1E', blood: '#7A1F2B', moss: '#4F6B3A',
  boneLight: '#D9CBB3', boneShadow: '#9A8C74', gold: '#C9A227', goldGlow: '#F2D06B',
  cyan: '#4FE3C1', cyanDeep: '#1E6E63', mauve: '#6B4E71', staticWhite: '#E8ECEF',
};
const P = PALETTE;

// --- tiny helpers -------------------------------------------------------------

/** Deterministic PRNG so fallbacks look identical every boot (seeded per key). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashKey = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// --- texture recipes (64×64) --------------------------------------------------

function synthBase(ctx, rnd) {
  ctx.fillStyle = P.steel;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = P.deepSteel;                       // 8px seams
  for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 2);
  for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 2, 64);
  for (let i = 0; i < 90; i++) {                     // rust speckle noise
    ctx.fillStyle = rnd() > 0.5 ? P.rust : P.rustDeep;
    ctx.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
  }
}

const TEXTURE_DRAW = {
  wall_synth: (ctx, _f, rnd) => synthBase(ctx, rnd),
  wall_conduit: (ctx, _f, rnd) => {
    synthBase(ctx, rnd);
    ctx.fillStyle = P.cyanDeep; ctx.fillRect(29, 0, 6, 64);
    ctx.fillStyle = P.cyan;
    for (let y = 4; y < 64; y += 12) ctx.fillRect(31, y, 2, 4);
  },
  wall_warren: (ctx, _f, rnd) => {
    synthBase(ctx, rnd);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = rnd() > 0.5 ? P.moss : P.mauve;
      ctx.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, (2 + rnd() * 4) | 0, (2 + rnd() * 3) | 0);
    }
    ctx.fillStyle = P.boneLight;
    for (let i = 0; i < 12; i++) ctx.fillRect((rnd() * 64) | 0, (rnd() * 64) | 0, 1, 1);
  },
  wall_scuffed: (ctx, _f, rnd) => {
    synthBase(ctx, rnd);
    ctx.strokeStyle = P.boneLight; ctx.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const y = 44 + (rnd() * 16) | 0;
      ctx.beginPath(); ctx.moveTo(6 + rnd() * 40, y); ctx.lineTo(16 + rnd() * 42, y + rnd() * 6); ctx.stroke();
    }
  },
  wall_mural: (ctx, _f, rnd) => {
    synthBase(ctx, rnd);
    for (let i = 0; i < 3; i++) glyph(ctx, 12 + i * 18, 26, 12, P.gold, i);
  },
  door_slide: (ctx) => {
    ctx.fillStyle = P.steelLight; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = P.deepSteel;
    for (let y = 8; y < 64; y += 12) ctx.fillRect(4, y, 56, 3);
    ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 64, 3); ctx.fillRect(0, 61, 64, 3); // hazard edge
  },
  door_glyph: (ctx) => {
    TEXTURE_DRAW.door_slide(ctx);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = P.deepSteel; ctx.fillRect(14 + i * 14, 26, 10, 12);
      glyph(ctx, 15 + i * 14, 27, 8, P.cyan, i);
    }
  },
  // pillar_glyph is a 4-frame strip: 0 inactive, 1-2 cyan active, 3 gold correct.
  pillar_glyph: (ctx, frame) => {
    ctx.fillStyle = P.deepSteel; ctx.fillRect(18, 0, 28, 64);
    ctx.fillStyle = P.steel; ctx.fillRect(20, 2, 24, 60);
    const lit = frame === 3 ? P.goldGlow : frame === 0 ? P.steelLight : P.cyan;
    glyph(ctx, 24, 22, 16, lit, frame);
  },
};

/** A small angular numenera glyph (deterministic per index). */
function glyph(ctx, x, y, s, color, idx) {
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath();
  const pts = [[0, 0], [1, 0], [1, 0.5], [0.5, 1], [0, 0.6]];
  const rot = (idx % 4) * 0.4;
  pts.forEach(([dx, dy], i) => {
    const px = x + (dx * Math.cos(rot) - dy * Math.sin(rot)) * s;
    const py = y + (dx * Math.sin(rot) + dy * Math.cos(rot)) * s;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.stroke();
}

// --- sprite recipes (silhouette + outline + glint; phase frames @50% alpha) ---

/** Draw a body silhouette centered in a wxh frame with a 2px outline. */
function silhouette(ctx, w, h, fill, drawPath, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.strokeStyle = P.void; ctx.lineWidth = 2;
  ctx.beginPath(); drawPath(ctx, w, h); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
const blob = (cx, cy, rx, ry) => (ctx) => ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);

function creatureSprite(ctx, frame, w, h, bodyFill, frameNames) {
  const name = frameNames[frame] || 'idle';
  const bob = name === 'idle' ? (frame % 2) * 2 : 0;
  const alpha = name === 'phase' ? 0.5 : 1;
  const fill = name === 'dead' || name === 'death' ? P.rustDeep
    : name === 'hit' ? P.blood : bodyFill;
  const cy = h - 18 + bob - (name === 'lunge' ? 4 : 0);
  silhouette(ctx, w, h, name === 'phase' ? P.staticWhite : fill,
    blob(w / 2, cy, w / 3, h / 3.2), alpha);
  if (name === 'dead' || name === 'death') { // toppled marker
    ctx.strokeStyle = P.void; ctx.beginPath();
    ctx.moveTo(w * 0.3, h - 6); ctx.lineTo(w * 0.7, h - 6); ctx.stroke();
  }
}

const SPRITE_DRAW = {
  laak: (ctx, f) => creatureSprite(ctx, f, 64, 64, P.moss, ['idle', 'idle', 'lunge', 'hit', 'dead']),
  hound: (ctx, f) => creatureSprite(ctx, f, 64, 64, P.steelLight, ['idle', 'idle', 'phase', 'lunge', 'hit', 'dead']),
  murden: (ctx, f) => creatureSprite(ctx, f, 64, 64, P.mauve, ['idle', 'idle', 'throw', 'snatch', 'hit', 'dead']),
  abykos: (ctx, f) => {
    // translucent static humanoid, taller frame
    creatureSprite(ctx, f, 64, 96, P.staticWhite, ['idle', 'idle', 'drain', 'touch', 'hit', 'death', 'death']);
    ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = P.cyan;
    for (let i = 0; i < 30; i++) ctx.fillRect((Math.random() * 64) | 0, 20 + (Math.random() * 60) | 0, 1, 1);
    ctx.restore();
  },
  pickup_cypher: (ctx, f) => glintPickup(ctx, P.gold, f),
  pickup_oddity: (ctx) => glintPickup(ctx, P.cyan, 0),
  pickup_shins: (ctx) => {
    ctx.fillStyle = P.gold;
    for (let i = 0; i < 6; i++) ctx.fillRect(24 + (i % 3) * 6, 40 + ((i / 3) | 0) * 6, 5, 5);
    ctx.strokeStyle = P.void; ctx.strokeRect(23, 39, 20, 14);
  },
  artifact_key: (ctx, f) => {
    silhouette(ctx, 64, 64, P.gold, (c) => { c.rect(28, 20, 8, 30); });          // shaft
    ctx.fillStyle = P.cyan; ctx.fillRect(24, 16, 4, 10); ctx.fillRect(36, 16, 4, 10); // tuning-fork crown
    if (f % 2) { ctx.fillStyle = P.goldGlow; ctx.fillRect(30, 46, 4, 4); }
  },
};
function glintPickup(ctx, color, f) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.ellipse(32, 40, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = P.void; ctx.stroke();
  if (f % 2) { ctx.fillStyle = P.staticWhite; ctx.fillRect(30, 30, 3, 3); }
}

// --- UI recipes ---------------------------------------------------------------

const UI_DRAW = {
  d20_strip: (ctx, f) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = P.deepSteel; ctx.strokeStyle = P.gold; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + f * 0.2;
      const px = 16 + Math.cos(a) * 13, py = 16 + Math.sin(a) * 13;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.boneLight; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(String(((f * 7) % 20) + 1), 16, 20);
  },
  chip_ease: (ctx) => chip(ctx, P.cyan, P.cyanDeep),
  chip_hinder: (ctx) => chip(ctx, P.rust, P.rustDeep),
  portrait_kave: (ctx, f) => {
    const skin = [P.boneLight, P.boneShadow, P.rustDeep][f] || P.boneLight;
    ctx.fillStyle = P.deepSteel; ctx.fillRect(0, 0, 48, 48);
    ctx.fillStyle = skin; ctx.fillRect(12, 10, 24, 30);
    ctx.fillStyle = P.void; ctx.fillRect(18, 20, 4, 4); ctx.fillRect(28, 20, 4, 4);
    ctx.strokeStyle = P.gold; ctx.strokeRect(1, 1, 46, 46);
  },
  hud_frame: (ctx) => {
    ctx.clearRect(0, 0, 32, 32);
    ctx.fillStyle = P.deepSteel; ctx.fillRect(0, 0, 32, 32);
    ctx.clearRect(4, 4, 24, 24);
    ctx.strokeStyle = P.gold; ctx.lineWidth = 1; ctx.strokeRect(1.5, 1.5, 29, 29);
  },
};
function chip(ctx, edge, fill) {
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = fill; ctx.strokeStyle = edge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(2, 4, 12, 8, 3); ctx.fill(); ctx.stroke();
}

// --- manifest (mirrors Asset doc file list exactly) --------------------------

/** @typedef {{key:string,path:string,w:number,h:number,frames:number,draw:Function}} AssetDef */
/** @type {AssetDef[]} */
export const MANIFEST = [
  // textures
  ...['wall_synth', 'wall_conduit', 'wall_warren', 'wall_scuffed', 'wall_mural', 'door_slide', 'door_glyph']
    .map((k) => ({ key: k, path: `assets/textures/${k}.png`, w: 64, h: 64, frames: 1, draw: TEXTURE_DRAW[k] })),
  { key: 'pillar_glyph', path: 'assets/textures/pillar_glyphs_strip.png', w: 64, h: 64, frames: 4, draw: TEXTURE_DRAW.pillar_glyph },
  // sprites
  { key: 'laak', path: 'assets/sprites/laak.png', w: 64, h: 64, frames: 5, draw: SPRITE_DRAW.laak },
  { key: 'hound', path: 'assets/sprites/hound.png', w: 64, h: 64, frames: 6, draw: SPRITE_DRAW.hound },
  { key: 'murden', path: 'assets/sprites/murden.png', w: 64, h: 64, frames: 6, draw: SPRITE_DRAW.murden },
  { key: 'abykos', path: 'assets/sprites/abykos.png', w: 64, h: 96, frames: 7, draw: SPRITE_DRAW.abykos },
  { key: 'pickup_cypher', path: 'assets/sprites/pickup_cypher.png', w: 64, h: 64, frames: 2, draw: SPRITE_DRAW.pickup_cypher },
  { key: 'pickup_oddity', path: 'assets/sprites/pickup_oddity.png', w: 64, h: 64, frames: 1, draw: SPRITE_DRAW.pickup_oddity },
  { key: 'pickup_shins', path: 'assets/sprites/pickup_shins.png', w: 64, h: 64, frames: 1, draw: SPRITE_DRAW.pickup_shins },
  { key: 'artifact_key', path: 'assets/sprites/artifact_key.png', w: 64, h: 64, frames: 2, draw: SPRITE_DRAW.artifact_key },
  // ui
  { key: 'd20_strip', path: 'assets/ui/d20_strip.png', w: 32, h: 32, frames: 12, draw: UI_DRAW.d20_strip },
  { key: 'chip_ease', path: 'assets/ui/chip_ease.png', w: 16, h: 16, frames: 1, draw: UI_DRAW.chip_ease },
  { key: 'chip_hinder', path: 'assets/ui/chip_hinder.png', w: 16, h: 16, frames: 1, draw: UI_DRAW.chip_hinder },
  { key: 'portrait_kave', path: 'assets/ui/portrait_kave.png', w: 48, h: 48, frames: 3, draw: UI_DRAW.portrait_kave },
  { key: 'hud_frame', path: 'assets/ui/hud_frame.png', w: 32, h: 32, frames: 1, draw: UI_DRAW.hud_frame },
];

/** Render a fallback into N frame-canvases using the recipe. */
function buildFallback(def) {
  const rnd = mulberry32(hashKey(def.key));
  const frames = [];
  for (let f = 0; f < def.frames; f++) {
    const c = makeCanvas(def.w, def.h);
    const ctx = c.getContext('2d');
    if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this; };
    def.draw(ctx, f, rnd);
    frames.push(c);
  }
  return frames;
}

/** Slice a loaded strip image into frame-canvases. */
function sliceImage(img, def) {
  const frames = [];
  for (let f = 0; f < def.frames; f++) {
    const c = makeCanvas(def.w, def.h);
    c.getContext('2d').drawImage(img, f * def.w, 0, def.w, def.h, 0, 0, def.w, def.h);
    frames.push(c);
  }
  return frames;
}

const tryLoadImage = (path) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => resolve(null);
  img.src = path;
});

/**
 * Resolve every asset: on-disk PNG if present, else procedural fallback.
 * @returns {Promise<Record<string,{frames:HTMLCanvasElement[],w:number,h:number,source:'file'|'fallback'}>>}
 */
export async function loadAssets() {
  const registry = {};
  await Promise.all(MANIFEST.map(async (def) => {
    const img = await tryLoadImage(def.path);
    const source = img ? 'file' : 'fallback';
    const frames = img ? sliceImage(img, def) : buildFallback(def);
    registry[def.key] = { frames, w: def.w, h: def.h, source };
  }));
  return registry;
}
