// Warden (boss) blinds. Each applies a real restriction via engine hooks.
import type { Card, Suit } from '../types';
import type { BossDef } from './defs';
import { hasRank } from '../cards';
import { HANDS } from '../hands';

const suitVeil = (id: string, name: string, suit: Suit, label: string, glyph: string, hue: number): BossDef => ({
  id, name, desc: `All ${label} are debuffed.`, counter: `Build around other suits, or use Prism cards and Omens that change suit.`,
  icon: { glyph, hue }, minAnte: 1, scoreMult: 2, difficulty: 1,
  debuff: (c) => hasRank(c) && c.suit === suit,
});

export const BOSSES: BossDef[] = [
  suitVeil('crimson_veil', 'The Crimson Veil', 'H', 'Hearts', '♥', 350),
  suitVeil('ashen_veil', 'The Ashen Veil', 'S', 'Spades', '♠', 230),
  suitVeil('gilt_veil', 'The Gilt Veil', 'D', 'Diamonds', '♦', 40),
  suitVeil('moss_veil', 'The Moss Veil', 'C', 'Clubs', '♣', 130),
  { id: 'iconoclast', name: 'The Iconoclast', desc: 'All face cards are debuffed.', counter: 'Lean on number cards and Aces; Lightning Rod ignores it.',
    icon: { glyph: '☒', hue: 300 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    debuff: (c) => hasRank(c) && c.rank >= 11 && c.rank <= 13 },
  { id: 'miser_king', name: 'The Miser King', desc: 'Lose $1 for every card you play.', counter: 'Play fewer, stronger cards. Bank money beforehand.',
    icon: { glyph: '♚', hue: 45 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    afterHand: (g, played) => g.addMoney(-played.length) },
  { id: 'muzzle', name: 'The Muzzle', desc: 'You get only 1 discard.', counter: 'Hold a reliable hand type; extra-hand charms help.',
    icon: { glyph: '⊘', hue: 0 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    mods: (m) => { m.discards = Math.min(m.discards, 1); } },
  { id: 'narrow_gate', name: 'The Narrow Gate', desc: '−2 hand size.', counter: 'Hand-size charms and Void cards offset it. Small hands like Pairs still work.',
    icon: { glyph: '⫴', hue: 200 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    mods: (m) => { m.handSize -= 2; } },
  { id: 'silencer', name: 'The Silencer', desc: 'Base Chips and Mult of every hand are halved.', counter: 'Rely on card and charm bonuses rather than hand levels.',
    icon: { glyph: '◖', hue: 260 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    base: (ctx) => { ctx.chips = Math.floor(ctx.chips / 2); ctx.mult = Math.max(1, Math.floor(ctx.mult / 2)); } },
  { id: 'tollkeeper', name: 'The Tollkeeper', desc: 'Requires twice as much score as a normal Boss.', counter: 'Purely a test of raw power. Save consumables for this fight.',
    icon: { glyph: '▥', hue: 25 }, minAnte: 2, scoreMult: 4, difficulty: 3 },
  { id: 'shroud', name: 'The Shroud', desc: '1 in 4 cards are dealt face down.', counter: 'Face-down cards still score normally; play them as filler.',
    icon: { glyph: '☁', hue: 220 }, minAnte: 2, scoreMult: 2, difficulty: 1,
    faceDown: (g) => g.rand('boss') < 0.25 },
  { id: 'monotone', name: 'The Monotone', desc: 'After your first hand, any other hand type scores nothing this round.', counter: 'Open with your strongest repeatable hand.',
    icon: { glyph: '═', hue: 180 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    canPlay: (run, _cards, hand) => (run.round?.lockedHand && run.round.lockedHand !== hand ? `Only ${HANDS[run.round.lockedHand].name} may be played.` : null) },
  { id: 'fog', name: 'The Fog of Variety', desc: 'You can’t play the same hand type twice this round.', counter: 'Keep a wide toolkit; Pair and High Card make good fallbacks.',
    icon: { glyph: '≋', hue: 160 }, minAnte: 3, scoreMult: 2, difficulty: 2,
    canPlay: (run, _cards, hand) => (run.round?.handTypesPlayed.includes(hand) ? `${HANDS[hand].name} was already played this round.` : null) },
  { id: 'tithe', name: 'The Tithe', desc: 'Each hand played lowers that hand’s level by 1.', counter: 'Use Stars after the fight; spread plays across hand types.',
    icon: { glyph: '⇩', hue: 10 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    beforeScore: (ctx) => { if ((ctx.run.handLevels[ctx.hand] ?? 1) > 1) ctx.run.handLevels[ctx.hand] -= 1; } },
  { id: 'leech', name: 'The Leech', desc: 'Every discard costs $2.', counter: 'Play with what you’re dealt or keep a cash buffer.',
    icon: { glyph: '◒', hue: 340 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    onDiscard: (g) => g.addMoney(-2) },
  { id: 'hourglass', name: 'The Hourglass', desc: '−2 hands this round.', counter: 'High single-hand scoring and ×Mult charms are key.',
    icon: { glyph: '⌛', hue: 35 }, minAnte: 3, scoreMult: 2, difficulty: 3,
    mods: (m) => { m.hands -= 2; } },
  { id: 'shackle', name: 'The Shackle', desc: 'All 2s through 6s are debuffed.', counter: 'High cards and face-card builds sail through.',
    icon: { glyph: '⛓', hue: 210 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    debuff: (c) => hasRank(c) && c.rank <= 6 },
  { id: 'crown_thief', name: 'The Crown Thief', desc: 'All Kings and Aces are debuffed.', counter: 'Spread out your strength across ranks.',
    icon: { glyph: '♔', hue: 280 }, minAnte: 2, scoreMult: 2, difficulty: 1,
    debuff: (c) => hasRank(c) && (c.rank === 13 || c.rank === 14) },
  { id: 'glutton', name: 'The Glutton', desc: 'Each discard also throws away 1 extra random card from your hand.', counter: 'Discard sparingly; play instead.',
    icon: { glyph: '◕', hue: 90 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    onDiscard: (g) => {
      const r = g.run.round;
      if (!r || !r.hand.length) return;
      const id = r.hand[Math.floor(g.rand('boss') * r.hand.length)];
      r.hand = r.hand.filter((x) => x !== id);
      r.discardPile.push(id);
    } },
  { id: 'blackout', name: 'The Blackout', desc: 'A random charm is disabled before every hand.', counter: 'Redundancy beats reliance on a single engine charm.',
    icon: { glyph: '◼', hue: 240 }, minAnte: 3, scoreMult: 2, difficulty: 2, disableCharm: true },
  { id: 'quota', name: 'The Quota', desc: 'Hands with fewer than 5 cards score nothing.', counter: 'Flushes, Straights and Full Houses love this.',
    icon: { glyph: '⑤', hue: 120 }, minAnte: 1, scoreMult: 2, difficulty: 1,
    canPlay: (_r, cards) => (cards.length !== 5 ? 'You must play exactly 5 cards.' : null) },
  { id: 'drought', name: 'The Drought', desc: 'This blind pays no reward money.', counter: 'Interest and charm payouts still arrive. Plan your economy.',
    icon: { glyph: '☀', hue: 30 }, minAnte: 1, scoreMult: 2, difficulty: 1, noReward: true },
  { id: 'undertow', name: 'The Undertow', desc: 'After each hand, 2 random cards in your hand are discarded.', counter: 'Use your discards early and keep hands flexible.',
    icon: { glyph: '∿', hue: 195 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    afterHand: (g) => {
      const r = g.run.round;
      if (!r) return;
      for (let i = 0; i < 2 && r.hand.length; i++) {
        const id = r.hand[Math.floor(g.rand('boss') * r.hand.length)];
        r.hand = r.hand.filter((x) => x !== id);
        r.discardPile.push(id);
      }
    } },
  { id: 'purifier', name: 'The Purifier', desc: 'All enhanced cards are debuffed.', counter: 'Raw hand levels and charms carry this fight.',
    icon: { glyph: '✧', hue: 55 }, minAnte: 3, scoreMult: 2, difficulty: 2,
    debuff: (c) => !!c.enhancement },
  { id: 'herald', name: 'The Herald', desc: 'Hands without a face card score nothing.', counter: 'Hold face cards; Masquerade makes every card a face.',
    icon: { glyph: '♘', hue: 15 }, minAnte: 2, scoreMult: 2, difficulty: 2,
    canPlay: (run, cards) => {
      const masq = run.charms.some((c) => c.id === 'masquerade');
      return masq || cards.some((c) => hasRank(c) && c.rank >= 11 && c.rank <= 13) ? null : 'You must include a face card.';
    } },
  { id: 'pauper', name: 'The Pauper', desc: 'Lose half your money (rounded down) when this blind starts.', counter: 'Spend before the fight, or rely on interest-free builds.',
    icon: { glyph: '¤', hue: 100 }, minAnte: 3, scoreMult: 2, difficulty: 2,
    onStart: (g) => { if (g.run.money > 0) g.addMoney(-Math.floor(g.run.money / 2)); } },
  // ───────────── Finale wardens (every 8th ante) ─────────────
  { id: 'obsidian_throne', name: 'The Obsidian Throne', desc: 'All face cards and Aces are debuffed.', counter: 'Number-card engines and Monoliths shine.',
    icon: { glyph: '♜', hue: 270, hue2: 0 }, minAnte: 8, scoreMult: 2, difficulty: 3, finale: true,
    debuff: (c) => hasRank(c) && c.rank >= 11 },
  { id: 'eclipse_queen', name: 'The Eclipse Queen', desc: '−1 hand, −1 discard and −1 hand size.', counter: 'Explosive ×Mult builds that win in one or two hands.',
    icon: { glyph: '◐', hue: 300, hue2: 40 }, minAnte: 8, scoreMult: 2, difficulty: 3, finale: true,
    mods: (m) => { m.hands -= 1; m.discards -= 1; m.handSize -= 1; } },
  { id: 'iron_curtain', name: 'The Iron Curtain', desc: 'The suit you own the most of is debuffed.', counter: 'Diversify suits or lean on Prism cards.',
    icon: { glyph: '▤', hue: 210, hue2: 0 }, minAnte: 8, scoreMult: 2, difficulty: 3, finale: true,
    debuff: (c, run) => hasRank(c) && c.suit === dominantSuit(run.deck) },
  { id: 'last_dealer', name: 'The Last Dealer', desc: 'Requires three times the usual Boss score.', counter: 'Everything you have, all at once.',
    icon: { glyph: '🂡', hue: 0, hue2: 50 }, minAnte: 8, scoreMult: 3, difficulty: 3, finale: true },
];

export function dominantSuit(deck: Card[]): Suit {
  const counts: Record<Suit, number> = { S: 0, H: 0, D: 0, C: 0 };
  for (const c of deck) if (hasRank(c)) counts[c.suit]++;
  return (Object.keys(counts) as Suit[]).reduce((a, b) => (counts[b] > counts[a] ? b : a), 'S');
}

export const BOSS_MAP: Record<string, BossDef> = Object.fromEntries(BOSSES.map((b) => [b.id, b]));
