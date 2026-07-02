# 01 — CYPHER SYSTEM → VIDEOGAME ADAPTATION
All page refs = **Numenera Discovery (2018)**. **[ADAPTED]** = deliberate change
for single-player digital play. **[VERIFY p.X]** = confirm number vs book before
balance lock.

## 1. Task resolution (the whole engine)
- Every task has a **difficulty 0–10**; target number = **difficulty × 3** (p.15, table p.15).
- Player rolls **d20 ≥ target** to succeed. Difficulty 0 = auto-success, no roll (p.16).
- Three things **ease** difficulty by steps (p.15): **skills** (trained −1,
  specialized −2, max −2 from skill), **assets** (max −2 total), **Effort**.
- Circumstances can **hinder** (+1 step each).
- `finalDifficulty = base − skillSteps − assetSteps − effortLevels + hinderSteps`,
  clamped 0–10. If 0 → auto-success.

### Dice tray UI requirement (pillar #1)
Every roll renders: base difficulty & why → each modifier as a chip (±1 step each,
labeled) → final target number → animated d20 → result banner. The player must be
able to *read the math* on every single roll. No hidden rolls exist in this game.

## 2. Pools, Edge, Effort (p.22–25, p.102)
- Three stats, each a **Pool** (spendable) + **Edge** (discount): Might, Speed, Intellect.
- **Effort:** first level costs **3** points from the relevant Pool, each additional
  level **+2** (so 3/5/7…). Subtract **Edge once per action** from the total cost
  (p.24 worked example: Effort 2 with Edge 1 = 3+2−1 = 4). Max levels = Effort stat.
- Effort on an **attack roll** eases the attack; Effort on **damage** adds
  **+3 damage per level** (melee/ranged smash — p.103 area) **[VERIFY p.103]**.
- Ability costs (e.g., "2 Might points") also get Edge discount — but Edge applies
  **once per action total** (p.26).
- **Armor surcharge:** wearing armor raises the cost of each level of *Speed*
  Effort by its penalty (leather +1, medium +2, heavy +3 — p.95 table
  **[VERIFY p.95]**). Glaive's *Trained in Armor* reduces the surcharge by 1 (p.31).

## 3. Combat structure — turn-based encounter mode
**[ADAPTED]** Exploration is real-time; combat freezes into rounds. Cypher combat
is already turn-based at the table, so rules apply almost verbatim.

### 3.1 Initiative (p.107)
One **Speed roll** at encounter start vs (highest enemy level × 3). Success = the
player acts **before** all enemies every round; failure = enemies first. Re-rolled
only if a new, higher-level enemy joins.

### 3.2 Range bands [ADAPTED spatial model]
On encounter start, each combatant's true map distance snaps to a Cypher band
(p.106, p.845-area): **Immediate** ≤ 3 m, **Short** ≤ 15 m, **Long** ≤ 30 m.
Tiles are 1.5 m ⇒ Immediate ≤ 2 tiles, Short ≤ 10, Long ≤ 20.
- Move **Immediate as part of another action**; move **Short as your whole action**;
  **Long as whole action + Speed roll** or you stumble (p.107 area).
- Melee requires Immediate. Thrown dagger = Short.

### 3.3 Player turn — action menu
| Action | Rules |
|---|---|
| **Attack** (weapon) | Roll vs enemy level ×3. Damage = weapon ± mods − enemy Armor. |
| **Fighting move** | Aggression / Fleet of Foot (see sheet §7). Pool cost − Edge. |
| **Use cypher** | One action. Unidentified = effect revealed on use. |
| **Examine cypher** | Intellect task, difficulty = cypher level, **hindered** (Glaive inability, p.31). Success reveals effect + level. |
| **Move band** | Per 3.2. |
| **Catch Breath** | Your **first recovery roll of the day usable as one combat action** (p.111–112). |
| **Defend** [ADAPTED] | Forgo acting; your Speed defense rolls are **eased** until next turn. |
| **Flee** | Speed roll vs highest enemy level ×3; success exits to EXPLORE with enemies pursuing cooldown. |

### 3.4 Enemy turn = your defense rolls (p.16, p.100)
For each enemy attack, the **player rolls Speed defense** vs (enemy level × 3).
Shield = asset (−1 step). Success = miss. Failure = take damage − Armor.
Special enemy attacks may call Might or Intellect defense instead (per creature).

### 3.5 Special rolls (p.104–105, confirmed in text)
| Natural roll | Effect |
|---|---|
| **1** | GM intrusion fires (no XP for nat-1 intrusions, p.123 **[VERIFY]**). |
| **17** | +1 damage (combat only). |
| **18** | +2 damage (combat only). |
| **19** | Success ⇒ **minor effect**: +3 damage OR pick (knockback, distract…). |
| **20** | Success ⇒ **major effect**: +4 damage OR pick (knockdown, stun, extra action). Pool cost of the action refunded **[VERIFY p.105]**. |
On **defense** rolls: 19/20 grant minor/major in your favor (e.g., enemy hinders
itself); 1 means the enemy gets an intrusion-grade break. UI offers 2–3 canned
choices per context.

