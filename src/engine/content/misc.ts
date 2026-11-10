// Tokens (blind skip rewards), packs and heat (difficulty) levels.
import type { HandType } from '../types';
import { HAND_ORDER } from '../types';
import type { HeatDef, PackDef, TokenDef } from './defs';

export const TOKENS: TokenDef[] = [
  { id: 'tok_cash', name: 'Cash Token', desc: 'Earn $10 right away.', icon: { glyph: '$', hue: 110 }, instant: (g) => g.addMoney(10) },
  { id: 'tok_double', name: 'Doubler', desc: 'Double your money (max +$40).', icon: { glyph: '×2', hue: 50 }, minAnte: 2,
    instant: (g) => g.addMoney(Math.min(40, Math.max(0, g.run.money))) },
  { id: 'tok_handy', name: 'Hand Count', desc: 'Earn $1 for every hand played this run (max $30).', icon: { glyph: '✋', hue: 30 }, minAnte: 2,
    instant: (g) => g.addMoney(Math.min(30, g.run.stats.handsPlayed)) },
  { id: 'tok_rare', name: 'Rare Ticket', desc: 'The next shop has a free Rare charm.', icon: { glyph: '★', hue: 0 }, trigger: 'shop' },
  { id: 'tok_uncommon', name: 'Uncommon Ticket', desc: 'The next shop has a free Uncommon charm.', icon: { glyph: '☆', hue: 140 }, trigger: 'shop' },
  { id: 'tok_spectrum', name: 'Spectrum Ticket', desc: 'The next shop has a free Spectrum charm.', icon: { glyph: '❂', hue: 290 }, trigger: 'shop', minAnte: 2 },
  { id: 'tok_coupon', name: 'Coupon', desc: 'Charms and consumables in the next shop are free (before rerolling).', icon: { glyph: '✄', hue: 330 }, trigger: 'shop' },
  { id: 'tok_reroll', name: 'Reroll Voucher', desc: 'The next shop starts with 3 free rerolls.', icon: { glyph: '↻', hue: 180 }, trigger: 'shop' },
  { id: 'tok_omen', name: 'Omen Pack Token', desc: 'Open a free Mega Omen Pack right now.', icon: { glyph: '☉', hue: 280 }, instant: (g) => { g.run.packQueue.push('omen_mega'); } },
  { id: 'tok_star', name: 'Star Pack Token', desc: 'Open a free Mega Star Pack right now.', icon: { glyph: '✦', hue: 220 }, instant: (g) => { g.run.packQueue.push('star_mega'); } },
  { id: 'tok_hex', name: 'Hex Pack Token', desc: 'Open a free Hex Pack right now.', icon: { glyph: '⛧', hue: 260 }, minAnte: 2, instant: (g) => { g.run.packQueue.push('hex_jumbo'); } },
  { id: 'tok_charm', name: 'Charm Pack Token', desc: 'Open a free Jumbo Charm Pack right now.', icon: { glyph: '♣', hue: 30 }, instant: (g) => { g.run.packQueue.push('charm_jumbo'); } },
  { id: 'tok_cards', name: 'Card Pack Token', desc: 'Open a free Mega Card Pack right now.', icon: { glyph: '▭', hue: 10 }, instant: (g) => { g.run.packQueue.push('card_mega'); } },
  { id: 'tok_invest', name: 'Investment', desc: 'Earn $25 after you defeat this ante’s Boss.', icon: { glyph: '⇗', hue: 120 }, trigger: 'boss' },
  { id: 'tok_ascend', name: 'Ascension', desc: 'Level up your most played hand twice.', icon: { glyph: '⇧', hue: 200 },
    instant: (g) => g.levelHand(g.mostPlayedHand(), 2) },
  { id: 'tok_juggle', name: 'Juggle', desc: '+3 hand size for your next round.', icon: { glyph: '⚬', hue: 60 }, trigger: 'round' },
  { id: 'tok_boss', name: 'Boss Reroll', desc: 'Reroll this ante’s Boss blind.', icon: { glyph: '⟳', hue: 0 }, instant: (g) => { g.run.flags.rerollBoss = 1; } },
];
export const TOKEN_MAP: Record<string, TokenDef> = Object.fromEntries(TOKENS.map((t) => [t.id, t]));

