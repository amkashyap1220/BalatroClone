import { CHARMS, CHARM_MAP } from '../src/engine/content/charms';
import { playHand, discardCards, cashOut, leaveShop, reroll, sellCharm, createRun, selectBlind, skipBlind, useConsumable } from '../src/engine/run';
import { getMods } from '../src/engine/core';
import { addCharm, setHand, startedRun, setTarget } from './helpers';
import type { RunState } from '../src/engine/types';

const HOOKS = ['main', 'onScored', 'onHeld', 'retrigScored', 'retrigHeld', 'before', 'after', 'onDiscard', 'onRoundStart', 'payout',
  'onRoundEnd', 'onBossDefeated', 'onShopEnter', 'onShopExit', 'onReroll', 'onAcquire', 'onSell', 'onOtherSold', 'onCardsDestroyed',
  'onConsumableUsed', 'onSkipBlind', 'onPackSkipped', 'onBuy', 'mods', 'rules', 'copies'];

describe('charm roster', () => {
  test('at least 150 charms across all four rarities', () => {
    expect(CHARMS.length).toBeGreaterThanOrEqual(150);
    for (const r of ['common', 'uncommon', 'rare', 'legendary']) expect(CHARMS.some((c) => c.rarity === r)).toBe(true);
  });

  test('every charm has unique id/name, a description, icon and a real implementation hook', () => {
    const names = new Set<string>();
    for (const c of CHARMS) {
      expect(c.desc.length, c.id).toBeGreaterThan(5);
      expect(c.icon.glyph, c.id).toBeTruthy();
      expect(names.has(c.name), c.name).toBe(false);
      names.add(c.name);
      const implemented = HOOKS.some((h) => (c as any)[h] !== undefined) || c.id === 'insurance';
      expect(implemented, `${c.id} has no logic`).toBe(true);
    }
  });

  test.each(CHARMS.map((c) => c.id))('%s survives a full round lifecycle', (id) => {
    let run = startedRun('LIFE-' + id);
    addCharm(run, id);
    addCharm(run, 'lucky_penny');
    run.money = 30;
    // discard, play a few hands, win, shop, reroll, sell
    run = discardCards(run, run.round!.hand.slice(0, 2)).run;
    const ids = setHand(run, [['KS', { e: 'crystal', s: 'ruby' }], ['KH', { e: 'fortune', ed: 'shimmer' }], 'QD', ['QC', { e: 'iron' }], '2S', ['9S', { e: 'treasure' }], '10H', 'AS']);
    let res = playHand(run, ids.slice(0, 5));
    expect(res.error).toBeUndefined();
    expect(Number.isFinite(res.score!.total)).toBe(true);
    expect(res.score!.total).toBeGreaterThanOrEqual(0);
    run = res.run;
    if (run.phase === 'playing') {
      setTarget(run, 1);
      res = playHand(run, run.round!.hand.slice(0, 2));
      expect(res.error).toBeUndefined();
      run = res.run;
    }
    expect(['cashout', 'victory']).toContain(run.phase);
    run = cashOut(run).run;
    expect(run.phase).toBe('shop');
    run.money = 50;
    run = reroll(run).run;
    const inst = run.charms.find((c) => c.id === id);
    if (inst) run = sellCharm(run, inst.uid).run;
    run = leaveShop(run).run;
    run = skipBlind(run).run;
    expect(run.money).toBeGreaterThan(-100);
  });
});

function play(run: RunState, specs: Parameters<typeof setHand>[1], n = specs.length) {
  setTarget(run, 1e12);
  const ids = setHand(run, specs);
  const r = playHand(run, ids.slice(0, n));
  if (r.error) throw new Error(r.error);
  return r;
}