## 4. Damage, Armor, the damage track (p.109–110, confirmed)
- Damage hits **Might Pool** first unless typed otherwise; Armor subtracts per hit.
- Pool at 0 ⇒ overflow to next (Might→Speed→Intellect) **and** drop one step on
  the **damage track**: **Hale → Impaired → Debilitated → Dead** (p.110).
- **Impaired:** each level of Effort costs **+1**; special rolls give only +1 dmg
  (no minor/major) (p.110 confirmed).
- **Debilitated:** can only move (crawl immediate / stagger); no other actions.
- Restoring a Pool from 0 to 1+ moves you **up** one step (p.112 confirmed).

## 5. Recovery rolls (p.111–112, confirmed)
Roll **1d6 + tier** points, distribute among Pools. Four rests per 28-hour Ninth
World day, escalating: **1 action → 10 minutes → 1 hour → 10 hours**.
**[ADAPTED]** In-dungeon: 1-action rest = Catch Breath; 10-min/1-hr rests only in
cleared zones and roll once on the zone intrusion table (rest is never free).
10-hour rest not available inside the slice.

## 6. XP economy (p.123, p.128, confirmed in text)
**Earn (discovery only, pillar #2):** first entry per zone +1 (×5) · secret +2 (×2)
· glyph puzzle +2 · oddity +1 (×2) · the Whisperlock Key artifact +3 · true clear +2.
Theoretical max ≈ 16.
**Scripted intrusions:** accept = **+2 XP**; refuse = **−1 XP** (can't refuse at 0).
[ADAPTED: book's "give 1 XP to another player" (p.876-area, confirmed) has no
target in single-player; full 2 XP kept, tuned by pricier rerolls if needed.]
**Spend:** **1 XP = reroll any roll, take better** (p.128 confirmed). End screen
shows advancement math: 4 XP per benefit, 4 benefits = Tier 2 (p.128).

## 7. PREGEN SHEET — "KAVE THE UNBROKEN"
*"I am a **Tough Glaive** who **Masters Weaponry**."* (Type p.28–35, Descriptor
p.53+, Focus p.58+ — all verified in extract.)

| Stat | Pool | Edge |
|---|---|---|
| Might | **14** | 1 |
| Speed | **12** | 1 |
| Intellect | **8** | 0 |
(Base 11/10/7 + 6 allocated 3/2/1 — p.30, p.406 walkthrough confirms bases.)

- **Tier 1 · Effort 1 · Cypher limit 2** (p.31)
- **Armor 3** = medium armor 2 + Tough *Resilient* +1 (p.3106-area confirmed).
  Speed-Effort surcharge: medium +2 − Trained in Armor 1 = **+1 per Effort level**.
- **Damage:** Broadsword (medium) 4 + Combat Prowess (melee) 1 + Weapon Master 1
  = **6**. Dagger (light) 2 + 1 = **3**, and light weapons **ease the attack one
  step** (p.96). Thrown dagger = Short range. Unarmed 1+1 = 2.
- **Skills:** trained Might defense (Tough) · trained climbing (Physical Skills
  pick) · trained sword-crafting (Weapon Crafter, p.4513-area). **Inability:**
  crafting/salvaging/**understanding numenera** — hindered (p.31 confirmed).
- **Fighting moves (2, p.31–32 confirmed):**
  - **Aggression (2 Might):** asset on melee attacks; Speed defense vs
    melee/ranged **hindered**; lasts while combat is in range. Toggle stance.
  - **Fleet of Foot (1+ Speed):** move Short as part of another action; Long as
    full action; +1 Effort ⇒ Long move **and** a hindered attack.
- **Recovery:** 1d6 + 1 (tier) + 1 (Tough *Healthy*) = **1d6+2**.
- **Gear:** broadsword · shield (asset on Speed defense) · dagger (Tough extra
  light weapon) · medium armor · explorer's pack · **5 shins** · oddity: blob of
  clay that reshapes itself when unobserved (book default, p.31) · **cyphers
  (book defaults, p.31): density nodule (p.277), rejuvenator (p.286)** — in-game
  effects in Dungeon doc §Loot; tune to book pages at balance lock.

## 8. Creature stat contract
Every creature = `{ level, targetNumber: level×3, health (default level×3),
damage (default level), armor, moveBand, special[], intrusionTable[] }` —
matching the listing format on p.221–223 (confirmed: target number usually =
health; damage = level unless stated). Specific rosters live in the Dungeon doc.

## 9. Cypher rules (p.272+)
- Limit 2 (Kave). Carrying **over limit** invites danger (p.273): **[ADAPTED]**
  while over limit, GM intrusions fire on natural **1–2** instead of 1.
- Cyphers are found **unidentified**: name shows as sensory description ("a warm
  glass bead threaded with gold wire"). Identify via Examine (§3.3) or use blind.
- All are one-use; using or examining is one action.
