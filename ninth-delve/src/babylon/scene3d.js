// scene3d.js — the Babylon "body" for the Whisperlock. Pure visualization:
// the game simulates in map space exactly as it always has (movement, combat,
// collision all live in src/game/), and this module builds meshes/lights/
// sprites from the same data and mirrors GameState every frame. No game logic
// lives here. Expects the vendored BABYLON global (vendor/babylon.js).

import { PALETTE } from '../engine/texgen.js';
import { MAP, MAP_W, MAP_H, CELL, PLACEMENTS, DOORS, ZONES } from '../data/map_whisperlock.js';
import { wallTextureKey, doorSlide } from '../game/world.js';
import { CREATURES } from '../data/creatures.js';

const C = 1.5;                       // 1 map cell = 1.5 m
const EYE = 1.5;                     // camera eye height
export const wx = (mx) => mx * C;
export const wz = (my) => -my * C;

// per-zone ceiling heights (real shape — the raycaster's one impossible thing)
function ceilH(x, y) {
  if (x >= 4 && x <= 10 && y >= 19 && y <= 21) return 5.2;   // Z1 collapsed room
  if (y >= 1 && y <= 3) return 6.0;                          // Z5 lock core
  if (x >= 15 && x <= 22 && y >= 4 && y <= 12) return 5.6;   // Z4 chasm cavern
  if (x >= 4 && x <= 12 && y >= 5 && y <= 12) return 3.8;    // Z3 whisper gallery
  return 2.6;                                                // corridors
}
const HOLE = (x, y) => (x === 6 || x === 7) && y === 20;     // Z1 ceiling collapse

const keyOf = (x, y) => y * MAP_W + x;
const cellCh = (x, y) => (MAP[y] && MAP[y][x]) || '#';
const FRAME_N = { laak: 9, hound: 10, murden: 10, abykos: 9 };
const SIZE = { laak: 0.7, hound: 1.35, murden: 1.7, abykos: 2.7 };

