import {
  createRun, selectBlind, skipBlind, playHand, discardCards, cashOut, leaveShop, buyItem, reroll, rerollCost, sellCharm,
  sellConsumable, sellCard, shopPrice, useConsumable, pickPackItem, skipPack, blindTarget, anteBase, computeInterest, canPlayHand, bossViolation,
} from '../src/engine/run';
import { getMods, GameCtx } from '../src/engine/core';
import { addCharm, setHand, startedRun, setTarget } from './helpers';
import type { RunState } from '../src/engine/types';

function winCurrent(run: RunState): RunState {
  setTarget(run, 1);
  const r = playHand(run, run.round!.hand.slice(0, 1));
  if (r.error) throw new Error(r.error);
  return r.run;
}

describe('blind progression', () => {
  test('small → big → boss → next ante with shops in between', () => {
    let run = createRun({ seed: 'PROG' });
    expect(run.phase).toBe('blindSelect');
    for (let b = 0; b < 3; b++) {
      run = selectBlind(run).run;
      expect(run.round!.blindType).toBe(['small', 'big', 'boss'][b]);
      run = winCurrent(run);
      expect(run.phase).toBe('cashout');
      run = cashOut(run).run;
      expect(run.phase).toBe('shop');
      run = leaveShop(run).run;
    }
    expect(run.ante).toBe(2);
    expect(run.blindIndex).toBe(0);
  });

  test('score targets escalate by blind and ante', () => {
    const run = createRun({ seed: 'T', deckId: 'ivory' });
    run.bossId = 'crimson_veil';
    expect(blindTarget(run, 'small')).toBe(300);
    expect(blindTarget(run, 'big')).toBe(450);
    expect(blindTarget(run, 'boss')).toBe(600);
    for (let a = 1; a < 14; a++) expect(anteBase(a + 1)).toBeGreaterThan(anteBase(a));
  });

  test('skipping a blind grants its token and advances', () => {
    let run = createRun({ seed: 'SKIP' });
    run.skipTokens = ['tok_cash', 'tok_juggle'];
    const m = run.money;
    run = skipBlind(run).run;
    expect(run.money).toBe(m + 10);
    expect(run.blindIndex).toBe(1);
    run = skipBlind(run).run;
    expect(run.tokens).toContain('tok_juggle');
    expect(skipBlind(run).error).toBeTruthy(); // boss can't be skipped
    run = selectBlind(run).run;
    expect(run.tokens).not.toContain('tok_juggle');
    expect(run.round!.hand.length).toBe(getMods(run).handSize);
    expect(getMods(run).handSize).toBe(11);
  });

  test('pack tokens open a pack immediately', () => {
    let run = createRun({ seed: 'PT' });
    run.skipTokens = ['tok_star', 'tok_cash'];
    run = skipBlind(run).run;
    expect(run.phase).toBe('pack');
    expect(run.pack!.returnTo).toBe('blindSelect');
    const lv = { ...run.handLevels };
    run = pickPackItem(run, 0).run;
    const changed = Object.keys(lv).some((h) => (run.handLevels as any)[h] !== (lv as any)[h]);
    expect(changed).toBe(true);
    run = skipPack(run).run;
    expect(run.phase).toBe('blindSelect');
  });

  test('defeat when out of hands without reaching the target', () => {
    let run = startedRun('LOSE');
    setTarget(run, 1e9);
    while (run.phase === 'playing') run = playHand(run, run.round!.hand.slice(0, 1)).run;
    expect(run.phase).toBe('gameOver');
  });

  test('Insurance Policy saves a run at ≥50% of target, once', () => {
    let run = startedRun('INS');
    addCharm(run, 'insurance');
    run.round!.handsLeft = 1;
    run.round!.score = 600;
    setTarget(run, 1000);
    run = playHand(run, run.round!.hand.slice(0, 1)).run;
    expect(run.phase).toBe('cashout');
    expect(run.charms.some((c) => c.id === 'insurance')).toBe(false);
  });

  test('victory after the Ante 8 boss, then endless continues to Ante 9', () => {
    let run = createRun({ seed: 'WIN' });
    run.ante = 8;
    run.blindIndex = 2;
    run = selectBlind(run).run;
    run = winCurrent(run);
    expect(run.phase).toBe('victory');
    expect(run.won).toBe(true);
    run = cashOut(run).run;
    expect(run.endless).toBe(true);
    expect(run.ante).toBe(9);
    expect(run.phase).toBe('shop');
    expect(anteBase(9)).toBeGreaterThan(anteBase(8));
  });

  test('cash-out: blind reward + remaining hands + interest', () => {
    let run = startedRun('CASH');
    run.money = 23;
    run = winCurrent(run);
    const lines = run.cashout!;
    expect(lines[0].amount).toBe(3);
    expect(lines.find((l) => l.label.startsWith('Remaining'))!.amount).toBe(3);
    expect(lines.find((l) => l.label.startsWith('Interest'))!.amount).toBe(4);
    const before = run.money;
    run = cashOut(run).run;
    expect(run.money).toBe(before + 3 + 3 + 4);
  });

  test('interest is capped and never negative', () => {
    const run = createRun({ seed: 'INT' });
    run.money = 200;
    expect(computeInterest(run)).toBe(5);
    run.money = -5;
    expect(computeInterest(run)).toBe(0);
  });
});

