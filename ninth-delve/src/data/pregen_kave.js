// Kave the Unbroken — Tough Glaive who Masters Weaponry (Rules §7).
// "Base 11/10/7 + 6 allocated 3/2/1." All numbers verified vs the extract;
// [VERIFY] items may be tuned at the M7 balance lock.

export const KAVE = {
  name: 'Kave the Unbroken',
  archetype: 'Tough Glaive who Masters Weaponry',
  pools: { might: 14, speed: 12, intellect: 8 },
  edge: { might: 1, speed: 1, intellect: 0 },
  tier: 1,
  effort: 1,               // max Effort levels per action
  cypherLimit: 2,
  armor: 3,                // medium 2 + Tough Resilient 1
  speedSurcharge: 1,       // medium +2 − Trained in Armor 1, per Speed Effort level
  startShins: 5,
  recovery: { dice: 1, sides: 6, bonus: 2 }, // 1d6 + tier(1) + Healthy(1)
  // Four daily rests, escalating (Rules §5). 10-hour unavailable in-slice.
  restSequence: ['1 action', '10 minutes', '1 hour', '(10 hours — unavailable)'],

  /** Weapons (Rules §7). `ease` = attack eased steps; damage already includes bonuses. */
  weapons: {
    broadsword: { name: 'broadsword', damage: 6, kind: 'medium', ease: 0, range: 'immediate' },
    dagger: { name: 'dagger', damage: 3, kind: 'light', ease: 1, range: 'immediate', thrownRange: 'short' },
    unarmed: { name: 'fists', damage: 2, kind: 'light', ease: 0, range: 'immediate' },
  },

  skills: {
    mightDefense: 'trained',   // Tough
    climbing: 'trained',       // Physical Skills pick
    swordCrafting: 'trained',
  },
  // Inability (hindered): understanding numenera → Examine cypher, glyph intuit.
  inability: ['understanding-numenera'],

  fightingMoves: {
    // asset on melee attacks; Speed defense hindered while active (a toggle stance)
    aggression: { name: 'Aggression', cost: { might: 2 }, kind: 'stance' },
    // move Short as part of an action; +1 Effort → Long move + hindered attack
    fleetOfFoot: { name: 'Fleet of Foot', cost: { speed: 1 }, kind: 'move' },
  },

  startOddity: 'O_clay',   // blob of self-reshaping clay (flavor)
};
