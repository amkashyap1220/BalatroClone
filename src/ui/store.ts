import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunState, ScoreResult } from '../engine/types';
import type { ActionResult } from '../engine/run';
import { loadProfile, saveProfile, loadRun, saveRun, clearRun, loadSettings, saveSettings, type Settings } from '../engine/save';
import { checkAchievements, discoverFromRun, recordHand, recordRunEnd, unlockedCharmIds, ACHIEVEMENT_MAP, type Profile } from '../engine/progression';
import { setUnlockedCharms } from '../engine/core';
import { audio, type Sfx } from '../audio/audio';
import { setFourColor } from './components';
import { DECKS } from '../engine/content/decks';
import { CHARMS } from '../engine/content/charms';

export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'unlock' }

let toastId = 0;

export function useGameStore() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [run, setRunState] = useState<RunState | null>(null);
  const [savedRun, setSavedRun] = useState<RunState | null>(() => loadRun());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useEffect(() => { setUnlockedCharms(unlockedCharmIds(profile)); }, [profile]);
  useEffect(() => {
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx, muted: settings.muted });
    setFourColor(settings.fourColor);
    document.documentElement.classList.toggle('crt', settings.crt);
    document.documentElement.classList.toggle('reduce-motion', settings.reduceMotion);
  }, [settings]);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId;
    setToasts((t) => [...t.slice(-4), { id, text, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'unlock' ? 5200 : 3000);
  }, []);

  const sfx = useCallback((s: Sfx, step = 0) => audio.play(s, step), []);

  const announceUnlocks = useCallback((ids: string[]) => {
    for (const id of ids) {
      const a = ACHIEVEMENT_MAP[id];
      if (!a) continue;
      const deck = DECKS.find((d) => d.unlock === id);
      const charms = CHARMS.filter((c) => c.unlock === id).map((c) => c.name);
      let extra = '';
      if (deck) extra += ` · Unlocked ${deck.name}`;
      if (charms.length) extra += ` · New charm: ${charms.join(', ')}`;
      toast(`🏆 ${a.name}${extra}`, 'unlock');
      audio.play('unlock');
    }
  }, [toast]);

  const updateProfile = useCallback((fn: (p: Profile) => string[] | void) => {
    const p: Profile = structuredClone(profileRef.current);
    const unlocked = fn(p) || [];
    profileRef.current = p;
    setProfile(p);
    saveProfile(p);
    if (unlocked.length) announceUnlocks(unlocked);
  }, [announceUnlocks]);

  /** Commit a new run state: persist, discover, check achievements and end-of-run records. */
  const commit = useCallback((next: RunState | null, score?: ScoreResult) => {
    setRunState(next);
    if (!next) return;
    saveRun(next);
    setSavedRun(next.phase === 'gameOver' ? null : next);
    updateProfile((p) => {
      const out: string[] = [];
      discoverFromRun(p, next);
      if (score) out.push(...recordHand(p, next, score));
      out.push(...checkAchievements(p, next));
      if (next.phase === 'gameOver') out.push(...recordRunEnd(p, next, 'loss'));
      if (next.phase === 'victory') out.push(...recordRunEnd(p, next, 'win'));
      return out;
    });
  }, [updateProfile]);

  /** Run an engine action; show errors as toasts. Returns the result. */
  const act = useCallback((res: ActionResult, sound?: Sfx): ActionResult => {
    if (res.error) {
      toast(res.error, 'error');
      audio.play('error');
      return res;
    }
    if (sound) audio.play(sound);
    commit(res.run, res.score);
    return res;
  }, [commit, toast]);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const startRun = useCallback((r: RunState) => {
    commit(r);
  }, [commit]);

  const abandonRun = useCallback(() => {
    if (run) updateProfile((p) => recordRunEnd(p, run, run.won ? 'win' : 'loss'));
    clearRun();
    setSavedRun(null);
    setRunState(null);
  }, [run, updateProfile]);

  const clearSaved = useCallback(() => { setSavedRun(null); setRunState(null); }, []);

  const quitToMenu = useCallback(() => {
    if (run && run.phase !== 'gameOver') saveRun(run);
    if (run?.phase === 'gameOver') clearRun();
    setSavedRun(run && run.phase !== 'gameOver' ? run : null);
    setRunState(null);
  }, [run]);

  const continueRun = useCallback(() => {
    const r = loadRun();
    if (r) setRunState(r);
    return !!r;
  }, []);

  return {
    profile, settings, run, savedRun, toasts, toast, sfx, act, commit, setSettings, startRun, abandonRun, quitToMenu,
    continueRun, updateProfile, setRunState, setProfile, clearSaved,
  };
}

export type GameStore = ReturnType<typeof useGameStore>;
