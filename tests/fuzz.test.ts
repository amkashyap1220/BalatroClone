import { createRun } from '../src/engine/run';
import { botStep, type BotStats } from '../src/engine/bot';
import { getMods } from '../src/engine/core';
import { DECKS } from '../src/engine/content/decks';
import { CHALLENGES } from '../src/engine/content/challenges';
import { deserializeRun, serializeRun } from '../src/engine/save';
import type { RunState } from '../src/engine/types';

function checkInvariants(run: RunState, label: string) {
  const m = getMods(run);
  expect(run.money, label + ' money').toBeGreaterThanOrEqual(-m.debtLimit - 60); // bosses/hexes can fine below 0 only via effects
  const ids = run.deck.map((c) => c.id);
  expect(new Set(ids).size, label + ' unique deck ids').toBe(ids.length);
  if (run.round && run.phase === 'playing') {
    const r = run.round;
    const all = [...r.hand, ...r.drawPile, ...r.discardPile];
    expect(new Set(all).size, label + ' piles disjoint').toBe(all.length);
    for (const id of all) expect(ids, label + ' pile card in deck').toContain(id);
    expect(r.hand.length, label + ' hand limit').toBeLessThanOrEqual(m.handSize + 8); // hexes may add cards beyond size
    expect(r.handsLeft).toBeGreaterThanOrEqual(0);
    expect(r.discardsLeft).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(r.score)).toBe(true);
  }
  expect(run.charms.length, label + ' charm slots').toBeLessThanOrEqual(m.charmSlots + 1);
  const uids = run.charms.map((c) => c.uid);
  expect(new Set(uids).size).toBe(uids.length);
}

function simulate(run: RunState, seed: number, maxSteps = 1500) {
  const rng = { s: seed };
  const stats: BotStats = { actions: 0, errors: [] };
  for (let i = 0; i < maxSteps && run.phase !== 'gameOver'; i++) {
    run = botStep(run, rng, stats);
    checkInvariants(run, `${run.seed}#${i}`);
    if (i % 50 === 0) expect(deserializeRun(serializeRun(run))).toEqual(run);
  }
  return { run, stats };
}

describe('fuzzed full runs', () => {
  test.each(DECKS.map((d) => d.id))('deck %s: bot plays a full run without errors or broken invariants', (deckId) => {
    for (let s = 0; s < 3; s++) {
      const { run, stats } = simulate(createRun({ seed: `FZ${deckId}${s}`, deckId }), 1000 + s);
      expect(stats.errors, stats.errors.join('\n')).toEqual([]);
      expect(run.ante).toBeGreaterThanOrEqual(1);
    }
  });

  test.each(CHALLENGES.map((c) => c.id))('challenge %s runs cleanly', (challengeId) => {
    const { stats } = simulate(createRun({ seed: `CH${challengeId}`, challengeId }), 77);
    expect(stats.errors, stats.errors.join('\n')).toEqual([]);
  });

  test('heat levels run cleanly', () => {
    for (let h = 0; h <= 5; h++) {
      const { stats } = simulate(createRun({ seed: `HEAT${h}`, heat: h }), 5 + h);
      expect(stats.errors).toEqual([]);
    }
  });

  test('same seed + same decisions = identical run', () => {
    const a = simulate(createRun({ seed: 'REPLAY' }), 42, 400).run;
    const b = simulate(createRun({ seed: 'REPLAY' }), 42, 400).run;
    expect(a).toEqual(b);
  });
});
