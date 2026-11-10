// Starting deck variants.
import type { Card, Suit } from '../types';
import { HAND_ORDER, RANKS, SUITS } from '../types';
import type { DeckDef } from './defs';
import { makeCard, standardDeck } from '../cards';
import { ENHANCEMENT_IDS, SEAL_IDS } from './modifications';

export const DECKS: DeckDef[] = [
  { id: 'ivory', name: 'Ivory Deck', desc: 'A standard 52-card deck. No tricks.',
    strategy: 'Balanced. Learn the ropes and adapt to whatever the shop offers.', colors: ['#f4ead5', '#c8a96a'], pattern: 'lattice' },
  { id: 'treasury', name: 'Treasury Deck', desc: 'Start with $10 extra. Interest cap +$5. Small blinds pay no reward.',
    strategy: 'High economy. Bank money early and snowball interest into a strong shop.', colors: ['#2d6a4f', '#ffd166'], pattern: 'coins',
    setup: (g) => { g.run.money += 10; },
    mods: (m) => { m.interestCap += 5; m.rules.add('noSmallReward'); } },
  { id: 'gambit', name: 'Gambit Deck', desc: 'Every face card starts as a Crystal card (×2 Mult, may shatter). −1 discard.',
    strategy: 'High risk. Early power from Crystal faces; protect them or replace them before they break.', colors: ['#7ad7f0', '#3a0ca3'], pattern: 'shards',
    build: (g) => standardDeck(g.run).map((c) => (c.rank >= 11 && c.rank <= 13 ? { ...c, enhancement: 'crystal' } : c)),
    mods: (m) => { m.discards -= 1; } },
  { id: 'artisan', name: 'Artisan Deck', desc: '16 random cards start with enhancements. Start with $0.',
    strategy: 'Enhanced cards from turn one. Synergises with enhancement-counting charms.', colors: ['#9d4edd', '#ffb703'], pattern: 'chevron', unlock: 'ach_ante4',
    build: (g) => {
      const deck = standardDeck(g.run);
      const idx = deck.map((_, i) => i);
      for (let i = 0; i < 16; i++) {
        const j = i + Math.floor(g.rand('setup') * (idx.length - i));
        [idx[i], idx[j]] = [idx[j], idx[i]];
        deck[idx[i]].enhancement = ENHANCEMENT_IDS[Math.floor(g.rand('setup') * ENHANCEMENT_IDS.length)];
      }
      return deck;
    },
    setup: (g) => { g.run.money = 0; } },
  { id: 'pocket', name: 'Pocket Deck', desc: 'No 2s, 3s or 4s: a lean 40-card deck. −1 discard.',
    strategy: 'Reduced size. Pairs and high cards appear far more often.', colors: ['#264653', '#e9c46a'], pattern: 'dots', unlock: 'ach_win',
    build: (g) => standardDeck(g.run).filter((c) => c.rank > 4),
    mods: (m) => { m.discards -= 1; } },
  { id: 'twinned', name: 'Twinned Deck', desc: 'Only Hearts and Spades, two of every card.',
    strategy: 'Suit-specialised. Flushes everywhere, but a single suit-veil Boss hurts twice as much.', colors: ['#d62828', '#1d3557'], pattern: 'split', unlock: 'ach_flush',
    build: (g) => {
      const out: Card[] = [];
      for (const s of ['H', 'S'] as Suit[]) for (const r of RANKS) { out.push(makeCard(g.run, r, s)); out.push(makeCard(g.run, r, s)); }
      return out;
    } },
  { id: 'court', name: 'Court Deck', desc: 'Every 2–5 is replaced by a random face card or Ace.',
    strategy: 'Rank-specialised. Face-card and Ace synergies are everywhere; straights are rare.', colors: ['#5f0f40', '#fb8b24'], pattern: 'crown', unlock: 'ach_faces',
    build: (g) => standardDeck(g.run).map((c) => (c.rank <= 5 ? { ...c, rank: 11 + Math.floor(g.rand('setup') * 4) } : c)) },
  { id: 'chaos', name: 'Chaos Deck', desc: 'Every card has a random rank and suit. Start with an extra consumable slot.',
    strategy: 'Randomised. No two runs alike: read your deck and adapt.', colors: ['#ff006e', '#3a86ff'], pattern: 'noise', unlock: 'ach_ante6',
    build: (g) => standardDeck(g.run).map((c) => ({ ...c, rank: 2 + Math.floor(g.rand('setup') * 13), suit: SUITS[Math.floor(g.rand('setup') * 4)] })),
    mods: (m) => { m.consumableSlots += 1; } },
  { id: 'starlit', name: 'Starlit Deck', desc: 'Every poker hand starts at level 2. Stars appear half as often.',
    strategy: 'A head start on scoring; lean on charms more than Stars to scale.', colors: ['#03045e', '#90e0ef'], pattern: 'stars', unlock: 'ach_stars10',
    setup: (g) => { for (const h of HAND_ORDER) g.run.handLevels[h] = 2; },
    mods: (m) => { m.starRate *= 0.5; } },
  { id: 'void', name: 'Void Deck', desc: '+1 Charm slot. −1 hand size.',
    strategy: 'Charm-heavy builds. Fewer cards in hand means you need a focused plan.', colors: ['#10002b', '#c77dff'], pattern: 'void', unlock: 'ach_charms5',
    mods: (m) => { m.charmSlots += 1; m.handSize -= 1; } },
  { id: 'merchant', name: 'Merchant’s Deck', desc: '+1 shop slot and rerolls cost $2 less. Start with $0.',
    strategy: 'Shop manipulation. Dig through the shop for exactly what you need.', colors: ['#bc6c25', '#fefae0'], pattern: 'stripes', unlock: 'ach_rich',
    setup: (g) => { g.run.money = 0; },
    mods: (m) => { m.shopSlots += 1; m.rerollDiscount += 2; } },
  { id: 'wax', name: 'Wax Deck', desc: '12 random cards start with random seals. −1 hand.',
    strategy: 'Seal synergies: retriggers, money and free consumables from the start.', colors: ['#9b2226', '#ee9b00'], pattern: 'wax', unlock: 'ach_boss5',
    build: (g) => {
      const deck = standardDeck(g.run);
      for (let i = 0; i < 12; i++) {
        const c = deck[Math.floor(g.rand('setup') * deck.length)];
        c.seal = SEAL_IDS[Math.floor(g.rand('setup') * SEAL_IDS.length)];
      }
      return deck;
    },
    mods: (m) => { m.hands -= 1; } },
];

export const DECK_MAP: Record<string, DeckDef> = Object.fromEntries(DECKS.map((d) => [d.id, d]));