describe('specific charm behaviour', () => {
  test('suit thread: +3 Mult per scored Heart', () => {
    const run = startedRun();
    addCharm(run, 'crimson_thread');
    expect(play(run, ['KH', 'KS'], 2).score!.mult).toBe(5);
  });

  test('hand-specific: Kinship Locket ×1.5 only on hands containing a Pair', () => {
    const run = startedRun();
    addCharm(run, 'kinship_locket');
    expect(play(run, ['KH', '2S'], 2).score!.mult).toBe(1);
    const run2 = startedRun();
    addCharm(run2, 'kinship_locket');
    expect(play(run2, ['KH', 'KS', '2D', '2C', '9S'], 5).score!.mult).toBe(3);
  });

  test('economy: Piggy Bank and Tip Jar pay at cash-out', () => {
    const run = startedRun('ECO');
    addCharm(run, 'piggy_bank');
    addCharm(run, 'tip_jar');
    setTarget(run, 1);
    const r = playHand(run, run.round!.hand.slice(0, 1)).run;
    const labels = Object.fromEntries(r.cashout!.map((l) => [l.label, l.amount]));
    expect(labels['Piggy Bank']).toBe(4);
    expect(labels['Tip Jar']).toBe(3);
  });

  test('hand size / discards modifiers apply', () => {
    let run = createRun({ seed: 'HS' });
    addCharm(run, 'deep_pockets');
    addCharm(run, 'spring_cleaning');
    run = selectBlind(run).run;
    expect(run.round!.hand.length).toBe(9);
    expect(run.round!.discardsLeft).toBe(4);
  });

  test('Scrap Collector scales with discards; Snowball resets on discard', () => {
    let run = startedRun('SCRAP');
    const scrap = addCharm(run, 'scrap_collector');
    const snow = addCharm(run, 'snowball');
    snow.state.v = 5;
    run = discardCards(run, run.round!.hand.slice(0, 4)).run;
    expect(run.charms.find((c) => c.uid === scrap.uid)!.state.v).toBe(8);
    expect(run.charms.find((c) => c.uid === snow.uid)!.state.v).toBe(0);
  });

  test('Grave Robber gains ×Mult when cards are destroyed', () => {
    let run = startedRun('GRAVE');
    const gr = addCharm(run, 'grave_digger');
    run.consumables.push({ uid: 'k1', id: 'omen_reaper', kind: 'omen', edition: null });
    run = useConsumable(run, 'k1', run.round!.hand.slice(0, 2)).run;
    expect(run.charms.find((c) => c.uid === gr.uid)!.state.v).toBeCloseTo(1.4);
  });

  test('rule charms: Short Hand recognises 4-card flushes', () => {
    const run = startedRun();
    addCharm(run, 'short_hand');
    expect(play(run, ['2H', '5H', '9H', 'KH'], 4).score!.hand).toBe('flush');
  });

  test('Masquerade makes every card a face card for Courtier', () => {
    const run = startedRun();
    addCharm(run, 'masquerade');
    addCharm(run, 'courtier');
    expect(play(run, ['2H', '2S'], 2).score!.mult).toBe(2 + 8);
  });

  test('Trailblazer permanently upgrades scored cards', () => {
    const run = startedRun();
    addCharm(run, 'trailblazer');
    const r = play(run, ['KH', 'KS'], 2);
    for (const id of r.score!.scoringIds) expect(r.run.deck.find((c) => c.id === id)!.bonusChips).toBe(3);
  });

  test('Ouroboros (legendary) starts at ×2', () => {
    const run = startedRun();
    addCharm(run, 'ouroboros');
    expect(play(run, ['KH', 'KS'], 2).score!.mult).toBe(4);
  });

  test('Juggler’s Gloves: +2 hand size, -1 discard', () => {
    const run = createRun({ seed: 'JG' });
    addCharm(run, 'jugglers_gloves');
    const m = getMods(run);
    expect(m.handSize).toBe(10);
    expect(m.discards).toBe(2);
  });

  test('Glass Cannon gives ×3 and can shatter at end of round', () => {
    let broke = 0;
    for (let i = 0; i < 30; i++) {
      const run = startedRun('GC' + i);
      addCharm(run, 'glass_cannon');
      setTarget(run, 1);
      const r = playHand(run, run.round!.hand.slice(0, 1));
      expect(r.score!.steps.some((s) => s.xmult === 3)).toBe(true);
      if (!r.run.charms.some((c) => c.id === 'glass_cannon')) broke++;
    }
    expect(broke).toBeGreaterThan(0);
    expect(broke).toBeLessThan(15);
  });

  test('charm meta lookups are consistent', () => {
    for (const c of CHARMS) expect(CHARM_MAP[c.id]).toBe(c);
  });
});
