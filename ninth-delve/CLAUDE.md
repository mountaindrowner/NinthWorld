# CLAUDE.md — Standing Orders (Ninth Delve)

## What this project is
Browser first-person dungeon crawler: Arena-'94 raycaster exploration + turn-based
**Cypher System (Numenera Discovery)** combat with fully visible dice math.
One dungeon (The Whisperlock), one pregen (Kave), 20–40 min. Private fan prototype.

## Read order (once per fresh session)
1. `HANDOVER.md` — where the last session stopped
2. `docs/05_BUILD_PLAN.md` — find the current milestone; that is your ONLY scope
3. The docs that milestone cites (Rules / Tech / Dungeon / Asset as needed)

## Prime directives
1. **The docs are the contract.** Implement what they say. If a doc is wrong or
   ambiguous, flag it in `HANDOVER.md` under "Doc issues" and propose — don't
   silently invent.
2. **Placement table beats ASCII map.** Geometry may flex to pass the
   connectivity test; placements and zone assignments may not.
3. **Every roll is visible.** If any resolution path skips the dice tray's audit
   trail, it's a bug (GDD pillar #1).
4. **Rules numbers are verified against the book.** Anything marked
   **[VERIFY p.X]** may be tuned; everything else changes only with a flagged
   note in HANDOVER.
5. **Zero dependencies.** No npm installs, frameworks, bundlers, or CDN scripts.
   Vanilla ES modules only. If you're about to `npm install`, stop.
6. **No book text.** Mechanics yes, verbatim Numenera prose no. All flavor
   writing is original (grieving-archivist whisper voice).

## Code standards
ES modules, small files matching Tech doc §2 layout · `dice.js` stays pure +
seedable · constants live in `src/data/`, no magic numbers in logic · JSDoc
typedefs for `GameState`, `Action`, `Creature`, `Cypher` · guard clauses over
nesting · comments explain *why*, not *what* · no localStorage/sessionStorage
anywhere in the slice.

## Run & test
`python3 -m http.server 8000` → `http://localhost:8000` · connectivity test and
dice math tables run from `?test=1` query flag and log pass/fail to console ·
seed RNG with `?seed=N` for reproducible encounters.

## Definition of done (per milestone)
All acceptance boxes in `05_BUILD_PLAN.md` checked in the commit · `?test=1`
green · manual playtest note in HANDOVER · commit message: `M<n>: <summary>`.

## HANDOVER.md entry template
```
## <date> — M<n> <status: complete|partial>
Done: …
Deviations/Doc issues: …
Playtest notes: …
Next: exact first task of the next session
```

## Do not
Refactor outside milestone scope · add features from the Stretch list · optimize
before M7 unless fps < 55 · change the palette · touch `docs/` except to check
acceptance boxes (append, never rewrite history).