describe('hand & discard validation (UI-bug guards)', () => {
  test('rejects duplicates, foreign cards, empty and oversized plays', () => {
    const run = startedRun('VAL');
    const h = run.round!.hand;
    expect(playHand(run, [h[0], h[0]]).error).toBeTruthy();
    expect(playHand(run, ['nope']).error).toBeTruthy();
    expect(playHand(run, []).error).toBeTruthy();
    expect(playHand(run, h.slice(0, 6)).error).toBeTruthy();
    expect(discardCards(run, h.slice(0, 6)).error).toBeTruthy();
  });

  test('a failed action does not mutate state', () => {
    const run = startedRun('IMM');
    const snap = JSON.stringify(run);
    playHand(run, ['bogus']);
    discardCards(run, []);
    expect(JSON.stringify(run)).toBe(snap);
  });

  test('discarding draws back to hand size and uses a discard', () => {
    let run = startedRun('DISC');
    const size = run.round!.hand.length;
    const d = run.round!.discardsLeft;
    run = discardCards(run, run.round!.hand.slice(0, 3)).run;
    expect(run.round!.hand.length).toBe(size);
    expect(run.round!.discardsLeft).toBe(d - 1);
    run.round!.discardsLeft = 0;
    expect(discardCards(run, run.round!.hand.slice(0, 1)).error).toBeTruthy();
  });

  test('cards are never duplicated across piles', () => {
    let run = startedRun('PILES');
    setTarget(run, 1e9);
    for (let i = 0; i < 3; i++) {
      run = discardCards(run, run.round!.hand.slice(0, 2)).run;
      run = playHand(run, run.round!.hand.slice(0, 3)).run;
      const r = run.round!;
      const all = [...r.hand, ...r.drawPile, ...r.discardPile];
      expect(new Set(all).size).toBe(all.length);
      expect(all.length).toBe(run.deck.length);
      expect(r.hand.length).toBeLessThanOrEqual(getMods(run).handSize);
    }
  });
});

