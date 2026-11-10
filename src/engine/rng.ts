// Deterministic, seedable random number generation.
// Each run keeps independent named streams so that e.g. shop rerolls don't change deck shuffles.

import type { RunState } from './types';

export function hashString(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 step: returns [value in [0,1), nextState]. */
export function mulberry(state: number): [number, number] {
  let t = (state + 0x6d2b79f5) >>> 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

export function rand(run: RunState, stream: string): number {
  let s = run.rng[stream];
  if (s === undefined) s = hashString(run.seed + '::' + stream);
  const [v, next] = mulberry(s);
  run.rng[stream] = next;
  return v;
}

export function randInt(run: RunState, stream: string, min: number, max: number): number {
  return min + Math.floor(rand(run, stream) * (max - min + 1));
}

export function pick<T>(run: RunState, stream: string, arr: readonly T[]): T {
  return arr[Math.floor(rand(run, stream) * arr.length)];
}

export function shuffle<T>(run: RunState, stream: string, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(run, stream) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function weightedPick<T>(run: RunState, stream: string, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((s, it) => s + Math.max(0, weight(it)), 0);
  let r = rand(run, stream) * total;
  for (const it of items) {
    r -= Math.max(0, weight(it));
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

const SEED_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomSeed(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += SEED_CHARS[Math.floor(Math.random() * SEED_CHARS.length)];
  return s;
}
