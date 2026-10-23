/**
 * Stateless seeded randomness: every draw is a pure function of (seed, tag, n).
 * Because draws don't depend on how many came before, replays with a different
 * choice still see the same random events in the same months ("What if?").
 */

function xmur3(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [0, 1). */
export function rand(seed: number, tag: string, n = 0): number {
  return mulberry32(xmur3(`${seed}:${tag}:${n}`));
}

export function pickWeighted<T extends { weight: number }>(items: readonly T[], r: number): T | undefined {
  const total = items.reduce((s, i) => s + i.weight, 0);
  if (total <= 0) return undefined;
  let x = r * total;
  for (const item of items) {
    x -= item.weight;
    if (x < 0) return item;
  }
  return items[items.length - 1];
}

/** A fresh 32-bit seed (for new games). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0]!;
  return Math.floor(Math.random() * 2 ** 32);
}

/** Seed for a calendar date, e.g. the Daily Dilemma. */
export function seedFromString(s: string): number {
  return xmur3(s);
}