export function createScene3D(canvas, state, assets) {
  const engine = new BABYLON.Engine(canvas, false, { antialias: false });
  engine.setHardwareScalingLevel(2); // PS1-flavored chunk; P key cycles
  const scene = new BABYLON.Scene(engine);
  scene.clearColor = BABYLON.Color4.FromHexString(PALETTE.void + 'FF');
  scene.ambientColor = new BABYLON.Color3(1, 1, 1);
  scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
  scene.fogColor = BABYLON.Color3.FromHexString(PALETTE.void);
  scene.fogDensity = 0.05;

  // --- materials from the game's procedural textures -------------------------
  const matCache = {};
  function matFor(key, opts = {}) {
    const id = key + JSON.stringify(opts);
    if (matCache[id]) return matCache[id];
    const src = assets[key].frames[opts.frame ?? 0];
    const dt = new BABYLON.DynamicTexture('t_' + id, { width: src.width, height: src.height }, scene, false);
    dt.getContext().drawImage(src, 0, 0); dt.update(false);
    dt.updateSamplingMode(BABYLON.Texture.NEAREST_SAMPLINGMODE);
    const m = new BABYLON.StandardMaterial('m_' + id, scene);
    m.diffuseTexture = dt;
    m.specularColor = BABYLON.Color3.Black();
    m.ambientColor = new BABYLON.Color3(0.10, 0.10, 0.12);
    m.maxSimultaneousLights = 6;
    matCache[id] = m;
    return m;
  }

  // --- geometry: every cell of the real map ----------------------------------
  const secretMeshes = new Map();   // cellKey -> mesh (hidden when found/phased)
  const doorMeshes = [];            // {mesh, x, y, axis, base}
  const pillarMeshes = [];          // glyph pillars, retextured on rotation
  const staticBuckets = {};         // material key -> meshes to merge (1 draw call each)
  const bucket = (key, mesh) => { (staticBuckets[key] ||= []).push(mesh); };

  const isWall = (ch) => ch === CELL.WALL || ch === ' ';
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const ch = cellCh(x, y);
      const h = ceilH(x, y);

      if (isWall(ch) || ch === CELL.SECRET || ch === CELL.PILLAR) {
        // wall height must reach the tallest neighboring room's ceiling
        let hh = h;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) hh = Math.max(hh, ceilH(x + dx, y + dy));
        if (ch === CELL.PILLAR) {
          const idx = pillarMeshes.length;
          const p = BABYLON.MeshBuilder.CreateBox('g' + idx, { width: C * 0.7, depth: C * 0.7, height: hh }, scene);
          p.position.set(wx(x) + C / 2, hh / 2, wz(y) - C / 2);
          p.material = matFor('pillar_glyph', { frame: 0, pillar: idx });
          pillarMeshes.push({ mesh: p, idx, lastFrame: 0 });
          continue;
        }
        const box = BABYLON.MeshBuilder.CreateBox('w', { width: C, depth: C, height: hh }, scene);
        box.position.set(wx(x) + C / 2, hh / 2, wz(y) - C / 2);
        const wkey = ch === CELL.SECRET ? 'wall_scuffed' : wallTextureKey(x, y);
        box.material = matFor(wkey);
        if (ch === CELL.SECRET) secretMeshes.set(keyOf(x, y), box); // dynamic — not merged
        else bucket(wkey, box);
        continue;
      }

      if (ch === CELL.DOOR || ch === CELL.LOCK) {
        // thin sliding slab; orientation from which neighbors are open
        const openNS = !isWall(cellCh(x, y - 1)) && !isWall(cellCh(x, y + 1));
        const axis = openNS ? 'x' : 'z'; // passage along z → slab spans x
        const d = BABYLON.MeshBuilder.CreateBox('d', {
          width: axis === 'x' ? C : 0.22, depth: axis === 'x' ? 0.22 : C, height: 2.6,
        }, scene);
        d.position.set(wx(x) + C / 2, 1.3, wz(y) - C / 2);
        d.material = matFor(ch === CELL.LOCK ? 'door_glyph' : 'door_slide');
        doorMeshes.push({ mesh: d, x, y, axis, baseX: d.position.x, baseZ: d.position.z });
        // door frame filler above
        const top = BABYLON.MeshBuilder.CreateBox('dt', { width: C, depth: C, height: ceilH(x, y) - 2.6 + 0.01 }, scene);
        top.position.set(wx(x) + C / 2, 2.6 + (ceilH(x, y) - 2.6) / 2, wz(y) - C / 2);
        top.material = matFor('wall_synth'); bucket('wall_synth', top);
        // floor under the door
        const df = BABYLON.MeshBuilder.CreateGround('df', { width: C, height: C }, scene);
        df.position.set(wx(x) + C / 2, 0, wz(y) - C / 2);
        df.material = matFor('wall_synth'); bucket('wall_synth', df);
        const dc = BABYLON.MeshBuilder.CreateGround('dc', { width: C, height: C }, scene);
        dc.position.set(wx(x) + C / 2, ceilH(x, y), wz(y) - C / 2);
        dc.rotation.x = Math.PI;
        dc.material = matFor('wall_conduit'); bucket('wall_conduit', dc);
        continue;
      }

      // walkable / chasm cells
      if (ch === CELL.CHASM) {
        // a REAL pit: no floor; shaft walls plunge down to a glowing coolant bed
        const depth = 3.2;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (cellCh(x + dx, y + dy) === CELL.CHASM) continue;
          const pw = BABYLON.MeshBuilder.CreatePlane('pw', { width: C, height: depth }, scene);
          const cxx = wx(x) + C / 2 + dx * C / 2, czz = wz(y) - C / 2 - dy * C / 2;
          pw.position.set(cxx, -depth / 2, czz);
          pw.rotation.y = dx === 1 ? -Math.PI / 2 : dx === -1 ? Math.PI / 2 : dy === 1 ? Math.PI : 0;
          pw.material = matFor('wall_conduit'); bucket('wall_conduit', pw);
        }
        const bed = BABYLON.MeshBuilder.CreateGround('bed', { width: C, height: C }, scene);
        bed.position.set(wx(x) + C / 2, -depth, wz(y) - C / 2);
        const bm = matCache.bed || (matCache.bed = (() => {
          const m = new BABYLON.StandardMaterial('bedm', scene);
          m.emissiveColor = BABYLON.Color3.FromHexString(PALETTE.cyanDeep);
          m.disableLighting = true; return m;
        })());
        bed.material = bm; bucket('bed', bed);
        continue;
      }

      // regular floor + ceiling, both textured
      const f = BABYLON.MeshBuilder.CreateGround('f', { width: C, height: C }, scene);
      f.position.set(wx(x) + C / 2, 0, wz(y) - C / 2);
      f.material = matFor('wall_synth'); bucket('wall_synth', f);
      if (!HOLE(x, y)) {
        const cl = BABYLON.MeshBuilder.CreateGround('cl', { width: C, height: C }, scene);
        cl.position.set(wx(x) + C / 2, h, wz(y) - C / 2);
        cl.rotation.x = Math.PI;
        cl.material = matFor('wall_conduit'); bucket('wall_conduit', cl);
      }
    }
  }

  // merge all static geometry: one mesh (one draw call) per material
  for (const [key, meshes] of Object.entries(staticBuckets)) {
    if (meshes.length < 2) continue;
    const merged = BABYLON.Mesh.MergeMeshes(meshes, true, true, undefined, false, false);
    if (merged) {
      merged.material = key === 'bed' ? matCache.bed : matFor(key);
      merged.freezeWorldMatrix();
    }
  }

  // crossing shimmer: a faint plane over the chasm while the Nullifier holds you
  const chasmCells = [];
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (cellCh(x, y) === CELL.CHASM) chasmCells.push([x, y]);
  const shimmer = [];
  for (const [x, y] of chasmCells) {
    const s = BABYLON.MeshBuilder.CreateGround('sh', { width: C, height: C }, scene);
    s.position.set(wx(x) + C / 2, 0.02, wz(y) - C / 2);
    const smm = matCache.shimmer || (matCache.shimmer = (() => {
      const m = new BABYLON.StandardMaterial('shm', scene);
      m.emissiveColor = BABYLON.Color3.FromHexString(PALETTE.cyan);
      m.alpha = 0.14; m.disableLighting = true; return m;
    })());
    s.material = smm; s.isVisible = false;
    shimmer.push(s);
  }

  // --- lights: curated mood set (the migration's whole point) ----------------
  const lights = [];
  function torch(mx, my, hex, range = 8, intensity = 0.8, flicker = true) {
    const l = new BABYLON.PointLight('L' + lights.length, new BABYLON.Vector3(wx(mx), 1.7, wz(my)), scene);
    l.diffuse = BABYLON.Color3.FromHexString(hex); l.range = range; l.intensity = intensity;
    lights.push({ l, base: intensity, flicker, phase: Math.random() * 9 });
    return l;
  }
  const ambient = new BABYLON.HemisphericLight('amb', new BABYLON.Vector3(0, 1, 0), scene);
  ambient.intensity = 0.10; ambient.groundColor = BABYLON.Color3.FromHexString(PALETTE.deepSteel);
  torch(2.5, 19.4, PALETTE.goldGlow);                       // Z1 brazier
  torch(2.5, 13.5, PALETTE.gold, 7, 0.55);                  // Z2 nest firepit
  torch(2.5, 9.0, PALETTE.mauve, 6, 0.4, false);            // Z2 warren gloom
  torch(6.5, 5.5, PALETTE.goldGlow, 8, 0.7);                // Z3 gallery brazier
  torch(8.5, 7.5, PALETTE.cyan, 6, 0.45, false);            // gallery pillar glow
  torch(19.5, 8.5, PALETTE.cyanDeep, 12, 0.9, false);       // chasm updraft glow
  torch(21.0, 10.0, PALETTE.mauve, 5, 0.35, false);         // hound den
  torch(11.0, 2.0, PALETTE.cyan, 13, 0.8, false);           // Z5 core heart
  torch(3.5, 1.5, PALETTE.goldGlow, 6, 0.5);                // Z5 cache
  torch(18.5, 1.5, PALETTE.gold, 6, 0.5);                   // the exit
  // Z1 collapse shaft + dust
  const shaftL = new BABYLON.SpotLight('shaft', new BABYLON.Vector3(wx(7), 5.4, wz(20) - C / 2),
    new BABYLON.Vector3(0, -1, 0), Math.PI / 4.5, 6, scene);
  shaftL.diffuse = BABYLON.Color3.FromHexString(PALETTE.boneLight); shaftL.intensity = 1.3;
  const dustCnv = document.createElement('canvas'); dustCnv.width = dustCnv.height = 8;
  const dctx = dustCnv.getContext('2d');
  dctx.fillStyle = '#D9CBB3'; dctx.beginPath(); dctx.arc(4, 4, 2, 0, Math.PI * 2); dctx.fill();
  const dust = new BABYLON.ParticleSystem('dust', 120, scene);
  dust.particleTexture = new BABYLON.Texture(dustCnv.toDataURL(), scene);
  dust.emitter = new BABYLON.Vector3(wx(7), 5.2, wz(20) - C / 2);
  dust.minEmitBox = new BABYLON.Vector3(-0.8, 0, -0.8); dust.maxEmitBox = new BABYLON.Vector3(0.8, 0, 0.8);
  dust.color1 = new BABYLON.Color4(0.85, 0.8, 0.7, 0.22); dust.color2 = new BABYLON.Color4(0.85, 0.8, 0.7, 0.05);
  dust.minSize = 0.015; dust.maxSize = 0.05; dust.minLifeTime = 4; dust.maxLifeTime = 9; dust.emitRate = 12;
  dust.direction1 = new BABYLON.Vector3(-0.02, -0.25, -0.02); dust.direction2 = new BABYLON.Vector3(0.02, -0.5, 0.02);
  dust.start();
  // chasm updraft motes
  const rise = new BABYLON.ParticleSystem('rise', 90, scene);
  rise.particleTexture = new BABYLON.Texture(dustCnv.toDataURL(), scene);
  rise.emitter = new BABYLON.Vector3(wx(19.5), -2.5, wz(8.5));
  rise.minEmitBox = new BABYLON.Vector3(-0.6, 0, -4 * C); rise.maxEmitBox = new BABYLON.Vector3(0.6, 0, 4 * C);
  rise.color1 = new BABYLON.Color4(0.31, 0.89, 0.76, 0.4); rise.color2 = new BABYLON.Color4(0.12, 0.43, 0.39, 0.08);
  rise.minSize = 0.02; rise.maxSize = 0.07; rise.minLifeTime = 3; rise.maxLifeTime = 7; rise.emitRate = 16;
  rise.direction1 = new BABYLON.Vector3(-0.04, 0.5, -0.04); rise.direction2 = new BABYLON.Vector3(0.04, 0.9, 0.04);
  rise.start();
  // creature-borne lights
  const houndGlow = new BABYLON.PointLight('hglow', BABYLON.Vector3.Zero(), scene);
  houndGlow.diffuse = BABYLON.Color3.FromHexString(PALETTE.cyan); houndGlow.range = 4; houndGlow.intensity = 0;
  const bossGlow = new BABYLON.PointLight('bglow', BABYLON.Vector3.Zero(), scene);
  bossGlow.diffuse = BABYLON.Color3.FromHexString(PALETTE.staticWhite); bossGlow.range = 7; bossGlow.intensity = 0;

  // --- camera: a pure output device — the GAME owns movement/collision -------
  const cam = new BABYLON.FreeCamera('cam', new BABYLON.Vector3(0, EYE, 0), scene);
  cam.minZ = 0.05; cam.fov = 1.0;
  cam.inputs.clear(); // no Babylon controls; state.player drives everything

  // --- creatures & pickups: directional billboards from the entity list ------
  const mgrCache = {};
  function managerFor(key, frames) {
    if (mgrCache[key]) return mgrCache[key];
    const a = assets[key];
    const stripC = document.createElement('canvas');
    stripC.width = a.w * frames; stripC.height = a.h;
    const c2 = stripC.getContext('2d');
    for (let i = 0; i < frames; i++) c2.drawImage(a.frames[i], i * a.w, 0);
    const mgr = new BABYLON.SpriteManager('mgr_' + key, stripC.toDataURL(), 24,
      { width: a.w, height: a.h }, scene, 0.01, BABYLON.Texture.NEAREST_SAMPLINGMODE);
    mgr.fogEnabled = true;
    mgrCache[key] = mgr;
    return mgr;
  }
  const spriteByUid = new Map();
  function cellForFrame(e, p, t) {
    const F = e.F || {}; const n = FRAME_N[e.creatureId] || 2;
    if (!e.alive) return { i: e.frame ?? (F.deathB ?? F.dead ?? n - 1), flip: false };
    if (e.frame != null) return { i: e.frame, flip: false };
    const bob = Math.floor(t / 400) % 2;
    const toView = Math.atan2(p.y - e.y, p.x - e.x);
    let rel = (e.heading ?? toView) - toView;
    while (rel > Math.PI) rel -= 2 * Math.PI;
    while (rel < -Math.PI) rel += 2 * Math.PI;
    const a = Math.abs(rel);
    if (a < Math.PI / 4 && F.front) return { i: F.front[bob], flip: false };
    if (a > (3 * Math.PI) / 4 && F.back) return { i: F.back[bob], flip: false };
    return { i: bob ? (F.idleB ?? 1) : (F.idleA ?? 0), flip: rel > 0 };
  }

  // --- the sword (from the lab, tuned) ----------------------------------------
  const swordPivot = new BABYLON.TransformNode('swp', scene);
  swordPivot.parent = cam;
  swordPivot.position = new BABYLON.Vector3(0.34, -0.38, 0.72);
  swordPivot.scaling = new BABYLON.Vector3(0.45, 0.45, 0.45);
  const bladeMat = new BABYLON.StandardMaterial('blm', scene);
  bladeMat.diffuseColor = BABYLON.Color3.FromHexString(PALETTE.boneLight);
  bladeMat.emissiveColor = BABYLON.Color3.FromHexString(PALETTE.boneLight).scale(0.25);
  bladeMat.specularColor = new BABYLON.Color3(0.4, 0.4, 0.45);
  const blade = BABYLON.MeshBuilder.CreateBox('blade', { width: 0.045, height: 0.62, depth: 0.014 }, scene);
  blade.parent = swordPivot; blade.position.y = 0.4; blade.material = bladeMat;
  const guardMat = new BABYLON.StandardMaterial('gdm', scene);
  guardMat.emissiveColor = BABYLON.Color3.FromHexString(PALETTE.gold).scale(0.7);
  const guard = BABYLON.MeshBuilder.CreateBox('guard', { width: 0.2, height: 0.035, depth: 0.045 }, scene);
  guard.parent = swordPivot; guard.position.y = 0.07; guard.material = guardMat;
  const gripMat = new BABYLON.StandardMaterial('grm', scene);
  gripMat.diffuseColor = BABYLON.Color3.FromHexString(PALETTE.rustDeep);
  const grip = BABYLON.MeshBuilder.CreateBox('grip', { width: 0.05, height: 0.2, depth: 0.05 }, scene);
  grip.parent = swordPivot; grip.position.y = -0.05; grip.material = gripMat;

  // --- per-frame mirror of GameState ------------------------------------------
  let pitch = 0;
  function sync(input, dt) {
    const p = state.player;
    const t = state.t;

    // camera from the game's player (the game already did movement+collision)
    pitch = Math.max(-1.15, Math.min(1.15, pitch + input.consumePitch() * 0.0022));
    cam.position.set(wx(p.x), EYE, wz(p.y));
    cam.rotation.y = Math.atan2(Math.cos(p.angle), -Math.sin(p.angle));
    cam.rotation.x = pitch;
    cam.rotation.z = t < state.fx.shakeUntil ? (Math.random() - 0.5) * 0.03 : cam.rotation.z * 0.8;

    // doors slide; the glyph-locked door follows the puzzle
    for (const d of doorMeshes) {
      const s = doorSlide(state, d.x, d.y);
      if (d.axis === 'x') d.mesh.position.x = d.baseX + s * C * 0.96;
      else d.mesh.position.z = d.baseZ + s * C * 0.96;
    }
    // secrets & phased walls vanish once opened
    for (const [k, mesh] of secretMeshes) {
      if (state.secretsFound.has(k) || state.phasedCells.has(k)) mesh.setEnabled(false);
    }
    for (const k of state.phasedCells) {
      // phased plain walls (C5 on a normal wall) — hide any box at that cell
      // (secretMeshes covers S cells; plain walls are rare, scan lazily)
    }
    // glyph pillars show their current rotation (gold once solved)
    for (const pm of pillarMeshes) {
      const frame = state.glyph.solved ? 3 : (state.glyph.rotation[pm.idx] ?? 0) % 4;
      if (frame !== pm.lastFrame) { pm.mesh.material = matFor('pillar_glyph', { frame, pillar: pm.idx }); pm.lastFrame = frame; }
    }
    // Gravity Nullifier shimmer
    if (shimmer.length && shimmer[0].isVisible !== !!p.crossing) for (const s of shimmer) s.isVisible = !!p.crossing;

    // flickering lights
    for (const L of lights) {
      if (L.flicker) L.l.intensity = L.base * (1 + 0.3 * Math.sin(t / 90 + L.phase) * Math.sin(t / 41 + L.phase * 2));
      else L.l.intensity = L.base * (1 + 0.18 * Math.sin(t / 900 + L.phase));
    }

    // entities → billboards
    let houndLit = false, bossLit = false;
    for (const e of state.entities) {
      let s = spriteByUid.get(e.uid);
      if (e.hidden || e.taken) { if (s) s.isVisible = false; continue; }
      if (!s) {
        const frames = e.kind === 'creature' ? (FRAME_N[e.creatureId] || 2) : assets[e.sprite].frames.length;
        s = new BABYLON.Sprite('e' + e.uid, managerFor(e.sprite, frames));
        spriteByUid.set(e.uid, s);
      }
      s.isVisible = true;
      if (e.kind === 'creature') {
        const h = SIZE[e.creatureId] || 1.4;
        s.width = h; s.height = h;
        s.position = new BABYLON.Vector3(wx(e.x), e.alive ? h / 2 : h * 0.28, wz(e.y));
        const { i, flip } = cellForFrame(e, p, t);
        s.cellIndex = i; s.invertU = flip;
        const hitPose = e.frameUntil && e.frame === (e.F?.hit ?? -1);
        s.color = hitPose ? new BABYLON.Color4(1, 0.35, 0.35, 1) : new BABYLON.Color4(1, 1, 1, 1);
        if (e.creatureId === 'hound' && e.alive) { houndGlow.position.set(wx(e.x), 0.9, wz(e.y)); houndLit = true; }
        if (e.creatureId === 'abykos' && e.alive) {
          bossGlow.position.set(wx(e.x), 1.6, wz(e.y)); bossLit = true;
          bossGlow.intensity = (e.frame === e.F?.drain) ? 1.1 : 0.5 + 0.15 * Math.sin(t / 600);
        }
      } else {
        s.width = 0.55; s.height = 0.55;
        s.position = new BABYLON.Vector3(wx(e.x), 0.32 + Math.sin(t / 500 + e.uid) * 0.05, wz(e.y));
        s.cellIndex = Math.floor(t / 300) % (assets[e.sprite].frames.length);
      }
    }
    houndGlow.intensity = houndLit ? 0.5 : 0;
    if (!bossLit) bossGlow.intensity = 0;

    // sword animation from the real swing state
    const swing = Math.min(1, (t - (p.swingT0 || -9999)) / 260);
    const charging = input.swingCharging > 0;
    if (swing < 1) {
      const s2 = swing;
      swordPivot.rotation.set(-1.0 + s2 * 1.9, 0.6 - s2 * 1.4, 0.9 - s2 * 1.1);
      swordPivot.position.z = 0.72 + Math.sin(s2 * Math.PI) * 0.2;
      swordPivot.position.x = 0.34 - Math.sin(s2 * Math.PI) * 0.16;
    } else if (charging) {
      swordPivot.rotation.set(-0.95 + Math.sin(t / 90) * 0.02, 0.7, 1.0);
      swordPivot.position.z = 0.66; swordPivot.position.x = 0.4;
    } else {
      swordPivot.rotation.set(-0.55 + Math.sin(t / 700) * 0.03, 0.3, 0.55);
      swordPivot.position.z = 0.72; swordPivot.position.x = 0.34;
      swordPivot.position.y = -0.38 + Math.sin(t / 650) * 0.008;
    }
  }

  /** Project a map-space point to screen px (for UI-canvas popups/bars). */
  function project(mxp, myp, height) {
    const v = BABYLON.Vector3.Project(new BABYLON.Vector3(wx(mxp), height, wz(myp)),
      BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
      cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    return {
      x: v.x / engine.getRenderWidth(),   // 0..1 across the screen
      y: v.y / engine.getRenderHeight(),
      visible: v.z > 0 && v.z < 1,
    };
  }

  let pixelLevel = 2;
  function cyclePixel() { pixelLevel = pixelLevel >= 3 ? 1 : pixelLevel + 1; engine.setHardwareScalingLevel(pixelLevel); }

  return { engine, scene, cam, sync, project, cyclePixel };
}
