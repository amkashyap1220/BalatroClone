// Challenge runs: fixed starting setups with extra restrictions. Beat the target ante to complete.
import type { Card, Suit } from '../types';
import { RANKS, SUITS } from '../types';
import type { ChallengeDef } from './defs';
import { makeCard, standardDeck, hasRank } from '../cards';

export const CHALLENGES: ChallengeDef[] = [
  { id: 'glass_house', name: 'Glass House', deck: 'ivory', rules: ['Every card in your deck is a Crystal card.', 'Start with Glass Harmonica.'],
    desc: 'Huge multipliers, fragile deck. Can you finish before it all shatters?',
    build: (g) => standardDeck(g.run).map((c) => ({ ...c, enhancement: 'crystal' })), charms: [{ id: 'glass_harmonica' }] },
  { id: 'pauper', name: 'Pauper’s Run', deck: 'ivory', rules: ['Start with $0.', 'No interest is ever earned.', 'Charms sell for $1 at most.'],
    desc: 'Every coin counts.', money: 0, mods: (m) => { m.interestCap = 0; m.sellBonus -= 50; } },
  { id: 'fixed_hand', name: 'Fixed Hand', deck: 'ivory', rules: ['Start with Mimic, Snowball and Crowd Pleaser.', 'The shop never sells charms or Charm packs.'],
    desc: 'Make the most of the hand you’re dealt.', charms: [{ id: 'mimic' }, { id: 'snowball' }, { id: 'crowd' }], banShop: ['charm'] },
  { id: 'red_tide', name: 'Red Tide', deck: 'ivory', rules: ['Your deck holds only Hearts and Diamonds.', 'Start with Crimson Thread.'],
    desc: 'Flushes galore, but watch out for the Crimson and Gilt Veils.',
    build: (g) => { const out: Card[] = []; for (const s of ['H', 'D', 'H', 'D'] as Suit[]) for (const r of RANKS) out.push(makeCard(g.run, r, s)); return out; },
    charms: [{ id: 'crimson_thread' }] },
  { id: 'face_off', name: 'Face Off', deck: 'ivory', rules: ['Your deck is only Jacks, Queens, Kings and Aces (48 cards).'],
    desc: 'Royalty only. Straights are hard to come by.',
    build: (g) => { const out: Card[] = []; for (let k = 0; k < 3; k++) for (const s of SUITS) for (const r of [11, 12, 13, 14]) out.push(makeCard(g.run, r, s)); return out; } },
  { id: 'speedrun', name: 'One Shot', deck: 'ivory', rules: ['Only 1 hand per round.', '+4 hand size and +2 discards.', 'Win by beating Ante 6.'],
    desc: 'Every blind must fall to a single hand.', winAnte: 6, mods: (m) => { m.hands = 1; m.handSize += 4; m.discards += 2; } },
  { id: 'gauntlet', name: 'The Gauntlet', deck: 'ivory', rules: ['Bosses arrive in a fixed, punishing order.', 'Start with Boss Slayer.'],
    desc: 'Know your enemy, then overcome it.', charms: [{ id: 'boss_slayer' }],
    bossOrder: ['tollkeeper', 'silencer', 'hourglass', 'blackout', 'fog', 'purifier', 'narrow_gate', 'eclipse_queen'] },
  { id: 'minimalist', name: 'Minimalism', deck: 'ivory', rules: ['Only 2 Charm slots.', 'Start with Minimalist.'],
    desc: 'Less is more. Pick your two charms carefully.', charms: [{ id: 'minimalist' }], mods: (m) => { m.charmSlots = Math.min(m.charmSlots, 2); } },
  { id: 'no_discards', name: 'No Take-Backs', deck: 'ivory', rules: ['You have no discards.', '+1 hand each round.', 'Start with Purist.'],
    desc: 'Play what you draw.', charms: [{ id: 'purist' }], mods: (m) => { m.discards = 0; m.hands += 1; } },
  { id: 'cosmic', name: 'Cosmic Drift', deck: 'ivory', rules: ['Start with 2 Black Sun Hexes.', 'Stars never appear in the shop or packs.'],
    desc: 'Your hands only grow through the void.', consumables: ['hex_blacksun', 'hex_blacksun'], mods: (m) => { m.starRate = 0; } },
  { id: 'club_ban', name: 'Clubs Banned', deck: 'ivory', rules: ['All Clubs are permanently debuffed.', 'Start with Blurred Ink.'],
    desc: 'A quarter of your deck is dead weight... unless you blur the lines.',
    charms: [{ id: 'blurred_ink' }], debuff: (c) => hasRank(c) && c.suit === 'C' },
  { id: 'inflation', name: 'Inflation', deck: 'ivory', rules: ['Every purchase permanently raises shop prices by $1.', 'Start with $10.'],
    desc: 'Prices only go up. Buy wisely.', money: 10, mods: (m, run) => { m.shopDiscount -= run.flags.inflation ?? 0; } },
];

export const CHALLENGE_MAP: Record<string, ChallengeDef> = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));
