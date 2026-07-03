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

// --- creature sprite art -------------------------------------------------------
// Hand-designed pixel art, drawn at HALF resolution (32×32; boss 32×48) and
// integer-upscaled ×2 for chunky texels. Solid creatures get an automatic 1px
// (→2px final) void outline; the abykos stays outline-free — it's made of static.

function px(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function poly(ctx, pts, col) {
  ctx.fillStyle = col; ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fill();
}
function scatter(ctx, rnd, n, x, y, w, h, col) {
  ctx.fillStyle = col;
  for (let i = 0; i < n; i++) ctx.fillRect(x + (rnd() * w) | 0, y + (rnd() * h) | 0, 1, 1);
}

/** Draw at half-res via `art(hctx)`, outline the silhouette, upscale ×2 into ctx. */
function pixelSprite(ctx, w, h, art, { outline = true } = {}) {
  const hw = w / 2, hh = h / 2;
  const tmp = makeCanvas(hw, hh);
  art(tmp.getContext('2d'));
  ctx.imageSmoothingEnabled = false;
  if (outline) {
    const sil = makeCanvas(hw, hh);
    const s = sil.getContext('2d');
    s.drawImage(tmp, 0, 0);
    s.globalCompositeOperation = 'source-in';
    s.fillStyle = P.void; s.fillRect(0, 0, hw, hh);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.drawImage(sil, 0, 0, hw, hh, dx * 2, dy * 2, w, h);
    }
  }
  ctx.drawImage(tmp, 0, 0, hw, hh, 0, 0, w, h);
}

/** Soft ground shadow: seats a creature on the floor. */
function shadow(c, cx, w, y = 29) {
  c.globalAlpha = 0.35; c.fillStyle = P.void;
  c.fillRect(cx - w / 2, y, w, 2);
  c.globalAlpha = 1;
}

// LAAK — palm-sized six-legged lizard, moss body, rust back-speckle (32×32 grid).
function laakArt(c, f, rnd) {
  const name = ['idleA', 'idleB', 'lunge', 'hit', 'dead', 'frontA', 'frontB', 'backA', 'backB'][f];
  if (name === 'frontA' || name === 'frontB') { // head-on: wide flat head, both eyes
    const b = name === 'frontB' ? 1 : 0;
    shadow(c, 16, 16, 28);
    px(c, 12, 18 - b, 8, 5, P.moss);                       // body rising behind
    scatter(c, rnd, 5, 12, 18 - b, 8, 3, P.rust);
    poly(c, [[15, 12 - b], [18, 10 - b], [19, 14 - b], [14, 15 - b]], P.moss); // tail tip over back
    px(c, 10, 22 - b, 12, 5, P.moss);                      // flat head, wide
    px(c, 10, 25 - b, 12, 2, P.boneShadow);                // chin
    px(c, 12, 23 - b, 2, 1, P.goldGlow); px(c, 18, 23 - b, 2, 1, P.goldGlow); // both eyes
    for (let i = 0; i < 3; i++) {                          // legs splayed both sides
      px(c, 7 - i, 24 + i - b, 2, 2, P.moss); px(c, 23 + i, 24 + i - b, 2, 2, P.moss);
    }
    return;
  }
  if (name === 'backA' || name === 'backB') { // tail toward you, head away
    const b = name === 'backB' ? 1 : 0;
    shadow(c, 16, 16, 28);
    px(c, 11, 18 - b, 10, 4, P.moss);                      // far body
    scatter(c, rnd, 4, 11, 18 - b, 10, 3, P.rust);
    px(c, 13, 15 - b, 6, 3, P.rustDeep);                   // head beyond (dim)
    poly(c, [[13, 22 - b], [19, 22 - b], [17 + b, 28], [14 - b, 28]], P.moss); // thick tail base toward you
    px(c, 15, 26, 2, 2, P.boneShadow);                     // tail underside
    for (let i = 0; i < 3; i++) {
      px(c, 8 - i, 20 + i - b, 2, 2, P.moss); px(c, 22 + i, 20 + i - b, 2, 2, P.moss);
    }
    return;
  }
  if (name === 'dead') {
    px(c, 8, 26, 17, 4, P.rustDeep);               // flattened body
    px(c, 9, 25, 14, 2, P.moss);
    poly(c, [[25, 27], [30, 25], [30, 29], [25, 30]], P.rustDeep); // head flopped
    for (let i = 0; i < 3; i++) px(c, 11 + i * 4, 22, 1, 3, P.rustDeep); // legs up
    px(c, 4, 27, 4, 1, P.rustDeep);                // limp tail
    return;
  }
  const lu = name === 'lunge', hit = name === 'hit';
  const bob = name === 'idleB' ? 1 : 0;
  const bx = lu ? 6 : 9, by = 21 + bob - (lu ? 2 : 0);
  shadow(c, bx + (lu ? 11 : 9), 20, 29);
  // tail (whip, curls opposite on idleB)
  poly(c, [[bx, by + 3], [bx - 6, by + (name === 'idleB' ? 5 : 1)], [bx - 7, by + (name === 'idleB' ? 6 : 2)], [bx, by + 5]], P.moss);
  // body — low slab, lunge stretches it
  px(c, bx, by, lu ? 19 : 15, 5, P.moss);
  px(c, bx, by + 4, lu ? 19 : 15, 2, P.boneShadow);      // belly
  scatter(c, rnd, 8, bx, by, lu ? 18 : 14, 3, P.rust);   // back speckle
  if (hit) px(c, bx + 3, by - 1, 9, 2, P.blood);         // welt
  // head — flat wedge, jaw opens on lunge
  const hx = bx + (lu ? 19 : 15);
  poly(c, [[hx, by], [hx + 6, by + (lu ? -1 : 1)], [hx + 6, by + 3], [hx, by + 4]], P.moss);
  if (lu) poly(c, [[hx + 2, by + 3], [hx + 7, by + 5], [hx + 2, by + 5]], P.rustDeep); // open jaw
  px(c, hx + 4, by + 1, 1, 1, P.goldGlow);               // eye
  // six legs — three near (moss), three far (darker), splayed when lunging
  for (let i = 0; i < 3; i++) {
    const lx = bx + 2 + i * 5 + (name === 'idleB' ? 1 : 0);
    px(c, lx + 1, by + 5, 1, 2, P.cyanDeep);             // far leg
    px(c, lx + (lu ? -1 : 0), by + 5, 1, lu ? 4 : 3, P.moss); // near leg
    px(c, lx + (lu ? -2 : -1), by + 7 + (lu ? 1 : 0), 2, 1, P.moss); // foot
  }
}

