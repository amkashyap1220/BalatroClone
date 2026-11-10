import { playHand, createRun, selectBlind } from '../src/engine/run';
import { addCharm, setHand, startedRun, setTarget } from './helpers';
import type { RunState } from '../src/engine/types';

function play(run: RunState, specs: Parameters<typeof setHand>[1], n = specs.length) {
  setTarget(run, 1e12);
  const ids = setHand(run, specs);
  const res = playHand(run, ids.slice(0, n));
  if (res.error) throw new Error(res.error);
  return res;
}

describe('scoring pipeline', () => {
  test('Pair of Kings = (10 + 10 + 10) × 2', () => {
    const res = play(startedRun(), ['KS', 'KH', '3D'], 2);
    expect(res.score!.hand).toBe('pair');
    expect(res.score!.chips).toBe(30);
    expect(res.score!.mult).toBe(2);
    expect(res.score!.total).toBe(60);
    expect(res.run.round!.score).toBe(60);
  });

  test('Aces count 11 chips, kickers ignored', () => {
    const res = play(startedRun(), ['AS', 'AH', 'KD', 'QD', '2C']);
    expect(res.score!.total).toBe((10 + 22) * 2);
  });

  test('enhancements: Plated chips, Ember mult, Crystal ×2, Monolith', () => {
    const r1 = play(startedRun(), [['KS', { e: 'plated' }], 'KH'], 2);
    expect(r1.score!.total).toBe((30 + 30) * 2);
    const r2 = play(startedRun(), [['KS', { e: 'ember' }], 'KH'], 2);
    expect(r2.score!.total).toBe(30 * 6);
    const r3 = play(startedRun(), [['KS', { e: 'crystal' }], 'KH'], 2);
    expect(r3.score!.total).toBe(30 * 4);
    const r4 = play(startedRun(), ['KS', 'KH', ['2D', { e: 'monolith' }]], 3);
    expect(r4.score!.total).toBe((30 + 50) * 2);
  });

  test('editions: Shimmer, Aurora, Spectrum, Gilt', () => {
    expect(play(startedRun(), [['KS', { ed: 'shimmer' }], 'KH'], 2).score!.total).toBe(80 * 2);
    expect(play(startedRun(), [['KS', { ed: 'aurora' }], 'KH'], 2).score!.total).toBe(30 * 12);
    expect(play(startedRun(), [['KS', { ed: 'spectrum' }], 'KH'], 2).score!.total).toBe(30 * 3);
    const run = startedRun();
    const money = run.money;
    const r = play(run, [['KS', { ed: 'gilt' }], 'KH'], 2);
    expect(r.run.money).toBe(money + 2);
  });

  test('enhancement applies before edition within a card (order matters)', () => {
    // Ember (+4) then Spectrum (×1.5): (2 + 4) × 1.5 = 9 mult
    const r = play(startedRun(), [['KS', { e: 'ember', ed: 'spectrum' }], 'KH'], 2);
    expect(r.score!.mult).toBeCloseTo(9);
  });

  test('seals: Ruby retriggers, Golden pays, Jade grows', () => {
    expect(play(startedRun(), [['KS', { s: 'ruby' }], 'KH'], 2).score!.total).toBe(40 * 2);
    const run = startedRun();
    const m = run.money;
    expect(play(run, [['KS', { s: 'golden' }], 'KH'], 2).run.money).toBe(m + 3);
    const r = play(startedRun(), [['KS', { s: 'jade' }], 'KH'], 2);
    const card = r.run.deck.find((c) => c.id === r.score!.scoringIds[0])!;
    expect(card.bonusChips).toBe(6);
  });

  test('Echo edition and Ruby seal stack retriggers', () => {
    const r = play(startedRun(), [['KS', { s: 'ruby', ed: 'echo' }], 'KH'], 2);
    expect(r.score!.chips).toBe(10 + 30 + 10);
  });

  test('held-in-hand: Iron ×1.5, Magnet +4, Silver seal', () => {
    expect(play(startedRun(), ['KS', 'KH', ['2D', { e: 'iron' }]], 2).score!.total).toBe(30 * 3);
    expect(play(startedRun(), ['KS', 'KH', ['2D', { e: 'magnet' }]], 2).score!.total).toBe(30 * 6);
    // Silver seal on an Iron card: +3 Mult, and Iron triggers twice: (2 × 1.5 + 3) × 1.5 = 9
    expect(play(startedRun(), ['KS', 'KH', ['2D', { e: 'iron', s: 'silver' }]], 2).score!.mult).toBeCloseTo(9);
  });

  test('charm order matters: additive before multiplicative', () => {
    const a = startedRun('ORDER');
    addCharm(a, 'lucky_penny');
    addCharm(a, 'kinship_locket');
    const ra = play(a, ['KS', 'KH'], 2);
    expect(ra.score!.mult).toBeCloseTo((2 + 4) * 1.5);
    const b = startedRun('ORDER');
    addCharm(b, 'kinship_locket');
    addCharm(b, 'lucky_penny');
    const rb = play(b, ['KS', 'KH'], 2);
    expect(rb.score!.mult).toBeCloseTo(2 * 1.5 + 4);
  });

  test('per-card charm effects run on every retrigger', () => {
    const run = startedRun();
    addCharm(run, 'courtier'); // face +4 mult
    addCharm(run, 'portrait_gallery'); // retrigger faces
    const r = play(run, ['KS', 'KH'], 2);
    // each K scores twice (10 chips, +4 mult)
    expect(r.score!.chips).toBe(10 + 40);
    expect(r.score!.mult).toBe(2 + 16);
  });

  test('debuffed cards contribute nothing', () => {
    let run = createRun({ seed: 'DEBUFF' });
    run.blindIndex = 2;
    run.bossId = 'crimson_veil';
    run = selectBlind(run).run;
    const r = play(run, ['KH', 'KS'], 2);
    expect(r.score!.total).toBe((10 + 10) * 2);
    expect(r.score!.steps.some((s) => s.text === 'Debuffed')).toBe(true);
  });

  test('Mimic copies the charm to its right', () => {
    const run = startedRun();
    addCharm(run, 'mimic');
    addCharm(run, 'lucky_penny');
    expect(play(run, ['KS', 'KH'], 2).score!.mult).toBe(2 + 4 + 4);
  });

  test('Mimic chains through another Mimic and stops at the end', () => {
    const run = startedRun();
    addCharm(run, 'mimic');
    addCharm(run, 'mimic');
    addCharm(run, 'lucky_penny');
    expect(play(run, ['KS', 'KH'], 2).score!.mult).toBe(2 + 12);
    const lone = startedRun();
    addCharm(lone, 'lucky_penny');
    addCharm(lone, 'mimic');
    expect(play(lone, ['KS', 'KH'], 2).score!.mult).toBe(6);
  });

  test('charm editions: Shimmer and Aurora before ability, Spectrum after', () => {
    const run = startedRun();
    addCharm(run, 'lucky_penny', 'spectrum');
    expect(play(run, ['KS', 'KH'], 2).score!.mult).toBeCloseTo((2 + 4) * 1.5);
    const run2 = startedRun();
    addCharm(run2, 'kinship_locket', 'aurora');
    expect(play(run2, ['KS', 'KH'], 2).score!.mult).toBeCloseTo((2 + 10) * 1.5);
  });

  test('hand levels raise base chips and mult', () => {
    const run = startedRun();
    run.handLevels.pair = 3;
    const r = play(run, ['KS', 'KH'], 2);
    expect(r.score!.total).toBe((10 + 30 + 20) * 4);
  });

  test('step log is transparent: last step totals and chips/mult trail match result', () => {
    const run = startedRun();
    addCharm(run, 'lucky_penny');
    addCharm(run, 'brass_knuckles');
    const r = play(run, [['KS', { e: 'plated', ed: 'aurora', s: 'ruby' }], 'KH'], 2);
    const last = r.score!.steps[r.score!.steps.length - 1];
    expect(last.kind).toBe('final');
    expect(Math.floor(last.chipsAfter * last.multAfter)).toBe(r.score!.total);
    expect(r.score!.steps[0].kind).toBe('base');
  });

  test('scoring is deterministic for the same seed', () => {
    const mk = () => {
      const run = startedRun('DET');
      addCharm(run, 'revolver');
      addCharm(run, 'coin_flip');
      return play(run, [['KS', { e: 'fortune' }], ['KH', { e: 'crystal' }]], 2).score!;
    };
    expect(mk()).toEqual(mk());
  });

  test('Crystal cards can shatter and are removed from the deck', () => {
    let shattered = 0;
    for (let i = 0; i < 40; i++) {
      const run = startedRun('GLASS' + i);
      const r = play(run, [['KS', { e: 'crystal' }], 'KH'], 2);
      if (r.score!.destroyed.length) {
        shattered++;
        expect(r.run.deck.some((c) => c.id === r.score!.destroyed[0])).toBe(false);
        expect(r.run.round!.discardPile).not.toContain(r.score!.destroyed[0]);
      }
    }
    expect(shattered).toBeGreaterThan(2);
    expect(shattered).toBeLessThan(25);
  });

  test('Glass Menagerie prevents shattering and uses ×1.5', () => {
    for (let i = 0; i < 20; i++) {
      const run = startedRun('MEN' + i);
      addCharm(run, 'glass_menagerie');
      const r = play(run, [['KS', { e: 'crystal' }], 'KH'], 2);
      expect(r.score!.destroyed).toHaveLength(0);
      expect(r.score!.mult).toBeCloseTo(3);
    }
  });

  test('retrigger + held retrigger with Reverb', () => {
    const run = startedRun();
    addCharm(run, 'reverb');
    const r = play(run, ['KS', 'KH', ['2D', { e: 'iron' }]], 2);
    expect(r.score!.mult).toBeCloseTo(2 * 1.5 * 1.5);
  });

  test('scaling charm state persists across hands', () => {
    const run = startedRun();
    addCharm(run, 'snowball');
    const r1 = play(run, ['KS', 'KH'], 2);
    expect(r1.score!.mult).toBe(2 + 1);
    const r2 = play(r1.run, ['QS', 'QH'], 2);
    expect(r2.score!.mult).toBe(2 + 2);
  });
});