export const PACKS: PackDef[] = [
  { id: 'card_small', name: 'Card Pack', desc: 'Choose 1 of 3 playing cards to add to your deck.', cost: 4, size: 3, picks: 1, kind: 'card', weight: 4, colors: ['#e63946', '#f1faee'], needsHand: false },
  { id: 'card_jumbo', name: 'Jumbo Card Pack', desc: 'Choose 1 of 5 playing cards to add to your deck.', cost: 6, size: 5, picks: 1, kind: 'card', weight: 2, colors: ['#e63946', '#f1faee'], needsHand: false },
  { id: 'card_mega', name: 'Mega Card Pack', desc: 'Choose 2 of 5 playing cards to add to your deck.', cost: 8, size: 5, picks: 2, kind: 'card', weight: 0.5, colors: ['#e63946', '#f1faee'], needsHand: false },
  { id: 'omen_small', name: 'Omen Pack', desc: 'Choose 1 of 3 Omens to use immediately.', cost: 4, size: 3, picks: 1, kind: 'omen', weight: 4, colors: ['#7b2cbf', '#ffd6ff'], needsHand: true },
  { id: 'omen_jumbo', name: 'Jumbo Omen Pack', desc: 'Choose 1 of 5 Omens to use immediately.', cost: 6, size: 5, picks: 1, kind: 'omen', weight: 2, colors: ['#7b2cbf', '#ffd6ff'], needsHand: true },
  { id: 'omen_mega', name: 'Mega Omen Pack', desc: 'Choose 2 of 5 Omens to use immediately.', cost: 8, size: 5, picks: 2, kind: 'omen', weight: 0.5, colors: ['#7b2cbf', '#ffd6ff'], needsHand: true },
  { id: 'star_small', name: 'Star Pack', desc: 'Choose 1 of 3 Stars to use immediately.', cost: 4, size: 3, picks: 1, kind: 'star', weight: 4, colors: ['#023e8a', '#caf0f8'], needsHand: false },
  { id: 'star_jumbo', name: 'Jumbo Star Pack', desc: 'Choose 1 of 5 Stars to use immediately.', cost: 6, size: 5, picks: 1, kind: 'star', weight: 2, colors: ['#023e8a', '#caf0f8'], needsHand: false },
  { id: 'star_mega', name: 'Mega Star Pack', desc: 'Choose 2 of 5 Stars to use immediately.', cost: 8, size: 5, picks: 2, kind: 'star', weight: 0.5, colors: ['#023e8a', '#caf0f8'], needsHand: false },
  { id: 'hex_small', name: 'Hex Pack', desc: 'Choose 1 of 2 Hexes to use immediately.', cost: 4, size: 2, picks: 1, kind: 'hex', weight: 0.8, colors: ['#240046', '#80ffdb'], needsHand: true },
  { id: 'hex_jumbo', name: 'Jumbo Hex Pack', desc: 'Choose 1 of 4 Hexes to use immediately.', cost: 6, size: 4, picks: 1, kind: 'hex', weight: 0.4, colors: ['#240046', '#80ffdb'], needsHand: true },
  { id: 'charm_small', name: 'Charm Pack', desc: 'Choose 1 of 2 Charms.', cost: 5, size: 2, picks: 1, kind: 'charm', weight: 1.5, colors: ['#f77f00', '#fcbf49'], needsHand: false },
  { id: 'charm_jumbo', name: 'Jumbo Charm Pack', desc: 'Choose 1 of 4 Charms.', cost: 7, size: 4, picks: 1, kind: 'charm', weight: 0.8, colors: ['#f77f00', '#fcbf49'], needsHand: false },
  { id: 'charm_mega', name: 'Mega Charm Pack', desc: 'Choose 2 of 4 Charms.', cost: 9, size: 4, picks: 2, kind: 'charm', weight: 0.25, colors: ['#f77f00', '#fcbf49'], needsHand: false },
  { id: 'artisan', name: 'Artisan Pack', desc: 'Choose 1 of 3 enhanced, sealed or edition playing cards.', cost: 5, size: 3, picks: 1, kind: 'enhanced', weight: 1.2, colors: ['#2a9d8f', '#e9c46a'], needsHand: false },
  { id: 'discovery', name: 'Discovery Pack', desc: 'Choose 1 of 4 mystery items: charms, consumables or cards.', cost: 6, size: 4, picks: 1, kind: 'discovery', weight: 0.8, colors: ['#ef476f', '#06d6a0'], needsHand: true },
];
export const PACK_MAP: Record<string, PackDef> = Object.fromEntries(PACKS.map((p) => [p.id, p]));

export const HEATS: HeatDef[] = [
  { level: 1, name: 'Warm', desc: 'Small blinds pay no reward.', mods: (m) => { m.rules.add('noSmallReward'); } },
  { level: 2, name: 'Hot', desc: 'Blinds require 20% more score.', mods: (m) => { m.targetMult *= 1.2; } },
  { level: 3, name: 'Scorching', desc: '−1 discard each round.', mods: (m) => { m.discards -= 1; } },
  { level: 4, name: 'Blazing', desc: 'Shop items cost $1 more.', mods: (m) => { m.shopDiscount -= 1; } },
  { level: 5, name: 'Inferno', desc: '−1 hand each round and blinds require a further 25% more score.', mods: (m) => { m.hands -= 1; m.targetMult *= 1.25; } },
];

export const ALL_HANDS: HandType[] = HAND_ORDER;