// BROKEN HOUND — wrong-jointed dog, steel hide, cyan light in the seams (32×32).
function houndArt(c, f, rnd) {
  const name = ['idleA', 'idleB', 'phase', 'lunge', 'hit', 'dead', 'frontA', 'frontB', 'backA', 'backB'][f];
  if (name === 'frontA' || name === 'frontB') { // head-on: narrow chest, low skull
    const b = name === 'frontB' ? 1 : 0;
    shadow(c, 16, 14);
    px(c, 12, 12 + b, 8, 10, P.steel);                     // chest slab
    px(c, 11, 13 + b, 2, 8, P.deepSteel); px(c, 19, 13 + b, 2, 8, P.deepSteel); // shoulders jut
    for (let i = 0; i < 4; i++) px(c, 15 + (i % 2), 13 + b + i * 2, 1, 1, P.cyan); // sternum seam
    poly(c, [[13, 20 + b], [19, 20 + b], [18, 26 + b], [14, 26 + b]], P.deepSteel); // skull, low & wrong
    px(c, 14, 22 + b, 2, 1, P.cyan); px(c, 17, 22 + b, 2, 1, P.cyan); // both eye slits
    px(c, 15, 25 + b, 3, 1, P.blood);                      // underslung jaw line
    px(c, 10, 21 + b, 2, 8, P.steel); px(c, 20, 21 + b, 2, 8, P.steel);   // forelegs
    px(c, 9, 25 + b, 2, 2, P.deepSteel); px(c, 21, 25 + b, 2, 2, P.deepSteel); // wrong knees out
    return;
  }
  if (name === 'backA' || name === 'backB') { // haunches, spine seam running away
    const b = name === 'backB' ? 1 : 0;
    shadow(c, 16, 14);
    px(c, 10, 14 + b, 12, 9, P.steel);                     // wide haunches
    px(c, 10, 21 + b, 12, 2, P.deepSteel);
    for (let i = 0; i < 5; i++) px(c, 15 + (b ? (i % 2) : ((i + 1) % 2)), 8 + i * 3, 2, 1, P.cyan); // spine seam foreshortened
    px(c, 14, 6 + b, 4, 3, P.deepSteel);                   // skull far, lowered
    poly(c, [[20, 14 + b], [24, 10 + b], [25, 12 + b], [21, 16 + b]], P.deepSteel); // kinked tail
    px(c, 11, 23 + b, 2, 6, P.steel); px(c, 19, 23 + b, 2, 6, P.steel);   // hind legs
    px(c, 13, 25 + b, 2, 2, P.deepSteel); px(c, 17, 25 + b, 2, 2, P.deepSteel); // joints wrong-ways
    return;
  }
  if (name === 'dead') {
    px(c, 6, 24, 20, 5, P.deepSteel);                 // collapsed heap
    px(c, 8, 22, 12, 3, P.steel);
    poly(c, [[24, 25], [31, 23], [30, 27], [24, 28]], P.deepSteel); // head down
    px(c, 10, 29, 8, 1, P.steel);                     // sprawled leg
    px(c, 12, 24, 1, 1, P.cyanDeep); px(c, 18, 23, 1, 1, P.cyanDeep); // dead seams
    return;
  }
  const phase = name === 'phase';
  const lu = name === 'lunge', hit = name === 'hit';
  const bob = name === 'idleB' ? 1 : 0;
  const body = phase ? P.staticWhite : P.steel;
  const dark = phase ? P.staticWhite : P.deepSteel;
  if (!phase) shadow(c, 17, 20);
  if (phase) c.globalAlpha = 0.5;

  const tilt = lu ? -4 : 0;                            // lunge rears up-forward
  const by = 12 + bob + (hit ? 2 : 0);
  // torso — gaunt slab, hips higher than shoulders (wrongness)
  poly(c, [[7, by + 4], [24, by + tilt], [25, by + 6 + tilt], [9, by + 10]], body);
  px(c, 8, by + 8, 14, 2, dark);                       // underbelly shadow
  // neck + head low and forward, jaw underslung
  const hx = lu ? 27 : 24, hy = by + tilt + (lu ? -2 : 2);
  poly(c, [[hx - 4, hy], [hx + 6, hy + 2], [hx + 5, hy + 6], [hx - 3, hy + 5]], dark);
  if (lu || hit) poly(c, [[hx + 2, hy + 5], [hx + 7, hy + 8], [hx + 1, hy + 7]], P.blood); // jaw open
  px(c, hx + 2, hy + 2, 2, 1, phase ? P.staticWhite : P.cyan); // eye slit
  // legs — reverse-kneed zigzags; lunge extends the front pair
  const legs = [
    [10, 0], [14, 1], // hind pair
    [20, lu ? 3 : 0], [23, lu ? 4 : 1], // front pair
  ];
  for (const [lx, ext] of legs) {
    const ky = by + 10;
    px(c, lx, ky, 2, 3, body);                         // thigh
    px(c, lx + 1, ky + 2, 2, 2, dark);                 // WRONG joint (juts back)
    px(c, lx + 2 + ext, ky + 4, 2, 4, body);           // shin, extended on lunge
    px(c, lx + 2 + ext, ky + 8, 3, 1, dark);           // toes
  }
  // cyan light leaking from the seams (spine + joints); flickers between idles
  if (!phase) {
    const seam = name === 'idleB' ? 1 : 0;
    for (let i = 0; i < 5; i++) px(c, 9 + i * 3 + seam, by + 1 + ((i * 7) % 3) - (lu ? Math.round(i * 0.8) : 0), 1, 1, P.cyan);
    px(c, 12, by + 12, 1, 1, P.cyan); px(c, 22, by + 12, 1, 1, P.cyan);
    if (hit) { scatter(c, rnd, 6, 8, by, 16, 8, P.cyan); px(c, 10, by + 2, 10, 2, P.blood); }
  } else {
    scatter(c, rnd, 10, 4, 8, 26, 18, P.staticWhite);  // dissolving static
  }
  c.globalAlpha = 1;
}

