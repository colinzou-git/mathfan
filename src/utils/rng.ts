/**
 * Tiny seedable PRNG for reproducible adaptive selection.
 *
 * mulberry32 is a fast, well-distributed 32-bit generator. A given seed always
 * yields the same sequence, so selection ordering can be replayed in tests and
 * (when a seed is stored on a session) reconstructed later. It is NOT
 * cryptographically secure — it is only used for shuffling/tie-breaking.
 */
export type Rng = () => number;

/** Deterministic [0,1) generator seeded by `seed`. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh non-deterministic seed (used when a session does not supply one). */
export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

/** Return a new array that is a Fisher–Yates shuffle of `items` using `rng`. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
