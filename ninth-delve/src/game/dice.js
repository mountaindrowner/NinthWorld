// dice.js — pure, seedable task resolution (Rules §1, §3.5). No side effects:
// the RNG is injected so encounters replay identically under ?seed=N. Effort
// COSTS live in player.js; here Effort only eases difficulty. Every resolveTask
// returns the full audit trail the dice tray renders (pillar #1).

/** Seedable PRNG (mulberry32). @param {number} seed @returns {()=>number} */
export function makeRNG(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Roll a d20 (1–20) from an injected RNG. */
export const rollD20 = (rng) => 1 + Math.floor(rng() * 20);

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/**
 * Special-roll effects (Rules §3.5). Impaired reduces every special to +1 dmg
 * with no minor/major (Rules §4).
 * @returns {{tier:'1'|'17'|'18'|'19'|'20'|null, bonusDamage:number, effect:'intrusion'|'minor'|'major'|null, refund:boolean}}
 */
export function specialOf(natural, impaired = false) {
  if (natural === 1) return { tier: '1', bonusDamage: 0, effect: 'intrusion', refund: false };
  if (natural < 17) return { tier: null, bonusDamage: 0, effect: null, refund: false };
  if (impaired) return { tier: String(natural), bonusDamage: 1, effect: null, refund: false };
  if (natural === 17) return { tier: '17', bonusDamage: 1, effect: null, refund: false };
  if (natural === 18) return { tier: '18', bonusDamage: 2, effect: null, refund: false };
  if (natural === 19) return { tier: '19', bonusDamage: 3, effect: 'minor', refund: false };
  return { tier: '20', bonusDamage: 4, effect: 'major', refund: true };
}

/**
 * Resolve one task. Difficulty eases/hinders by steps; target = difficulty×3;
 * success = raw d20 ≥ target (eases lower the target, they never add to the die).
 *
 * @param {Object} spec
 * @param {number} spec.base                 base difficulty 0–10
 * @param {{label:string,steps:number}[]} [spec.eases]   skill/asset/stance eases (steps>0)
 * @param {number} [spec.effortLevels]       Effort levels applied (each eases 1)
 * @param {{label:string,steps:number}[]} [spec.hinders] hindrances (steps>0)
 * @param {()=>number} spec.rng
 * @param {boolean} [spec.impaired]
 * @param {number} [spec.forcedNatural]      test hook: force the die
 * @returns {Object} audit trail for the tray
 */
export function resolveTask({ base, eases = [], effortLevels = 0, hinders = [], rng, impaired = false, forcedNatural }) {
  const easeSteps = eases.reduce((s, c) => s + c.steps, 0) + effortLevels;
  const hinderSteps = hinders.reduce((s, c) => s + c.steps, 0);
  const finalDifficulty = clamp(base - easeSteps + hinderSteps, 0, 10);
  const target = finalDifficulty * 3;

  // Build the ordered chip list the tray renders (base → eases → effort → hinders).
  const chips = [
    { label: `base diff ${base}`, kind: 'base', steps: 0 },
    ...eases.map((c) => ({ label: c.label, kind: 'ease', steps: -c.steps })),
    ...(effortLevels ? [{ label: `Effort ${effortLevels}`, kind: 'ease', steps: -effortLevels }] : []),
    ...hinders.map((c) => ({ label: c.label, kind: 'hinder', steps: +c.steps })),
  ];

  if (finalDifficulty === 0) {
    return { base, chips, finalDifficulty, target, auto: true, natural: null, success: true, special: specialOf(0), effortLevels };
  }

  const natural = forcedNatural ?? rollD20(rng);
  const special = specialOf(natural, impaired);
  // A natural 19/20 (and 17–20 in book text) succeeds regardless of target.
  const success = natural >= target || natural >= 19;

  return { base, chips, finalDifficulty, target, auto: false, natural, success, special, effortLevels };
}

/** Roll recovery points: dice d6 + bonus (Rules §5). */
export function rollRecovery({ dice, sides, bonus }, rng) {
  let n = bonus;
  for (let i = 0; i < dice; i++) n += 1 + Math.floor(rng() * sides);
  return n;
}