// MURDEN — hunched raven-headed abhuman, mauve rags, gold eye (32×32).
function murdenArt(c, f, rnd) {
  const name = ['idleA', 'idleB', 'throw', 'snatch', 'hit', 'dead', 'frontA', 'frontB', 'backA', 'backB'][f];
  if (name === 'frontA' || name === 'frontB') { // facing you: beak-on, both gold eyes
    const b = name === 'frontB' ? 1 : 0;
    shadow(c, 16, 14);
    px(c, 13, 24, 2, 5, P.boneShadow); px(c, 17, 24, 2, 5, P.boneShadow); // stick legs
    poly(c, [[9, 14 + b], [23, 14 + b], [24, 22], [21, 24], [18, 22], [15, 25], [12, 22], [8, 23]], P.mauve); // cloak, ragged hem
    px(c, 10, 16 + b, 3, 5, P.rustDeep);                   // rag shadow
    scatter(c, rnd, 7, 10, 15, 12, 8, P.deepSteel);        // feathers
    px(c, 9, 18, 2, 4, P.mauve); px(c, 21, 18, 2, 4, P.mauve); // arms at sides
    px(c, 9, 22, 2, 1, P.boneShadow); px(c, 21, 22, 2, 1, P.boneShadow); // claw tips
    poly(c, [[12, 8 + b], [20, 8 + b], [21, 14 + b], [11, 14 + b]], P.deepSteel); // head
    px(c, 13, 10 + b, 2, 1, P.goldGlow); px(c, 17, 10 + b, 2, 1, P.goldGlow);    // BOTH eyes on you
    poly(c, [[14, 12 + b], [18, 12 + b], [16, 17 + b]], P.boneShadow);            // beak at you
    return;
  }
  if (name === 'backA' || name === 'backB') { // hunched back: crest, no eyes
    const b = name === 'backB' ? 1 : 0;
    shadow(c, 16, 14);
    px(c, 13, 24, 2, 5, P.boneShadow); px(c, 17, 24, 2, 5, P.boneShadow);
    poly(c, [[9, 12 + b], [23, 12 + b], [24, 22], [20, 24], [16, 22], [12, 25], [8, 22]], P.mauve); // cloak back
    for (let i = 0; i < 4; i++) px(c, 11 + i * 3, 14 + b + (i % 2), 1, 7, P.rustDeep); // vertical rag folds
    scatter(c, rnd, 5, 10, 13, 12, 8, P.deepSteel);
    poly(c, [[13, 7 + b], [19, 7 + b], [20, 12 + b], [12, 12 + b]], P.deepSteel);  // skull from behind
    px(c, 15, 5 + b, 2, 3, P.deepSteel);                   // crest feathers
    px(c, 16, 4 + b, 1, 2, P.boneShadow);
    return;
  }
  if (name === 'dead') {
    poly(c, [[7, 29], [10, 23], [22, 22], [26, 29]], P.mauve);   // crumpled rag pile
    px(c, 8, 27, 17, 2, P.rustDeep);
    poly(c, [[20, 22], [24, 15], [26, 16], [23, 23]], P.deepSteel); // beak jutting up
    scatter(c, rnd, 5, 9, 24, 14, 4, P.boneShadow);              // spilled feathers
    return;
  }
  const sway = name === 'idleB' ? 1 : 0;
  const th = name === 'throw', sn = name === 'snatch', hit = name === 'hit';
  const lean = sn ? 4 : th ? -2 : 0;
  shadow(c, 16, 16);
  // stick legs, backward knees
  px(c, 13, 24, 2, 3, P.boneShadow); px(c, 12, 27, 2, 3, P.boneShadow); px(c, 12, 29, 3, 1, P.deepSteel);
  px(c, 18, 24, 2, 3, P.boneShadow); px(c, 19, 27, 2, 3, P.boneShadow); px(c, 19, 29, 3, 1, P.deepSteel);
  // hunched cloak of rags — ragged hem
  poly(c, [
    [10 + lean, 12 + sway], [21 + lean, 9 + sway], [24 + lean / 2, 16], [23, 22],
    [20, 24], [17, 22], [14, 25], [11, 22], [9, 24], [8, 17],
  ], P.mauve);
  px(c, 10 + lean, 14 + sway, 4, 6, P.rustDeep);                 // rag shadow
  scatter(c, rnd, 6, 10, 13, 12, 9, P.deepSteel);                // feather texture
  if (hit) { px(c, 12, 13, 9, 3, P.blood); scatter(c, rnd, 6, 8, 8, 18, 8, P.boneShadow); } // burst feathers
  // raven head — deepSteel, long beak, gold-glow eye
  const hx = 19 + lean, hy = 6 + sway - (sn ? 2 : 0);
  poly(c, [[hx - 3, hy + 2], [hx + 4, hy], [hx + 5, hy + 5], [hx - 2, hy + 7]], P.deepSteel);
  poly(c, [[hx + 4, hy + 2], [hx + 12 + (sn ? 2 : 0), hy + 4], [hx + 4, hy + 5]], P.boneShadow); // beak
  px(c, hx + 2, hy + 2, 1, 1, P.goldGlow);                       // the eye
  // arms: throw = cocked overhead with a stone · snatch = raking claw forward
  if (th) {
    px(c, hx - 2, hy - 4, 2, 6, P.mauve);                        // raised arm
    px(c, hx - 1, hy - 7, 4, 4, P.staticWhite);                  // the stone
    px(c, hx, hy - 6, 2, 2, P.steelLight);
  } else if (sn) {
    px(c, hx + 2, hy + 8, 8, 2, P.mauve);                        // reaching arm
    for (let i = 0; i < 3; i++) px(c, hx + 10, hy + 7 + i * 2, 2, 1, P.boneShadow); // claws
  } else {
    px(c, 11 + sway, 16, 2, 5, P.mauve);                         // tucked arm
    px(c, 11 + sway, 21, 2, 2, P.boneShadow);                    // claw tips
  }
}

