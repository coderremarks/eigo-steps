/**
 * Deterministic randomness. Option order, quiz selection and demo data are seeded so that a
 * learner sees a stable order while answering, printed worksheets match their answer keys, and
 * tests are reproducible.
 */

export type Rng = () => number;

/** Mulberry32: a tiny, fast, well-distributed 32-bit PRNG. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used to derive seeds from ids. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Returns a permutation of indexes 0..length-1. */
export function shuffledOrder(length: number, rng: Rng): number[] {
  return shuffle(
    Array.from({ length }, (_, index) => index),
    rng,
  );
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pick() needs at least one item');
  return items[Math.floor(rng() * items.length)] as T;
}

/** A new random seed for a fresh attempt (not used where reproducibility matters). */
export function freshSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;
  }
  return Math.floor(Math.random() * 2 ** 32);
}
