# 04 — ASSET SPECIFICATION
Every asset is optional: `texgen.js` draws a procedural placeholder for anything
missing from `/assets`. Ship art by dropping correctly-named PNGs — no code changes.

## 1. Palette — "Buried Aeon" (16 colors, use exclusively)
| Role | Hex | | Role | Hex |
|---|---|---|---|---|
| void (fog target) | `#0A0A12` | | bone light | `#D9CBB3` |
| deep steel | `#1C222B` | | bone shadow | `#9A8C74` |
| steel | `#2E3A45` | | numenera gold | `#C9A227` |
| steel light | `#4A5A66` | | gold glow | `#F2D06B` |
| rust | `#8C4A2F` | | glow cyan | `#4FE3C1` |
| rust deep | `#5A2E1E` | | cyan deep | `#1E6E63` |
| blood | `#7A1F2B` | | murden mauve | `#6B4E71` |
| moss | `#4F6B3A` | | static white | `#E8ECEF` |
Rule of restraint: gold + cyan are *accents only* — the numenera glows, the
architecture does not. (Same discipline as the navy/gold print system: accents,
never dominant blocks.)

## 2. Wall textures — 64×64 PNG, `assets/textures/`
| File | Desc | Fallback recipe | AI prompt seed |
|---|---|---|---|
| `wall_synth.png` | Default synth-stone panel | steel base, darker 8px seams, rust speckle noise | "seamless 64x64 pixel art texture, ancient dark synth-stone wall panels, rust streaks, sci-fantasy dungeon, muted palette" |
| `wall_conduit.png` | Z5/Z4 conduit wall | synth base + 6px vertical cyan-deep conduit, 2px cyan glow dashes | "…wall with a single dead energy conduit, faint cyan glow" |
| `wall_warren.png` | Z2 murden filth | synth base + moss/mauve smears, bone flecks | "…overgrown filthy stone, moss and feathers" |
| `wall_scuffed.png` | Secret-tell variant | synth + bone-light scratch marks lower third | "…scratched and scuffed wall, claw marks" |
| `wall_mural.png` | Z2 clue mural | synth + 3 gold glyphs in sequence | "…wall mural of three glowing gold glyphs" |
| `door_slide.png` | Door | steel-light panel, horizontal seams, gold hazard edge | "…heavy sliding metal door" |
| `door_glyph.png` | Locked door | door + 3 cyan glyph sockets | "…sealed door with three glyph locks" |
| `pillar_glyph.png` | Glyph pillar (wall-cell) | deep-steel column, one large glyph, cyan when active / gold when correct | 4 glyph frames in a strip `pillar_glyphs_strip.png` (256×64) |

## 3. Sprites — 64×64 PNG strips, `assets/sprites/` (frames left→right)
| File | Frames | Desc |
|---|---|---|
| `laak.png` | idle×2, lunge, hit, dead | palm-sized six-legged lizard, moss/rust |
| `hound.png` | idle×2, phase (50% alpha static-white), lunge, hit, dead | wrong-jointed dog, seams of cyan light |
| `murden.png` | idle×2, throw, snatch, hit, dead | hunched raven-headed abhuman, mauve rags |
| `abykos.png` | **64×96**; idle×2, drain (gold particles inward), touch, hit (static burst), death×2 | translucent humanoid static |
| `pickup_cypher.png` | glint×2 | small gold-glow bundle |
| `pickup_oddity.png` | 1 | cyan-glow trinket |
| `pickup_shins.png` | 1 | coin scatter |
| `artifact_key.png` | glow×2 | the Whisperlock Key: tuning-fork crown, gold+cyan |
Fallbacks: colored silhouette + 2px outline + bobbing glint; phase frames at 50%
alpha. Good enough to playtest everything.

## 4. UI — `assets/ui/`
`d20_strip.png` (12 tumble frames, 32×32) · `chip_ease.png`/`chip_hinder.png`
(9-slice, cyan/rust) · `portrait_kave.png` 48×48 (3 states: hale/impaired/
debilitated — Arena face-bar homage) · `hud_frame.png` 9-slice deep-steel with
single gold pinstripe. Fallbacks: canvas-drawn shapes + text.

## 5. Audio cue list (all procedural in `audio.js`, no files)
step (noise burst, lowpass, cadence-linked) · door (slide: filtered saw sweep) ·
dice (3–5 short noise clicks, random pitch) · hit (80→40 Hz sine drop) ·
player-hurt (same + noise) · cypher-use (cyan = rising FM chime) · drain (falling
gold = descending chime) · whisper (band-passed noise, slow LFO, gates with text) ·
zone drones (60 Hz base, detune per zone: Z1 +0, Z2 +3, Z3 +7, Z4 +5, Z5 +10 cents)
· glyph-correct (3-tone motif — THE motif; O2's hum is the same notes).

## 6. Conventions
Palette-locked PNGs, no alpha gradients (1-bit alpha) · strip sheets, frame size
= file height · names are load keys: `texgen` fallback registry must mirror this
doc's file list exactly · target on-disk art total < 300 KB.
