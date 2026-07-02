# NINTH DELVE — a Numenera fan prototype
**One dungeon. First person. Turn-based Cypher dice. Early-Elder-Scrolls soul.**

A browser-native, zero-dependency first-person dungeon crawler in the spirit of
*The Elder Scrolls: Arena* (1994), running the **Cypher System** as written in
**Numenera Discovery** — d20, difficulty × 3, pools, Edge, Effort, GM intrusions,
and "Discovery is the soul of Numenera."

Slice scope: **one pregen character, one dungeon (The Whisperlock), 20–40 minutes.**

## Tech in one line
Pure JavaScript + Canvas 2D raycaster (Wolfenstein/Arena-style), vanilla ES modules,
no build step, no libraries. Open `index.html` or deploy to GitHub Pages. Done.

## The document suite (read in this order)
| # | File | What it is |
|---|------|------------|
| 1 | `docs/00_GDD.md` | Vision, pillars, core loop, scope fence |
| 2 | `docs/01_RULES_ADAPTATION.md` | Cypher System → videogame spec + full pregen sheet |
| 3 | `docs/02_TECH_ARCHITECTURE.md` | Raycaster engine, modules, data schemas, state machine |
| 4 | `docs/03_DUNGEON_WHISPERLOCK.md` | The level: map, zones, encounters, puzzle, boss, loot |
| 5 | `docs/04_ASSET_SPEC.md` | Every texture/sprite/sound, sizes, palette, AI-gen prompts |
| 6 | `docs/05_BUILD_PLAN.md` | Milestones M0–M7 with acceptance criteria (the contract) |
| 7 | `CLAUDE.md` | Standing orders for Claude Code sessions |

## Quickstart
1. Create a GitHub repo, drop this folder in, commit.
2. Open the repo in Claude Code.
3. Say: *"Read CLAUDE.md, then execute Milestone M0 from docs/05_BUILD_PLAN.md."*
4. After each milestone: playtest, update `HANDOVER.md`, commit, next milestone.

## Source of truth
Rules mechanics reference **Numenera Discovery (Monte Cook Games, 2018)** by page
number so you can verify at the table copy. Where this adaptation deliberately
deviates for single-player digital play, it says **[ADAPTED]**. Where a number
should be double-checked against the book before final balancing, it says
**[VERIFY p.X]**.

## IP posture (important, short)
- Game **mechanics** are not copyrightable; implementing d20/difficulty/pool math is fine.
- MCG's **Cypher System Open License + CSRD** exist for tabletop-style reuse of rules text.
- The **Numenera setting** (Ninth World, creature names, trademarks) remains MCG's IP.
- Therefore: this project is a **private fan prototype**. Keep the repo private.
  Before any public release: either reskin all setting names/creatures to originals,
  or contact Monte Cook Games about licensing. All flavor text in these docs is
  original writing; no book text is reproduced.

## Credits
Fan project for personal use. Numenera and the Cypher System are © Monte Cook Games, LLC.
