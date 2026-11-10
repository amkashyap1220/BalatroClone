import type { Card, Suit, RunState } from './types';
import { SUITS, RANKS } from './types';

export const RANK_NAMES: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export const RANK_LONG: Record<number, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace',
};
export const SUIT_NAMES: Record<Suit, string> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };
export const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };

export function isRed(s: Suit): boolean {
  return s === 'H' || s === 'D';
}

export function rankChips(rank: number): number {
  if (rank === 14) return 11;
  if (rank >= 11) return 10;
  return rank;
}

export function newId(run: RunState, prefix = 'c'): string {
  run.uid += 1;
  return `${prefix}${run.uid}`;
}

export function makeCard(run: RunState, rank: number, suit: Suit, extra: Partial<Card> = {}): Card {
  return {
    id: newId(run, 'c'),
    rank,
    suit,
    enhancement: null,
    edition: null,
    seal: null,
    bonusChips: 0,
    bonusMult: 0,
    ...extra,
  };
}

export function standardDeck(run: RunState): Card[] {
  const cards: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) cards.push(makeCard(run, r, s));
  return cards;
}

export function copyCard(run: RunState, card: Card): Card {
  return { ...card, id: newId(run, 'c') };
}

export function cardLabel(c: Card): string {
  if (c.enhancement === 'monolith') return 'Monolith';
  return `${RANK_NAMES[c.rank]}${SUIT_SYMBOLS[c.suit]}`;
}

export function cardName(c: Card): string {
  if (c.enhancement === 'monolith') return 'Monolith Card';
  return `${RANK_LONG[c.rank]} of ${SUIT_NAMES[c.suit]}`;
}

/** Rules-aware helpers shared by hand detection, scoring and charms. */
export interface CardRules {
  rules: Set<string>;
}

export function hasRank(c: Card): boolean {
  return c.enhancement !== 'monolith';
}

export function isFace(c: Card, rules: Set<string>): boolean {
  if (!hasRank(c)) return false;
  if (rules.has('masquerade')) return true;
  return c.rank >= 11 && c.rank <= 13;
}

export function canonicalSuit(s: Suit, rules: Set<string>): Suit {
  if (rules.has('blurred')) {
    if (s === 'D') return 'H';
    if (s === 'C') return 'S';
  }
  return s;
}

/** Does this card count as the given suit? Prism (wild) cards count as every suit. */
export function suitIs(c: Card, suit: Suit, rules: Set<string>, debuffed = false): boolean {
  if (!hasRank(c)) return false;
  if (c.enhancement === 'prism' && !debuffed) return true;
  return canonicalSuit(c.suit, rules) === canonicalSuit(suit, rules);
}

export function isEven(c: Card): boolean {
  return hasRank(c) && c.rank <= 10 && c.rank % 2 === 0;
}
export function isOdd(c: Card): boolean {
  return hasRank(c) && (c.rank === 14 || (c.rank <= 10 && c.rank % 2 === 1));
}
export function isNumber(c: Card): boolean {
  return hasRank(c) && c.rank <= 10;
}
