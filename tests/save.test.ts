import { MemoryKV, setStorage, saveRun, loadRun, deserializeRun, serializeRun, saveProfile, loadProfile, saveSettings, loadSettings, clearRun } from '../src/engine/save';
import { createRun, selectBlind, playHand, cashOut } from '../src/engine/run';
import { newProfile, recordHand, recordRunEnd, checkAchievements, discoverFromRun, isDeckUnlocked, unlockedCharmIds, collectionProgress } from '../src/engine/progression';
import { addCharm, setTarget } from './helpers';

beforeEach(() => setStorage(new MemoryKV()));

describe('save / load', () => {
  test('a mid-round run restores exactly', () => {
    let run = selectBlind(createRun({ seed: 'SAVE' })).run;
    addCharm(run, 'snowball').state.v = 7;
    run.round!.target = 1e9;
    run = playHand(run, run.round!.hand.slice(0, 2)).run;
    saveRun(run);
    const back = loadRun();
    expect(back).toEqual(run);
    // continuing from the restored state behaves identically
    const a = playHand(run, run.round!.hand.slice(0, 3));
    const b = playHand(back!, back!.round!.hand.slice(0, 3));
    expect(b.run).toEqual(a.run);
  });

  test('shop state persists', () => {
    let run = selectBlind(createRun({ seed: 'SHOPSAVE' })).run;
    setTarget(run, 1);
    run = cashOut(playHand(run, run.round!.hand.slice(0, 1)).run).run;
    saveRun(run);
    expect(loadRun()!.shop).toEqual(run.shop);
  });

  test('corrupt or outdated saves are rejected safely', () => {
    expect(deserializeRun('{not json')).toBeNull();
    expect(deserializeRun(JSON.stringify({ version: -1 }))).toBeNull();
    expect(deserializeRun(null)).toBeNull();
    const ok = serializeRun(createRun({ seed: 'X' }));
    expect(deserializeRun(ok)).not.toBeNull();
  });

  test('game over clears the saved run; clearRun removes it', () => {
    const run = createRun({ seed: 'GO' });
    saveRun(run);
    expect(loadRun()).not.toBeNull();
    clearRun();
    expect(loadRun()).toBeNull();
    saveRun({ ...run, phase: 'gameOver' });
    expect(loadRun()).toBeNull();
  });

  test('settings and profile round-trip', () => {
    const s = loadSettings();
    saveSettings({ ...s, music: 0.1, speed: 2 });
    expect(loadSettings().music).toBe(0.1);
    const p = newProfile();
    p.stats.wins = 3;
    p.achievements.push('ach_win');
    saveProfile(p);
    expect(loadProfile().stats.wins).toBe(3);
    expect(loadProfile().achievements).toContain('ach_win');
  });
});

describe('meta progression', () => {
  test('recording hands updates lifetime stats and unlocks hand achievements', () => {
    const p = newProfile();
    let run = selectBlind(createRun({ seed: 'META' })).run;
    run.round!.target = 1e9;
    const res = playHand(run, run.round!.hand.slice(0, 2));
    recordHand(p, res.run, res.score!);
    expect(p.stats.handsPlayed).toBe(1);
    expect(checkAchievements(p, res.run)).toContain('ach_first');
  });

  test('run end records wins/losses once, unlocks decks, heat and challenges', () => {
    const p = newProfile();
    const run = createRun({ seed: 'END' });
    run.ante = 9;
    run.won = true;
    expect(isDeckUnlocked(p, 'pocket')).toBe(false);
    recordRunEnd(p, run, 'win');
    recordRunEnd(p, run, 'win');
    expect(p.stats.wins).toBe(1);
    expect(p.stats.runs).toBe(1);
    expect(p.achievements).toContain('ach_win');
    expect(isDeckUnlocked(p, 'pocket')).toBe(true);
    expect(p.maxHeat).toBe(1);
    expect(unlockedCharmIds(p).has('mimic')).toBe(true);
    // an endless loss after a win doesn't count as a loss or a second run
    run.endless = true;
    recordRunEnd(p, run, 'loss');
    expect(p.stats.losses).toBe(0);
    expect(p.stats.runs).toBe(1);

    const ch = createRun({ seed: 'CH', challengeId: 'face_off' });
    recordRunEnd(p, ch, 'win');
    expect(p.challengesDone).toContain('face_off');
  });

  test('discovery tracks seen content and collection progress', () => {
    const p = newProfile();
    const run = createRun({ seed: 'DISC' });
    addCharm(run, 'lucky_penny');
    discoverFromRun(p, run);
    expect(p.discovered).toContain('lucky_penny');
    expect(p.discovered).toContain('ivory');
    const prog = collectionProgress(p);
    expect(prog.found).toBeGreaterThanOrEqual(2);
    expect(prog.total).toBeGreaterThan(300);
  });
});
