import type { Card, HandType } from './types';
import { HAND_ORDER, SUITS } from './types';
import { hasRank, suitIs } from './cards';

export interface HandInfo {
  name: string;
  chips: number;
  mult: number;
  lvlChips: number;
  lvlMult: number;
  desc: string;
}

/** Base values for each poker hand. Levels add lvlChips/lvlMult per level above 1. */
export const HANDS: Record<HandType, HandInfo> = {
  high: { name: 'High Card', chips: 5, mult: 1, lvlChips: 10, lvlMult: 1, desc: 'Your single highest card scores.' },
  pair: { name: 'Pair', chips: 10, mult: 2, lvlChips: 15, lvlMult: 1, desc: 'Two cards of the same rank.' },
  twopair: { name: 'Two Pair', chips: 20, mult: 2, lvlChips: 20, lvlMult: 1, desc: 'Two different pairs.' },
  three: { name: 'Three of a Kind', chips: 30, mult: 3, lvlChips: 20, lvlMult: 2, desc: 'Three cards of the same rank.' },
  straight: { name: 'Straight', chips: 35, mult: 4, lvlChips: 30, lvlMult: 3, desc: 'Five cards in consecutive rank order. Aces may be high or low.' },
  flush: { name: 'Flush', chips: 35, mult: 4, lvlChips: 15, lvlMult: 2, desc: 'Five cards of the same suit.' },
  full: { name: 'Full House', chips: 45, mult: 4, lvlChips: 25, lvlMult: 2, desc: 'Three of a kind together with a pair.' },
  four: { name: 'Four of a Kind', chips: 60, mult: 7, lvlChips: 30, lvlMult: 3, desc: 'Four cards of the same rank.' },
  sflush: { name: 'Straight Flush', chips: 100, mult: 8, lvlChips: 40, lvlMult: 4, desc: 'A straight where every card shares one suit.' },
  royal: { name: 'Royal Flush', chips: 125, mult: 10, lvlChips: 50, lvlMult: 4, desc: 'Ten, Jack, Queen, King and Ace of one suit.' },
  five: { name: 'Five of a Kind', chips: 140, mult: 12, lvlChips: 40, lvlMult: 3, desc: 'Five cards of the same rank. Only possible with duplicated or altered cards.' },
};

export function handBase(type: HandType, level: number): { chips: number; mult: number } {
  const h = HANDS[type];
  const l = Math.max(1, level) - 1;
  return { chips: h.chips + h.lvlChips * l, mult: h.mult + h.lvlMult * l };
}

export interface HandEval {
  type: HandType;
  scoring: Card[];
  contains: Set<HandType>;
}

function findStraight(ranked: Card[], need: number, gap: number): Card[] | null {
  if (ranked.length < need) return null;
  const vals = new Set<number>();
  for (const c of ranked) {
    vals.add(c.rank);
    if (c.rank === 14) vals.add(1);
  }
  const sorted = [...vals].sort((a, b) => a - b);
  let best: number[] = [];
  let cur: number[] = [];
  for (const v of sorted) {
    if (cur.length && v - cur[cur.length - 1] <= gap) cur.push(v);
    else cur = [v];
    if (cur.length >= best.length) best = cur.slice();
  }
  if (best.length < need) return null;
  // If the chain is longer than needed, keep the highest `need`-length window... all cards still in chain score.
  const chain = new Set(best);
  return ranked.filter((c) => chain.has(c.rank) || (c.rank === 14 && chain.has(1)));
}

function findFlush(ranked: Card[], need: number, rules: Set<string>): Card[] | null {
  if (ranked.length < need) return null;
  let best: Card[] = [];
  for (const s of SUITS) {
    const m = ranked.filter((c) => suitIs(c, s, rules));
    if (m.length > best.length) best = m;
  }
  return best.length >= need ? best : null;
}