// ABYKOS — translucent humanoid of static, 64×96 (32×48 grid). No outline;
// it isn't quite there. Gold converges inward on drain; static bursts on hit.
function abykosArt(c, f, rnd) {
  const name = ['idleA', 'idleB', 'drain', 'touch', 'hit', 'deathA', 'deathB', 'backA', 'backB'][f];
  const sway = (name === 'idleB' || name === 'backB') ? 1 : 0;
  const CX = 16;

  if (name === 'backA' || name === 'backB') { // from behind: no eyes, dimmer core
    c.globalAlpha = 0.45;
    px(c, CX - 2 + sway, 3, 4, 6, P.staticWhite);
    px(c, CX - 3 + sway, 4, 6, 4, P.staticWhite);
    for (let i = 0; i < 13; i++) {
      if (i > 1 && (i * 7 + 3) % 5 === 0) continue;
      const w = 12 - Math.floor(i * 0.55) + ((i * 5) % 3) - 1;
      const jit = ((i * 11) % 3) - 1;
      px(c, CX - w / 2 + sway + jit, 10 + i * 2, w, 1, P.staticWhite);
    }
    for (let i = 0; i < 10; i++) px(c, CX - 4 + ((i * 7) % 9) + sway, 34 + i + ((i * 13) % 4), 1, 2, P.staticWhite);
    c.globalAlpha = 1;
    c.globalAlpha = 0.4; px(c, CX + sway, 12, 1, 16, P.staticWhite); c.globalAlpha = 1; // dim core
    scatter(c, rnd, 8, CX - 6 + sway, 8, 12, 28, P.cyanDeep);
    return;
  }

  if (name === 'deathB') { // almost gone: a loose column of motes + a fading core
    scatter(c, rnd, 22, 8, 6, 16, 36, P.staticWhite);
    c.globalAlpha = 0.5; px(c, CX - 1, 12, 2, 22, P.staticWhite); c.globalAlpha = 1;
    px(c, CX, 18, 1, 6, P.cyan);
    return;
  }

  c.globalAlpha = 0.55;
  const gap = name === 'deathA' ? 3 : 0;               // body shearing into bands
  const bodyCol = P.staticWhite;
  // head — a dim rounded orb
  px(c, CX - 2 + sway, 3, 4, 6, bodyCol);
  px(c, CX - 3 + sway, 4, 6, 4, bodyCol);
  // torso — a figure of horizontal static bands: ragged widths, jitter, dropouts.
  // It shouldn't read as flesh; it reads as bad signal.
  for (let i = 0; i < 13; i++) {
    if (!gap && i > 1 && (i * 7 + 3) % 5 === 0) continue;          // signal dropouts
    const w = 12 - Math.floor(i * 0.55) + ((i * 5) % 3) - 1;       // ragged taper
    const jit = ((i * 11) % 3) - 1;                                // horizontal noise
    const off = gap ? ((i % 2) ? gap : -gap) : (name === 'hit' && i % 3 === 1 ? 99 : 0);
    if (off === 99) continue;                                      // hit: torn bands
    px(c, CX - w / 2 + sway + jit + off, 10 + i * 2, w, 1, bodyCol);
    if ((i * 13) % 4 !== 0) px(c, CX - w / 2 + sway + jit + off + 1, 11 + i * 2, w - 2, 1, bodyCol);
  }
  // arms — thin, broken segments (never a solid limb)
  const seg = (x, y, dx, dy, n) => { for (let i = 0; i < n; i++) if (i % 3 !== 2) px(c, x + dx * i, y + dy * i, 2, 2, bodyCol); };
  if (name === 'drain') {
    seg(CX - 7, 13, -2, -1, 5); seg(CX + 5, 13, 2, -1, 5);         // spread wide, rising
  } else if (name === 'touch') {
    seg(CX + 4, 14, 3, 0, 4);                                      // reaching out
    px(c, CX + 14, 11, 4, 6, bodyCol);                             // the open hand
    seg(CX - 6, 13, -1, 2, 4);
  } else {
    seg(CX - 7 + sway, 12, 0, 3, 4); seg(CX + 6 + sway, 12, 0, 3, 4);
  }
  // lower body dissolves into falling motes
  for (let i = 0; i < 10; i++) {
    const yy = 34 + i + ((i * 13) % 4);
    px(c, CX - 4 + ((i * 7) % 9) + sway, yy, 1, 2, bodyCol);
  }
  c.globalAlpha = 1;

  // bright core seam + inner cyan static (always shimmering)
  px(c, CX + sway, 10, 1, 20, P.staticWhite);
  scatter(c, rnd, 14, CX - 6 + sway, 8, 12, 28, P.cyan);
  px(c, CX - 2 + sway, 5, 1, 1, P.cyan); px(c, CX + 1 + sway, 5, 1, 1, P.cyan); // eyes

  if (name === 'drain') { // gold light pulled inward from the edges
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const r = 12 + (i % 3) * 2;
      px(c, Math.round(CX + Math.cos(a) * r), Math.round(20 + Math.sin(a) * r * 0.9), 1, 1, P.goldGlow);
      px(c, Math.round(CX + Math.cos(a) * (r - 5)), Math.round(20 + Math.sin(a) * (r - 5) * 0.9), 1, 1, P.gold);
    }
  }
  if (name === 'hit') scatter(c, rnd, 18, 2, 4, 28, 34, P.staticWhite); // static burst
}