describe('boss restrictions', () => {
  const bossRun = (bossId: string, seed = 'BOSS') => {
    const run = createRun({ seed });
    run.blindIndex = 2;
    run.bossId = bossId;
    return selectBlind(run).run;
  };

  test('The Quota requires exactly 5 cards', () => {
    const run = bossRun('quota');
    expect(bossViolation(run, run.round!.hand.slice(0, 4))).toMatch(/exactly 5/);
    expect(bossViolation(run, run.round!.hand.slice(0, 5))).toBeNull();
    setTarget(run, 1e9);
    const r = playHand(run, run.round!.hand.slice(0, 4));
    expect(r.error).toBeUndefined();
    expect(r.score!.total).toBe(0);
  });

  test('The Muzzle limits discards to 1, Hourglass removes hands, Narrow Gate shrinks hand', () => {
    expect(bossRun('muzzle').round!.discardsLeft).toBe(1);
    expect(bossRun('hourglass').round!.handsLeft).toBe(2);
    expect(bossRun('narrow_gate').round!.hand.length).toBe(6);
  });

  test('The Monotone locks the first hand type', () => {
    const run = bossRun('monotone');
    setTarget(run, 1e9);
    let ids = setHand(run, ['KS', 'KH', '2D', '5C', '9S', '7H', '3D', '4C']);
    const r1 = playHand(run, ids.slice(0, 2));
    expect(r1.score!.hand).toBe('pair');
    ids = setHand(r1.run, ['AS', '2D', '5C', '9S', '7H', 'JD', '3D', '4C']);
    expect(bossViolation(r1.run, ids.slice(0, 1))).toMatch(/Only Pair/);
    expect(playHand(r1.run, ids.slice(0, 1)).score!.total).toBe(0);
  });

  test('The Fog forbids repeating a hand type', () => {
    const run = bossRun('fog');
    setTarget(run, 1e9);
    let ids = setHand(run, ['KS', 'KH']);
    const r1 = playHand(run, ids);
    ids = setHand(r1.run, ['QS', 'QH']);
    expect(bossViolation(r1.run, ids)).toMatch(/already played/);
    expect(playHand(r1.run, ids).score!.total).toBe(0);
  });

  test('The Silencer halves base values', () => {
    const run = bossRun('silencer');
    setTarget(run, 1e9);
    const ids = setHand(run, ['KS', 'KH']);
    expect(playHand(run, ids).score!.total).toBe((5 + 20) * 1);
  });

  test('The Miser King charges $1 per card played', () => {
    const run = bossRun('miser_king');
    setTarget(run, 1e9);
    const m = run.money;
    expect(playHand(run, run.round!.hand.slice(0, 3)).run.money).toBe(m - 3);
  });

  test('The Tollkeeper doubles the boss target; The Drought pays no reward', () => {
    expect(bossRun('tollkeeper').round!.target).toBe(1200);
    let run = bossRun('drought');
    run = winCurrent(run);
    expect(run.cashout![0].amount).toBe(0);
  });

  test('The Tithe lowers the played hand level', () => {
    const run = bossRun('tithe');
    setTarget(run, 1e9);
    run.handLevels.pair = 3;
    const ids = setHand(run, ['KS', 'KH']);
    expect(playHand(run, ids).run.handLevels.pair).toBe(2);
  });

  test('The Blackout disables a charm, which then does not score', () => {
    const run = bossRun('blackout');
    // re-pick with a charm present
    addCharm(run, 'lucky_penny');
    run.round!.disabledCharm = run.charms[0].uid;
    setTarget(run, 1e9);
    const ids = setHand(run, ['KS', 'KH']);
    expect(playHand(run, ids).score!.mult).toBe(2);
  });

  test('Lightning Rod and Patron Saint counter bosses; Wardbreaker disables on sale', () => {
    let run = createRun({ seed: 'PS' });
    new GameCtx(run).createCharm('patron_saint', null, true);
    run.blindIndex = 2;
    run.bossId = 'hourglass';
    run = selectBlind(run).run;
    expect(run.round!.bossDisabled).toBe(true);
    expect(run.round!.handsLeft).toBe(4);

    const rod = bossRun('crimson_veil');
    addCharm(rod, 'lightning_rod');
    setTarget(rod, 1e9);
    expect(playHand(rod, setHand(rod, ['KH', 'KD'])).score!.total).toBe(60);

    const wb = bossRun('crimson_veil');
    const charm = addCharm(wb, 'wardbreaker');
    const after = sellCharm(wb, charm.uid).run;
    expect(after.round!.bossDisabled).toBe(true);
  });

  test('every boss can be fought without errors', async () => {
    const { BOSSES } = await import('../src/engine/content/bosses');
    for (const b of BOSSES) {
      let run = bossRun(b.id, 'ALL' + b.id);
      expect(run.round!.bossId).toBe(b.id);
      let guard = 0;
      while (run.phase === 'playing' && guard++ < 20) {
        const n = b.id === 'quota' ? 5 : 1;
        const res = playHand(run, run.round!.hand.slice(0, n));
        if (res.error) {
          // Herald requires a face card: find one
          const face = run.round!.hand.find((id) => { const c = run.deck.find((x) => x.id === id)!; return c.rank >= 11 && c.rank <= 13; });
          const alt = playHand(run, face ? [face] : run.round!.hand.slice(0, 5));
          if (alt.error) break;
          run = alt.run;
        } else run = res.run;
      }
      expect(['playing', 'cashout', 'gameOver', 'victory']).toContain(run.phase);
    }
  });
});

