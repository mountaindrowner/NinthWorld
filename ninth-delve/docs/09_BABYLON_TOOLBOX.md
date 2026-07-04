# 09 — Babylon Toolbox Brief (2026-07-04)

For all sessions (mother/design + research + build). What the Babylon.js
ecosystem gives us for free, what we can actually pull into this project's
constraints, and what's already wired in. Latest date wins.

## Our constraints (why this list is filtered)
- **No build step, vanilla ES modules.** We vendor single-file UMD bundles
  into `vendor/` and load them with `<script>` tags. Anything requiring a
  bundler/npm-install-at-runtime is out.
- **Network:** CDNs are proxy-blocked in the build environment, but
  **registry.npmjs.org works** — `npm pack <pkg>` then extract. That is our
  supply line. Website zip downloads (Kenney/Quaternius/Sketchfab) are
  currently unreachable from the build session; Mark could download & upload
  those by hand if we want real 3D models.
- **Phone-first perf:** Mark plays on a phone (~30fps before adaptive res).
  Anything heavy must sit behind `setFxEnabled` / autoPerf.

## Already vendored & wired (as of 2026-07-04)
| File | What | Status |
|---|---|---|
| `vendor/babylon.js` (6.8MB) | Babylon core 7.54.3 UMD | in use |
| `vendor/babylon.lavaMaterial.min.js` (18KB) | animated lava shader | **in use — chasm coolant bed is alive** (cyan-recolored) |
| `vendor/babylon.fireProceduralTexture.min.js` | animated fire noise, recolorable | **in use** (feeds the lava) |
| `vendor/babylon.fireMaterial.min.js` (13KB) | animated flame material | vendored, unused — torch upgrade candidate |
| `vendor/babylon.perlinNoiseProceduralTexture.min.js` | tileable noise | vendored, unused |
| `vendor/babylon.glTF2FileLoader.min.js` (224KB) | load .glb/.gltf models | vendored, unused — ready for real assets |

Also enabled from **core** (no extra files needed):
- **GlowLayer** — everything emissive (chasm bed, glyph gold, boss) blooms.
- **DefaultRenderingPipeline** — vignette + animated film grain (FXAA off,
  pixels stay chunky). Both switch off automatically when autoPerf coarsens
  past level 3.

## Available next, one `npm pack` away (all 7.54.3, per-feature minis)
- **babylonjs-materials**: water (reflective, rippling — cistern room in
  dungeon #2?), sky, fur, cell (toon), triPlanar (texture caves without UVs),
  grid, gradient, normal, mix, terrain, shadowOnly, custom.
- **babylonjs-procedural-textures**: brick, marble, wood, cloud, grass,
  starfield (skybox for a surface reveal?), road, normal-map.
- **babylonjs-loaders**: glTF 1/2, OBJ, STL. glTF2 already vendored.
- **babylonjs-post-process**: extra post FX pack (we mostly don't need it —
  core pipeline covers vignette/grain/DOF/bloom/sharpen/chromatic aberration).
- **babylonjs-gui**: canvas-space UI system — SKIP; our own 384×216 UI layer
  is better for the retro look and already built.

## Core features we haven't used yet (free, no vendor)
- **VolumetricLightScatteringPostProcess** — god rays from the light shafts.
- **SSAO2** — contact shadows in corners (WebGL2; needs perf check on phone).
- **Animation system + skeletons** — matters once we load glTF creatures.
- **SolidParticleSystem** — debris, bones, scattered shins as real meshes.
- **NodeMaterial** — shader graphs authored in the online Node Material
  Editor (nme.babylonjs.com), exported as JSON, loadable at runtime. Big
  door for custom weirdness (numenera walls that breathe).
- **Sound** — Babylon has spatial audio; we already have our own audio.js.

## Real 3D assets (models) — the paths
1. **Procedural forever** (current): everything is generated. Fable-native,
   zero deps, matches the retro look. Creatures stay billboards.
2. **glTF drip-feed**: Mark hand-downloads CC0 packs (Kenney dungeon kit,
   Quaternius, poly.pizza) and uploads them; we load via the vendored glTF2
   loader. Best quality-for-effort if we want real props (chests, pillars,
   grates). License: CC0 only, keep a `vendor/ASSETS_LICENSES.md`.
3. **Full authored look**: NodeMaterial + glTF + baked lighting. Post-slice.

## Tools (browser, for humans — Mark can play with these)
- **Playground** (playground.babylonjs.com) — live-code scenes, shareable.
- **Sandbox** (sandbox.babylonjs.com) — drag a .glb in, inspect it.
- **Node Material Editor** (nme.babylonjs.com) — visual shader authoring.
- **Inspector** — `scene.debugLayer.show()`; we can add a `?debug=1` flag
  locally (needs the babylonjs-inspector package vendored — it's large).

## Recommendation queue (build order when Mark wants more)
1. FireMaterial on torch flames (vendored already, ~30 min).
2. God rays on the two light shafts (core, perf-gate it).
3. Water material cistern room in dungeon #2 (design hook for mother session).
4. glTF props pass once Mark uploads a CC0 kit.