const SPRITE_DRAW = {
  laak: (ctx, f, rnd) => pixelSprite(ctx, 64, 64, (c) => laakArt(c, f, rnd)),
  hound: (ctx, f, rnd) => pixelSprite(ctx, 64, 64, (c) => houndArt(c, f, rnd), { outline: f !== 2 }), // no outline mid-phase
  murden: (ctx, f, rnd) => pixelSprite(ctx, 64, 64, (c) => murdenArt(c, f, rnd)),
  abykos: (ctx, f, rnd) => pixelSprite(ctx, 64, 96, (c) => abykosArt(c, f, rnd), { outline: false }),
  pickup_cypher: (ctx, f) => glintPickup(ctx, P.gold, f),
  pickup_oddity: (ctx) => glintPickup(ctx, P.cyan, 0),
  pickup_shins: (ctx) => {
    ctx.fillStyle = P.gold;
    for (let i = 0; i < 6; i++) ctx.fillRect(24 + (i % 3) * 6, 40 + ((i / 3) | 0) * 6, 5, 5);
    ctx.strokeStyle = P.void; ctx.strokeRect(23, 39, 20, 14);
  },
  artifact_key: (ctx, f) => {
    ctx.fillStyle = P.void; ctx.fillRect(26, 18, 12, 34);                        // outline plate
    ctx.fillStyle = P.gold; ctx.fillRect(28, 20, 8, 30);                         // shaft
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
  { key: 'laak', path: 'assets/sprites/laak.png', w: 64, h: 64, frames: 9, draw: SPRITE_DRAW.laak },
  { key: 'hound', path: 'assets/sprites/hound.png', w: 64, h: 64, frames: 10, draw: SPRITE_DRAW.hound },
  { key: 'murden', path: 'assets/sprites/murden.png', w: 64, h: 64, frames: 10, draw: SPRITE_DRAW.murden },
  { key: 'abykos', path: 'assets/sprites/abykos.png', w: 64, h: 96, frames: 9, draw: SPRITE_DRAW.abykos },
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
