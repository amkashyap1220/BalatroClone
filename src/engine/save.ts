// Persistence: runs, profile and settings are stored as JSON in a pluggable key-value store
// (localStorage in the browser, an in-memory map in tests).
import type { RunState } from './types';
import { SAVE_VERSION } from './run';
import { newProfile, PROFILE_VERSION, type Profile } from './progression';

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export class MemoryKV implements KV {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

function defaultKV(): KV {
  try {
    if (typeof localStorage !== 'undefined') {
      const t = '__rf_test__';
      localStorage.setItem(t, '1');
      localStorage.removeItem(t);
      return localStorage;
    }
  } catch { /* storage blocked */ }
  return new MemoryKV();
}

let kv: KV = defaultKV();
export function setStorage(store: KV) { kv = store; }

const RUN_KEY = 'royalflux.run.v1';
const PROFILE_KEY = 'royalflux.profile.v1';
const SETTINGS_KEY = 'royalflux.settings.v1';

export function serializeRun(run: RunState): string {
  return JSON.stringify(run);
}

/** Parse and validate a saved run. Returns null when the payload is missing, corrupt or outdated. */
export function deserializeRun(json: string | null): RunState | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as RunState;
    if (!r || typeof r !== 'object' || r.version !== SAVE_VERSION) return null;
    if (!Array.isArray(r.deck) || !Array.isArray(r.charms) || typeof r.money !== 'number' || !r.phase) return null;
    return r;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null) {
  try {
    if (!run || run.phase === 'gameOver') kv.removeItem(RUN_KEY);
    else kv.setItem(RUN_KEY, serializeRun(run));
  } catch { /* quota or blocked */ }
}

export function loadRun(): RunState | null {
  try { return deserializeRun(kv.getItem(RUN_KEY)); } catch { return null; }
}

export function clearRun() {
  try { kv.removeItem(RUN_KEY); } catch { /* ignore */ }
}

export function saveProfile(p: Profile) {
  try { kv.setItem(PROFILE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function loadProfile(): Profile {
  try {
    const raw = kv.getItem(PROFILE_KEY);
    if (!raw) return newProfile();
    const p = JSON.parse(raw) as Profile;
    if (!p || p.version !== PROFILE_VERSION) return newProfile();
    const base = newProfile();
    return { ...base, ...p, stats: { ...base.stats, ...p.stats } };
  } catch {
    return newProfile();
  }
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
  speed: number;
  crt: boolean;
  reduceMotion: boolean;
  fourColor: boolean;
  confirmSell: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8, music: 0.5, sfx: 0.8, muted: false, speed: 1, crt: true, reduceMotion: false, fourColor: false, confirmSell: false,
};

export function loadSettings(): Settings {
  try {
    const raw = kv.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try { kv.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function resetAll() {
  for (const k of [RUN_KEY, PROFILE_KEY]) try { kv.removeItem(k); } catch { /* ignore */ }
}