/**
 * Identify the best poker hand among the played cards.
 * Monolith cards have no rank or suit: they never help form a hand but always score.
 */
export function evaluateHand(cards: Card[], rules: Set<string> = new Set(), debuffedIds: Set<string> = new Set()): HandEval {
  const ranked = cards.filter(hasRank);
  const need = rules.has('shortHand') ? 4 : 5;
  const gap = rules.has('bridge') ? 2 : 1;

  const groups = new Map<number, Card[]>();
  for (const c of ranked) {
    const g = groups.get(c.rank) ?? [];
    g.push(c);
    groups.set(c.rank, g);
  }
  const sortedGroups = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);
  const c0 = sortedGroups[0]?.length ?? 0;
  const c1 = sortedGroups[1]?.length ?? 0;

  // Debuffed prism cards lose their wildness.
  const flushRules = rules;
  const flushCards = findFlush(
    ranked.map((c) => (debuffedIds.has(c.id) && c.enhancement === 'prism' ? { ...c, enhancement: null } : c)),
    need,
    flushRules,
  );
  const flushIds = flushCards ? new Set(flushCards.map((c) => c.id)) : null;
  const straightCards = findStraight(ranked, need, gap);

  const contains = new Set<HandType>(['high']);
  if (c0 >= 2) contains.add('pair');
  if (c0 >= 2 && c1 >= 2) contains.add('twopair');
  if (c0 >= 3) contains.add('three');
  if (c0 >= 4) contains.add('four');
  if (c0 >= 5) contains.add('five');
  if (c0 >= 3 && c1 >= 2) contains.add('full');
  if (flushCards) contains.add('flush');
  if (straightCards) contains.add('straight');
  let royal = false;
  if (flushCards && straightCards) {
    contains.add('sflush');
    const ranks = straightCards.map((c) => c.rank);
    if (Math.max(...ranks) === 14 && Math.min(...ranks) >= 10) {
      royal = true;
      contains.add('royal');
    }
  }

  let type: HandType = 'high';
  let scoring: Card[] = [];
  const union = (a: Card[], b: Card[]) => {
    const ids = new Set([...a, ...b].map((c) => c.id));
    return cards.filter((c) => ids.has(c.id));
  };
  if (c0 >= 5) {
    type = 'five';
    scoring = sortedGroups[0];
  } else if (royal && flushCards && straightCards) {
    type = 'royal';
    scoring = union(flushCards, straightCards);
  } else if (flushCards && straightCards) {
    type = 'sflush';
    scoring = union(flushCards, straightCards);
  } else if (c0 >= 4) {
    type = 'four';
    scoring = sortedGroups[0];
  } else if (c0 >= 3 && c1 >= 2) {
    type = 'full';
    scoring = [...sortedGroups[0], ...sortedGroups[1]];
  } else if (flushCards) {
    type = 'flush';
    scoring = flushCards;
  } else if (straightCards) {
    type = 'straight';
    scoring = straightCards;
  } else if (c0 >= 3) {
    type = 'three';
    scoring = sortedGroups[0];
  } else if (c0 >= 2 && c1 >= 2) {
    type = 'twopair';
    scoring = [...sortedGroups[0], ...sortedGroups[1]];
  } else if (c0 >= 2) {
    type = 'pair';
    scoring = sortedGroups[0];
  } else if (ranked.length) {
    type = 'high';
    const top = ranked.reduce((a, b) => (b.rank > a.rank ? b : a));
    scoring = [top];
  }
  void flushIds;

  let ids = new Set(scoring.map((c) => c.id));
  for (const c of cards) if (!hasRank(c)) ids.add(c.id); // Monoliths always score
  if (rules.has('openBook')) ids = new Set(cards.map((c) => c.id));
  // Preserve play order (left to right).
  return { type, scoring: cards.filter((c) => ids.has(c.id)), contains };
}

export function handRank(t: HandType): number {
  return HAND_ORDER.indexOf(t);
}
