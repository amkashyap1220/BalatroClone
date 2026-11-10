import { evaluateHand, handBase, HANDS } from '../src/engine/hands';
import { createRun } from '../src/engine/run';
import { cards, parse } from './helpers';

const run = createRun({ seed: 'HANDS' });
const ev = (specs: string[], rules: string[] = []) => evaluateHand(cards(run, specs), new Set(rules));

describe('poker hand detection', () => {
  test.each([
    [['AS'], 'high'],
    [['2S', '9H', 'KD', '4C', '7S'], 'high'],
    [['KS', 'KH'], 'pair'],
    [['KS', 'KH', '3D', '3C', '9S'], 'twopair'],
    [['7S', '7H', '7D', '2C'], 'three'],
    [['5S', '6H', '7D', '8C', '9S'], 'straight'],
    [['AS', '2H', '3D', '4C', '5S'], 'straight'],
    [['10S', 'JH', 'QD', 'KC', 'AS'], 'straight'],
    [['2H', '7H', '9H', 'JH', 'KH'], 'flush'],
    [['9S', '9H', '9D', '4C', '4S'], 'full'],
    [['QS', 'QH', 'QD', 'QC', '2S'], 'four'],
    [['5H', '6H', '7H', '8H', '9H'], 'sflush'],
    [['10D', 'JD', 'QD', 'KD', 'AD'], 'royal'],
    [['4S', '4H', '4D', '4C', '4S'], 'five'],
  ])('%j → %s', (specs, expected) => {
    expect(ev(specs as string[]).type).toBe(expected);
  });

  test('straights do not wrap around', () => {
    expect(ev(['QS', 'KH', 'AD', '2C', '3S']).type).toBe('high');
  });

  test('four-card straights/flushes are not hands without Short Hand', () => {
    expect(ev(['5S', '6H', '7D', '8C']).type).toBe('high');
    expect(ev(['5S', '6H', '7D', '8C'], ['shortHand']).type).toBe('straight');
    expect(ev(['2H', '5H', '9H', 'KH', '3S'], ['shortHand']).type).toBe('flush');
  });

  test('Rope Bridge allows skipping single ranks', () => {
    expect(ev(['2S', '4H', '6D', '8C', '10S']).type).toBe('high');
    expect(ev(['2S', '4H', '6D', '8C', '10S'], ['bridge']).type).toBe('straight');
    expect(ev(['2S', '5H', '6D', '7C', '8S'], ['bridge']).type).toBe('high');
  });

  test('Blurred Ink merges red and black suits', () => {
    expect(ev(['2H', '5D', '9H', 'KD', '3H']).type).toBe('high');
    expect(ev(['2H', '5D', '9H', 'KD', '3H'], ['blurred']).type).toBe('flush');
  });

  test('Prism cards count as every suit, unless debuffed', () => {
    const cs = [parse(run, '2H'), parse(run, '5H'), parse(run, '9H'), parse(run, 'KH'), parse(run, '3S', { e: 'prism' })];
    expect(evaluateHand(cs).type).toBe('flush');
    expect(evaluateHand(cs, new Set(), new Set([cs[4].id])).type).toBe('high');
  });

  test('Monolith cards have no rank but always score', () => {
    const mono = parse(run, '2S', { e: 'monolith' });
    const cs = [parse(run, 'KS'), parse(run, 'KH'), mono];
    const res = evaluateHand(cs);
    expect(res.type).toBe('pair');
    expect(res.scoring.map((c) => c.id)).toContain(mono.id);
    // Two monoliths with the same underlying rank do not form a pair
    expect(evaluateHand([parse(run, '2S', { e: 'monolith' }), parse(run, '2H', { e: 'monolith' })]).type).toBe('high');
  });

  test('only the relevant cards score; kickers do not', () => {
    const cs = cards(run, ['KS', 'KH', '3D', '7C', '9S']);
    const res = evaluateHand(cs);
    expect(res.scoring.map((c) => c.id)).toEqual([cs[0].id, cs[1].id]);
    const hc = evaluateHand(cards(run, ['2S', '9H', 'KD']));
    expect(hc.scoring).toHaveLength(1);
    expect(hc.scoring[0].rank).toBe(13);
  });

  test('Open Book makes every played card score', () => {
    const cs = cards(run, ['KS', 'KH', '3D', '7C', '9S']);
    expect(evaluateHand(cs, new Set(['openBook'])).scoring).toHaveLength(5);
  });

  test('contains-set reports sub-hands', () => {
    const res = ev(['9S', '9H', '9D', '4C', '4S']);
    expect([...res.contains].sort()).toEqual(['full', 'high', 'pair', 'three', 'twopair'].sort());
    expect(ev(['5H', '6H', '7H', '8H', '9H']).contains.has('flush')).toBe(true);
    expect(ev(['5H', '6H', '7H', '8H', '9H']).contains.has('straight')).toBe(true);
  });

  test('modified ranks are recognised (transformed cards)', () => {
    const cs = cards(run, ['KS', 'QH']);
    cs[1].rank = 13;
    expect(evaluateHand(cs).type).toBe('pair');
  });

  test('hand ranking order and level scaling', () => {
    expect(handBase('pair', 1)).toEqual({ chips: 10, mult: 2 });
    expect(handBase('pair', 3)).toEqual({ chips: 10 + 2 * HANDS.pair.lvlChips, mult: 2 + 2 * HANDS.pair.lvlMult });
    expect(handBase('royal', 1).chips).toBeGreaterThan(handBase('sflush', 1).chips);
  });
});