describe('shop and economy', () => {
  const shopRun = (seed = 'SHOP') => {
    let run = createRun({ seed });
    run = selectBlind(run).run;
    run = winCurrent(run);
    run = cashOut(run).run;
    return run;
  };

  test('buying deducts money and adds the charm; insufficient funds are refused', () => {
    let run = shopRun();
    run.shop!.items[0] = { kind: 'charm', id: 'lucky_penny', price: 3, sold: false, edition: null };
    run.money = 10;
    const r = buyItem(run, 'items', 0);
    expect(r.error).toBeUndefined();
    expect(r.run.money).toBe(10 - shopPrice(run, run.shop!.items[0]));
    expect(r.run.charms.map((c) => c.id)).toContain('lucky_penny');
    expect(buyItem(r.run, 'items', 0).error).toBeTruthy(); // already sold
    run.money = 1;
    expect(buyItem(run, 'items', 0).error).toMatch(/money/);
  });

  test('money can never go negative through purchases (without a credit charm)', () => {
    let run = shopRun('NEG');
    run.money = 0;
    for (let i = 0; i < run.shop!.items.length; i++) expect(buyItem(run, 'items', i).error).toBeTruthy();
    for (let i = 0; i < run.shop!.packs.length; i++) expect(buyItem(run, 'packs', i).error).toBeTruthy();
    expect(reroll(run).error).toBeTruthy();
    expect(run.money).toBe(0);
  });

  test('Line of Credit allows limited debt', () => {
    let run = shopRun('DEBT');
    addCharm(run, 'debt_collector');
    run.money = 0;
    run.shop!.items[0] = { kind: 'charm', id: 'brass_knuckles', price: 4, sold: false, edition: null };
    const r = buyItem(run, 'items', 0);
    expect(r.error).toBeUndefined();
    expect(r.run.money).toBe(-4);
    r.run.money = -19;
    r.run.shop!.items[1] = { kind: 'charm', id: 'lucky_penny', price: 3, sold: false, edition: null };
    expect(buyItem(r.run, 'items', 1).error).toBeTruthy();
  });

  test('charm slots are enforced; Void edition bypasses', () => {
    let run = shopRun('SLOTS');
    for (const id of ['lucky_penny', 'brass_knuckles', 'paper_lantern', 'coin_flip', 'courtier']) addCharm(run, id);
    run.money = 100;
    run.shop!.items[0] = { kind: 'charm', id: 'royal_guard', price: 4, sold: false, edition: null };
    expect(buyItem(run, 'items', 0).error).toMatch(/room/);
    run.shop!.items[0].edition = 'void';
    const r = buyItem(run, 'items', 0);
    expect(r.error).toBeUndefined();
    expect(r.run.charms).toHaveLength(6);
    expect(getMods(r.run).charmSlots).toBe(6);
  });

  test('selling charms and consumables pays sell value', () => {
    let run = shopRun('SELL');
    const c = addCharm(run, 'piggy_bank'); // cost 5 → sells for 2
    const m = run.money;
    run = sellCharm(run, c.uid).run;
    expect(run.money).toBe(m + 2);
    run.consumables.push({ uid: 'kx', id: 'star_pair', kind: 'star', edition: null });
    run = sellConsumable(run, 'kx').run;
    expect(run.money).toBe(m + 3);
  });

  test('rerolls cost more each time; free rerolls are consumed first', () => {
    let run = shopRun('RR');
    run.money = 100;
    expect(rerollCost(run)).toBe(5);
    run = reroll(run).run;
    expect(run.money).toBe(95);
    expect(rerollCost(run)).toBe(6);
    run.shop!.freeRerolls = 1;
    expect(rerollCost(run)).toBe(0);
    run = reroll(run).run;
    expect(run.money).toBe(95);
    expect(rerollCost(run)).toBe(6);
  });

  test('discounts: Coupon Clipper and Clearance Rack', () => {
    const run = shopRun('DISC');
    const item = { kind: 'charm' as const, id: 'lucky_penny', price: 8, sold: false, edition: null };
    expect(shopPrice(run, item)).toBe(8);
    addCharm(run, 'coupon_clipper');
    expect(shopPrice(run, item)).toBe(7);
    run.boons.push('clearance');
    expect(shopPrice(run, item)).toBe(5);
  });

  test('buying a boon applies its permanent effect', () => {
    let run = shopRun('BOON');
    run.money = 50;
    run.shop!.boon = { kind: 'boon', id: 'wide_grip', price: 10, sold: false };
    const hs = getMods(run).handSize;
    run = buyItem(run, 'boon', 0).run;
    expect(run.boons).toContain('wide_grip');
    expect(getMods(run).handSize).toBe(hs + 1);
    expect(run.money).toBe(40);
  });

  test('packs: open, choose within limit, skip returns to shop', () => {
    let run = shopRun('PACK');
    run.money = 50;
    run.shop!.packs[0] = { kind: 'pack', id: 'card_mega', price: 8, sold: false };
    run = buyItem(run, 'packs', 0).run;
    expect(run.phase).toBe('pack');
    expect(run.pack!.choices).toHaveLength(5);
    const deckSize = run.deck.length;
    run = pickPackItem(run, 0).run;
    expect(run.deck.length).toBe(deckSize + 1);
    expect(pickPackItem(run, 0).error).toBeTruthy();
    run = pickPackItem(run, 1).run;
    expect(run.phase).toBe('shop');
    expect(run.deck.length).toBe(deckSize + 2);
  });

  test('omen packs deal a hand and apply the omen to selected cards', () => {
    let run = shopRun('OPACK');
    run.money = 50;
    run.shop!.packs[0] = { kind: 'pack', id: 'omen_small', price: 4, sold: false };
    run = buyItem(run, 'packs', 0).run;
    run.pack!.choices[0] = { kind: 'consumable', id: 'omen_smith', consumableKind: 'omen' };
    expect(run.pack!.hand.length).toBeGreaterThan(0);
    expect(pickPackItem(run, 0, []).error).toBeTruthy();
    const target = run.pack!.hand[0];
    run = pickPackItem(run, 0, [target]).run;
    expect(run.deck.find((c) => c.id === target)!.enhancement).toBe('plated');
  });

  test('pawning a playing card: once per shop', () => {
    let run = shopRun('PAWN');
    const id = run.deck[0].id;
    const m = run.money;
    run = sellCard(run, id).run;
    expect(run.money).toBe(m + 1);
    expect(run.deck.some((c) => c.id === id)).toBe(false);
    expect(sellCard(run, run.deck[0].id).error).toBeTruthy();
  });

  test('shop tokens: Rare ticket adds a free rare charm', () => {
    let run = createRun({ seed: 'TOK' });
    run.tokens.push('tok_rare');
    run = selectBlind(run).run;
    run = winCurrent(run);
    run = cashOut(run).run;
    const free = run.shop!.items.find((i) => i.free)!;
    expect(free).toBeTruthy();
    expect(shopPrice(run, free)).toBe(0);
  });
});

describe('consumables', () => {
  test('Omens modify selected cards', () => {
    let run = startedRun('OMEN');
    const ids = setHand(run, ['KS', 'QH', '2D']);
    run.consumables.push({ uid: 'k1', id: 'omen_rose', kind: 'omen', edition: null });
    run = useConsumable(run, 'k1', [ids[0], ids[2]]).run;
    expect(run.deck.find((c) => c.id === ids[0])!.suit).toBe('H');
    expect(run.deck.find((c) => c.id === ids[2])!.suit).toBe('H');
    expect(run.consumables).toHaveLength(0);
    expect(run.stats.omensUsed).toBe(1);
  });

  test('selection limits are enforced', () => {
    const run = startedRun('SEL');
    run.consumables.push({ uid: 'k1', id: 'omen_glassblower', kind: 'omen', edition: null });
    expect(useConsumable(run, 'k1', run.round!.hand.slice(0, 2)).error).toBeTruthy();
    expect(useConsumable(run, 'k1', []).error).toBeTruthy();
  });

  test('Stars level hands; Reaper destroys; Twins duplicates; Mirror copies', () => {
    let run = startedRun('USE');
    run.consumables.push({ uid: 'k1', id: 'star_flush', kind: 'star', edition: null });
    run = useConsumable(run, 'k1').run;
    expect(run.handLevels.flush).toBe(2);
    expect(run.lastConsumable).toBe('star_flush');

    const ids = setHand(run, ['KS', 'QH', '2D']);
    const deck = run.deck.length;
    run.consumables.push({ uid: 'k2', id: 'omen_reaper', kind: 'omen', edition: null });
    run = useConsumable(run, 'k2', [ids[0]]).run;
    expect(run.deck.length).toBe(deck - 1);
    expect(run.round!.hand).not.toContain(ids[0]);

    run.consumables.push({ uid: 'k3', id: 'omen_twins', kind: 'omen', edition: null });
    run = useConsumable(run, 'k3', [ids[1]]).run;
    expect(run.deck.length).toBe(deck);
    expect(run.round!.hand.length).toBe(3);

    run.consumables.push({ uid: 'k4', id: 'omen_mirror', kind: 'omen', edition: null });
    run = useConsumable(run, 'k4', [ids[1], ids[2]]).run;
    const left = run.deck.find((c) => c.id === ids[1])!;
    expect(left.rank).toBe(2);
    expect(left.suit).toBe('D');
  });

  test('The Banker caps at +$20; The Echo repeats the last consumable', () => {
    let run = startedRun('BANK');
    run.money = 50;
    run.consumables.push({ uid: 'k1', id: 'omen_banker', kind: 'omen', edition: null });
    run = useConsumable(run, 'k1').run;
    expect(run.money).toBe(70);
    run.consumables.push({ uid: 'k2', id: 'omen_echo', kind: 'omen', edition: null });
    run = useConsumable(run, 'k2').run;
    expect(run.consumables.map((c) => c.id)).toEqual(['omen_banker']);
  });

  test('consumable slots are enforced on creation', () => {
    const run = startedRun('FULL');
    const g = new GameCtx(run);
    expect(g.createConsumable('omen')).toBe(true);
    expect(g.createConsumable('omen')).toBe(true);
    expect(g.createConsumable('omen')).toBe(false);
    expect(g.createConsumable('omen', undefined, 'void')).toBe(true);
    expect(run.consumables).toHaveLength(3);
  });

  test('every consumable can be used in a suitable context without throwing', async () => {
    const { CONSUMABLES } = await import('../src/engine/content/consumables');
    for (const def of CONSUMABLES) {
      let run = startedRun('C' + def.id);
      addCharm(run, 'lucky_penny');
      addCharm(run, 'brass_knuckles');
      run.consumables.push({ uid: 'kk', id: def.id, kind: def.kind, edition: null });
      if (def.id === 'omen_echo') run.lastConsumable = 'star_pair';
      const n = def.select ? def.select[1] : 0;
      const res = useConsumable(run, 'kk', run.round!.hand.slice(0, n));
      expect(res.error, def.id).toBeUndefined();
      expect(res.run.consumables.some((c) => c.uid === 'kk')).toBe(false);
    }
  });

  test('Violet seal creates an Omen on discard; Azure seal creates a Star at round end', () => {
    let run = startedRun('SEALS');
    const ids = setHand(run, [['KS', { s: 'violet' }], 'QH', ['2D', { s: 'azure' }]]);
    run = discardCards(run, [ids[0]]).run;
    expect(run.consumables.filter((c) => c.kind === 'omen')).toHaveLength(1);
    setTarget(run, 1);
    run.round!.hand = [ids[1], ids[2]];
    run = playHand(run, [ids[1]]).run;
    expect(run.consumables.some((c) => c.id === 'star_high')).toBe(true);
  });
});
