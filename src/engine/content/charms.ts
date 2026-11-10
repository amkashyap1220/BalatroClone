// Charms: collectible passive modifiers. Every entry is real game logic driven by engine hooks.
import type { Card, CharmInstance, HandType, Suit } from '../types';
import type { CharmDef } from './defs';
import { HANDS, handRank } from '../hands';
import { copyCard, isEven, isNumber, isOdd, isRed, makeCard, hasRank } from '../cards';
import { ENHANCEMENT_IDS, CHARM_EDITION_IDS } from './modifications';
import type { ScoreCtx } from '../core';

const SUIT_LABEL: Record<Suit, string> = { S: 'Spade', H: 'Heart', D: 'Diamond', C: 'Club' };
const handName = (h: HandType) => HANDS[h].name;
const st = (self: CharmInstance, k = 'v') => self.state[k] ?? 0;
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

function suitMult(id: string, name: string, suit: Suit, glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity: 'common', cost: 4, icon: { glyph, hue }, tags: ['suit', 'mult'],
    desc: `Scored ${SUIT_LABEL[suit]} cards give +3 Mult.`,
    onScored: (ctx, _s, c) => (ctx.suitIs(c, suit) ? { mult: 3 } : undefined),
  };
}
function suitChips(id: string, name: string, suit: Suit, glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity: 'common', cost: 4, icon: { glyph, hue }, tags: ['suit', 'chips'],
    desc: `Scored ${SUIT_LABEL[suit]} cards give +30 Chips.`,
    onScored: (ctx, _s, c) => (ctx.suitIs(c, suit) ? { chips: 30 } : undefined),
  };
}
function handMult(id: string, name: string, hand: HandType, mult: number, glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity: 'common', cost: 4, icon: { glyph, hue }, tags: ['hand', 'mult'],
    desc: `+${mult} Mult if played hand contains a ${handName(hand)}.`,
    main: (ctx) => (ctx.contains.has(hand) ? { mult } : undefined),
  };
}
function handChips(id: string, name: string, hand: HandType, chips: number, glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity: 'common', cost: 4, icon: { glyph, hue }, tags: ['hand', 'chips'],
    desc: `+${chips} Chips if played hand contains a ${handName(hand)}.`,
    main: (ctx) => (ctx.contains.has(hand) ? { chips } : undefined),
  };
}
function handX(id: string, name: string, hand: HandType, x: number, rarity: 'uncommon' | 'rare', glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity, cost: rarity === 'rare' ? 8 : 7, icon: { glyph, hue, hue2: hue + 40 }, tags: ['hand', 'xmult'],
    desc: `×${x} Mult if played hand contains a ${handName(hand)}.`,
    main: (ctx) => (ctx.contains.has(hand) ? { xmult: x } : undefined),
  };
}
function rule(id: string, name: string, r: string, desc: string, glyph: string, hue: number, rarity: 'uncommon' | 'rare' = 'uncommon'): CharmDef {
  return { id, name, rarity, cost: rarity === 'rare' ? 8 : 6, icon: { glyph, hue }, tags: ['rules'], desc, rules: [r] };
}
function scaleOnHand(id: string, name: string, hand: HandType, field: 'chips' | 'mult', step: number, glyph: string, hue: number): CharmDef {
  return {
    id, name, rarity: 'uncommon', cost: 6, icon: { glyph, hue }, tags: ['scaling', 'hand'], init: { v: 0 },
    desc: `Gains +${step} ${field === 'chips' ? 'Chips' : 'Mult'} each time you play a hand containing a ${handName(hand)}.`,
    status: (s) => `Currently +${st(s)} ${field === 'chips' ? 'Chips' : 'Mult'}`,
    before: (ctx, s) => {
      if (ctx.contains.has(hand)) s.state.v = st(s) + step;
    },
    main: (_c, s) => (st(s) ? { [field]: st(s) } : undefined),
  };
}
const countDeck = (ctx: { run: { deck: Card[] } }, pred: (c: Card) => boolean) => ctx.run.deck.filter(pred).length;

export const CHARMS: CharmDef[] = [
  // ───────────── Flat bonuses ─────────────
  { id: 'lucky_penny', name: 'Lucky Penny', rarity: 'common', cost: 3, icon: { glyph: '¢', hue: 40 }, tags: ['mult'],
    desc: '+4 Mult.', main: () => ({ mult: 4 }) },
  { id: 'paper_lantern', name: 'Paper Lantern', rarity: 'common', cost: 4, icon: { glyph: '☼', hue: 20 }, tags: ['mult', 'chips'],
    desc: '+15 Chips and +2 Mult.', main: () => ({ chips: 15, mult: 2 }) },
  { id: 'brass_knuckles', name: 'Brass Knuckles', rarity: 'common', cost: 4, icon: { glyph: '✊', hue: 35 }, tags: ['chips'],
    desc: '+40 Chips.', main: () => ({ chips: 40 }) },
  { id: 'coin_flip', name: 'Coin Flip', rarity: 'common', cost: 4, icon: { glyph: '◐', hue: 50 }, tags: ['chance', 'mult'],
    desc: '1 in 2 chance for +15 Mult.', main: (ctx) => (ctx.chance(1, 2) ? { mult: 15 } : { msg: 'Tails' }) },

  // ───────────── Suit bonuses ─────────────
  suitMult('crimson_thread', 'Crimson Thread', 'H', '♥', 350),
  suitMult('gilded_thread', 'Gilded Thread', 'D', '♦', 30),
  suitMult('ink_thread', 'Ink Thread', 'S', '♠', 240),
  suitMult('clover_thread', 'Clover Thread', 'C', '♣', 130),
  suitChips('rose_badge', 'Rose Badge', 'H', '❀', 330),
  suitChips('coin_badge', 'Coin Badge', 'D', '◈', 45),
  suitChips('raven_badge', 'Raven Badge', 'S', '♤', 260),
  suitChips('moss_badge', 'Moss Badge', 'C', '☘', 110),
  { id: 'heart_of_gold', name: 'Heart of Gold', rarity: 'rare', cost: 8, icon: { glyph: '♡', hue: 345, hue2: 45 }, tags: ['suit', 'xmult'],
    desc: 'Scored Hearts give ×1.2 Mult.', onScored: (ctx, _s, c) => (ctx.suitIs(c, 'H') ? { xmult: 1.2 } : undefined) },
  { id: 'diamond_mine', name: 'Diamond Mine', rarity: 'uncommon', cost: 6, icon: { glyph: '♢', hue: 40 }, tags: ['suit', 'economy'],
    desc: 'Scored Diamonds give +8 Chips and 1 in 3 chance to earn $1.',
    onScored: (ctx, _s, c) => (ctx.suitIs(c, 'D') ? { chips: 8, money: ctx.chance(1, 3) ? 1 : 0 } : undefined) },
  { id: 'spade_shovel', name: 'Gravedigger’s Spade', rarity: 'uncommon', cost: 6, icon: { glyph: '⚒', hue: 250 }, tags: ['suit', 'chips'],
    desc: 'Scored Spades give +20 Chips. +1 Mult for every Spade held in hand.',
    onScored: (ctx, _s, c) => (ctx.suitIs(c, 'S') ? { chips: 20 } : undefined),
    onHeld: (ctx, _s, c) => (ctx.suitIs(c, 'S') ? { mult: 1 } : undefined) },
  { id: 'clubhouse', name: 'Clubhouse', rarity: 'uncommon', cost: 7, icon: { glyph: '♧', hue: 120 }, tags: ['suit', 'retrigger'],
    desc: 'Retrigger scored Clubs once.', retrigScored: (ctx, _s, c) => (ctx.suitIs(c, 'C') ? 1 : 0) },
  { id: 'rainbow', name: 'Rainbow Bridge', rarity: 'uncommon', cost: 7, icon: { glyph: '☄', hue: 280, hue2: 30 }, tags: ['suit', 'xmult'],
    desc: '×2.5 Mult if scoring cards include all four suits.',
    main: (ctx) => {
      const suits: Suit[] = ['S', 'H', 'D', 'C'];
      // Assign each suit to a distinct card (wild cards fill any gap).
      const cards = ctx.scoring.filter(hasRank);
      const used = new Set<string>();
      for (const s of suits) {
        const natural = cards.find((c) => !used.has(c.id) && c.enhancement !== 'prism' && ctx.suitIs(c, s));
        const any = natural ?? cards.find((c) => !used.has(c.id) && ctx.suitIs(c, s));
        if (!any) return undefined;
        used.add(any.id);
      }
      return { xmult: 2.5 };
    } },
  { id: 'monochrome', name: 'Monochrome', rarity: 'common', cost: 4, icon: { glyph: '◑', hue: 0 }, tags: ['suit', 'mult'],
    desc: '+12 Mult if every played card is the same colour.',
    main: (ctx) => {
      const r = ctx.played.filter(hasRank);
      if (!r.length) return undefined;
      const red = r.every((c) => isRed(c.suit) || c.enhancement === 'prism');
      const black = r.every((c) => !isRed(c.suit) || c.enhancement === 'prism');
      return red || black ? { mult: 12 } : undefined;
    } },

  // ───────────── Hand-specific ─────────────
  handMult('twin_flame', 'Twin Flame', 'pair', 8, '♊', 10),
  handMult('double_date', 'Double Date', 'twopair', 10, '❦', 320),
  handMult('trinity_knot', 'Trinity Knot', 'three', 12, '☘', 150),
  handMult('rail_rider', 'Rail Rider', 'straight', 12, '⛟', 200),
  handMult('tide_pool', 'Tide Pool', 'flush', 10, '≋', 190),
  handMult('full_nest', 'Full Nest', 'full', 14, '⌂', 30),
  handChips('twin_mirrors', 'Twin Mirrors', 'pair', 50, '⧉', 210),
  handChips('pocket_watch', 'Pocket Watch', 'twopair', 80, '⌚', 45),
  handChips('tripod', 'Tripod', 'three', 100, '⏃', 90),
  handChips('long_road', 'Long Road', 'straight', 100, '⇶', 25),
  handChips('watercolor', 'Watercolor', 'flush', 80, '✎', 270),
  handChips('housewarming', 'Housewarming', 'full', 120, '⌘', 15),
  handX('kinship_locket', 'Kinship Locket', 'pair', 1.5, 'uncommon', '⚭', 330),
  handX('triad_sigil', 'Triad Sigil', 'three', 2, 'uncommon', '△', 100),
  handX('ladder_crest', 'Ladder Crest', 'straight', 2, 'uncommon', '☰', 210),
  handX('ocean_crest', 'Ocean Crest', 'flush', 2, 'uncommon', '♒', 185),
  handX('manor_crest', 'Manor Crest', 'full', 2, 'uncommon', '♖', 25),
  handX('quartet_crest', 'Quartet Crest', 'four', 2.5, 'rare', '⊞', 300),
  { id: 'royal_decree', name: 'Royal Decree', rarity: 'rare', cost: 9, icon: { glyph: '♔', hue: 48, hue2: 280 }, tags: ['hand', 'xmult'],
    desc: '×4 Mult if played hand is a Straight Flush or Royal Flush.',
    main: (ctx) => (ctx.hand === 'sflush' || ctx.hand === 'royal' ? { xmult: 4 } : undefined) },
  { id: 'habit', name: 'Creature of Habit', rarity: 'uncommon', cost: 6, icon: { glyph: '↻', hue: 160 }, tags: ['hand', 'mult', 'scaling'],
    desc: '+1 Mult for every time the played hand type has been played this run.',
    main: (ctx) => ({ mult: ctx.run.stats.handCounts[ctx.hand] ?? 0 }) },
  { id: 'gravity_well', name: 'Gravity Well', rarity: 'rare', cost: 8, icon: { glyph: '◎', hue: 260, hue2: 200 }, tags: ['hand', 'xmult'],
    desc: '×0.25 Mult for each level of the played hand above 1 (plus ×1).',
    main: (ctx) => {
      const lvl = ctx.run.handLevels[ctx.hand] ?? 1;
      return lvl > 1 ? { xmult: 1 + 0.25 * (lvl - 1) } : undefined;
    } },
  { id: 'perfect_pitch', name: 'Perfect Pitch', rarity: 'uncommon', cost: 7, icon: { glyph: '♫', hue: 300 }, tags: ['xmult'],
    desc: '×2 Mult if exactly 5 cards score.', main: (ctx) => (ctx.scoring.length === 5 ? { xmult: 2 } : undefined) },
  { id: 'featherweight', name: 'Featherweight', rarity: 'common', cost: 4, icon: { glyph: '❧', hue: 80 }, tags: ['mult'],
    desc: '+15 Mult if played hand has 3 or fewer cards.', main: (ctx) => (ctx.played.length <= 3 ? { mult: 15 } : undefined) },
  { id: 'heavyweight', name: 'Heavyweight', rarity: 'common', cost: 4, icon: { glyph: '⚓', hue: 220 }, tags: ['chips'],
    desc: '+60 Chips if played hand has exactly 5 cards.', main: (ctx) => (ctx.played.length === 5 ? { chips: 60 } : undefined) },

  // ───────────── Rank-specific ─────────────
  { id: 'even_keel', name: 'Even Keel', rarity: 'common', cost: 4, icon: { glyph: '⚖', hue: 200 }, tags: ['rank', 'mult'],
    desc: 'Scored 2, 4, 6, 8 and 10s give +3 Mult.', onScored: (_c, _s, c) => (isEven(c) ? { mult: 3 } : undefined) },
  { id: 'odd_duck', name: 'Odd Duck', rarity: 'common', cost: 4, icon: { glyph: '⚘', hue: 55 }, tags: ['rank', 'chips'],
    desc: 'Scored A, 3, 5, 7 and 9s give +25 Chips.', onScored: (_c, _s, c) => (isOdd(c) ? { chips: 25 } : undefined) },
  { id: 'ace_hole', name: 'Ace in the Hole', rarity: 'common', cost: 5, icon: { glyph: 'A', hue: 0 }, tags: ['rank'],
    desc: 'Scored Aces give +20 Chips and +4 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 14 ? { chips: 20, mult: 4 } : undefined) },
  { id: 'low_rider', name: 'Low Rider', rarity: 'common', cost: 4, icon: { glyph: '⇣', hue: 170 }, tags: ['rank', 'mult'],
    desc: 'Scored 2, 3, 4 and 5s give +5 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank <= 5 ? { mult: 5 } : undefined) },
  { id: 'lucky_seven', name: 'Lucky Seven', rarity: 'common', cost: 4, icon: { glyph: '7', hue: 120 }, tags: ['rank', 'mult'],
    desc: 'Scored 7s give +7 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 7 ? { mult: 7 } : undefined) },
  { id: 'tens_club', name: 'Perfect Ten', rarity: 'common', cost: 4, icon: { glyph: 'X', hue: 280 }, tags: ['rank'],
    desc: 'Scored 10s give +10 Chips and +3 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 10 ? { chips: 10, mult: 3 } : undefined) },
  { id: 'prime_time', name: 'Prime Time', rarity: 'common', cost: 5, icon: { glyph: '∴', hue: 190 }, tags: ['rank', 'mult'],
    desc: 'Scored 2, 3, 5 and 7s give +4 Mult.', onScored: (_c, _s, c) => (hasRank(c) && [2, 3, 5, 7].includes(c.rank) ? { mult: 4 } : undefined) },
  { id: 'nine_lives', name: 'Nine Lives', rarity: 'uncommon', cost: 6, icon: { glyph: '9', hue: 30 }, tags: ['rank', 'retrigger'],
    desc: 'Retrigger scored 9s twice.', retrigScored: (_c, _s, c) => (hasRank(c) && c.rank === 9 ? 2 : 0) },
  { id: 'ace_pilot', name: 'Ace Pilot', rarity: 'rare', cost: 8, icon: { glyph: '✈', hue: 210 }, tags: ['rank', 'retrigger'],
    desc: 'Retrigger scored Aces twice.', retrigScored: (_c, _s, c) => (hasRank(c) && c.rank === 14 ? 2 : 0) },
  { id: 'low_tide', name: 'Low Tide', rarity: 'uncommon', cost: 6, icon: { glyph: '∽', hue: 195 }, tags: ['rank', 'retrigger'],
    desc: 'Retrigger scored 2, 3, 4 and 5s.', retrigScored: (_c, _s, c) => (hasRank(c) && c.rank <= 5 ? 1 : 0) },
  { id: 'eight_ball', name: 'Black Eight', rarity: 'common', cost: 4, icon: { glyph: '➑', hue: 260 }, tags: ['rank', 'consumable'],
    desc: 'Each scored 8 has a 1 in 4 chance to create an Omen.',
    onScored: (ctx, _s, c) => (hasRank(c) && c.rank === 8 && ctx.chance(1, 4) && ctx.createConsumable('omen') ? { msg: '+Omen' } : undefined) },
  { id: 'number_cruncher', name: 'Number Cruncher', rarity: 'common', cost: 4, icon: { glyph: '#', hue: 100 }, tags: ['rank', 'chips'],
    desc: 'Scored number cards (2–10) give +8 Chips.', onScored: (_c, _s, c) => (isNumber(c) ? { chips: 8 } : undefined) },

  // ───────────── Face cards ─────────────
  { id: 'courtier', name: 'Courtier', rarity: 'common', cost: 4, icon: { glyph: '♕', hue: 300 }, tags: ['face', 'mult'],
    desc: 'Scored face cards give +4 Mult.', onScored: (ctx, _s, c) => (ctx.isFace(c) ? { mult: 4 } : undefined) },
  { id: 'royal_guard', name: 'Royal Guard', rarity: 'common', cost: 4, icon: { glyph: '♜', hue: 220 }, tags: ['face', 'chips'],
    desc: 'Scored face cards give +35 Chips.', onScored: (ctx, _s, c) => (ctx.isFace(c) ? { chips: 35 } : undefined) },
  { id: 'knaves_purse', name: 'Knave’s Purse', rarity: 'common', cost: 5, icon: { glyph: 'J', hue: 45 }, tags: ['face', 'economy'],
    desc: 'Scored Jacks earn $1.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 11 ? { money: 1 } : undefined) },
  { id: 'queens_gambit', name: 'Queen’s Gambit', rarity: 'uncommon', cost: 6, icon: { glyph: 'Q', hue: 320 }, tags: ['face', 'mult'],
    desc: 'Scored Queens give +12 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 12 ? { mult: 12 } : undefined) },
  { id: 'crown_jewel', name: 'Crown Jewel', rarity: 'uncommon', cost: 7, icon: { glyph: '♚', hue: 50 }, tags: ['face', 'xmult'],
    desc: 'Scored Kings give ×1.4 Mult.', onScored: (_c, _s, c) => (hasRank(c) && c.rank === 13 ? { xmult: 1.4 } : undefined) },
  { id: 'throne_room', name: 'Throne Room', rarity: 'uncommon', cost: 6, icon: { glyph: '♛', hue: 280 }, tags: ['face', 'held'],
    desc: 'Face cards held in hand give +3 Mult.', onHeld: (ctx, _s, c) => (ctx.isFace(c) ? { mult: 3 } : undefined) },
  { id: 'kingmaker', name: 'Kingmaker', rarity: 'rare', cost: 8, icon: { glyph: '♔', hue: 20 }, tags: ['face', 'held', 'xmult'],
    desc: 'Kings and Queens held in hand give ×1.25 Mult.',
    onHeld: (_c, _s, c) => (hasRank(c) && (c.rank === 13 || c.rank === 12) ? { xmult: 1.25 } : undefined) },
  { ...rule('masquerade', 'Masquerade', 'masquerade', 'Every card counts as a face card.', '☺', 290) },
  { id: 'portrait_gallery', name: 'Portrait Gallery', rarity: 'uncommon', cost: 7, icon: { glyph: '▣', hue: 15 }, tags: ['face', 'retrigger'],
    desc: 'Retrigger scored face cards once.', retrigScored: (ctx, _s, c) => (ctx.isFace(c) ? 1 : 0) },
  { id: 'faceless', name: 'Faceless', rarity: 'uncommon', cost: 6, icon: { glyph: '○', hue: 0 }, tags: ['face', 'xmult'],
    desc: '×1.75 Mult if no face cards were played.', main: (ctx) => (ctx.played.some((c) => ctx.isFace(c)) ? undefined : { xmult: 1.75 }) },
  { id: 'midas_touch', name: 'Midas Touch', rarity: 'rare', cost: 8, icon: { glyph: '✋', hue: 48 }, tags: ['face', 'enhance'],
    desc: 'The first scored face card each hand becomes a Treasure card.',
    before: (ctx) => {
      const f = ctx.scoring.find((c) => ctx.isFace(c) && !ctx.isDebuffed(c));
      if (f) f.enhancement = 'treasure';
    } },
  { id: 'ragpicker', name: 'Ragpicker', rarity: 'common', cost: 4, icon: { glyph: '✂', hue: 70 }, tags: ['face', 'economy', 'discard'],
    desc: 'Earn $1 for each face card you discard.',
    onDiscard: (g, _s, cards) => g.addMoney(cards.filter((c) => c.rank >= 11 && c.rank <= 13 && hasRank(c)).length) },

  // ───────────── Economy ─────────────
  { id: 'piggy_bank', name: 'Piggy Bank', rarity: 'common', cost: 5, icon: { glyph: '₱', hue: 340 }, tags: ['economy'],
    desc: 'Earn $4 at end of round.', payout: () => 4 },
  { id: 'tip_jar', name: 'Tip Jar', rarity: 'common', cost: 4, icon: { glyph: '⚱', hue: 30 }, tags: ['economy', 'discard'],
    desc: 'Earn $1 per unused discard at end of round.', payout: (g) => g.run.round?.discardsLeft ?? 0 },
  { id: 'bounty_board', name: 'Bounty Board', rarity: 'common', cost: 4, icon: { glyph: '☠', hue: 10 }, tags: ['economy', 'boss'],
    desc: 'Earn $6 when you defeat a Boss blind.', payout: (g) => (g.run.round?.blindType === 'boss' ? 6 : 0) },
  { id: 'pickpocket', name: 'Pickpocket', rarity: 'common', cost: 4, icon: { glyph: '✌', hue: 40 }, tags: ['economy', 'suit'],
    desc: 'Scored Diamonds have a 1 in 2 chance to earn $1.',
    onScored: (ctx, _s, c) => (ctx.suitIs(c, 'D') && ctx.chance(1, 2) ? { money: 1 } : undefined) },
  { id: 'fat_wallet', name: 'Fat Wallet', rarity: 'common', cost: 5, icon: { glyph: '$', hue: 100 }, tags: ['economy', 'chips'],
    desc: '+2 Chips for every $1 you have.', main: (ctx) => (ctx.run.money > 0 ? { chips: ctx.run.money * 2 } : undefined) },
  { id: 'merchant_scale', name: 'Merchant’s Scale', rarity: 'uncommon', cost: 6, icon: { glyph: '⚖', hue: 45 }, tags: ['economy', 'mult'],
    desc: '+1 Mult for every $5 you have.', main: (ctx) => (ctx.run.money >= 5 ? { mult: Math.floor(ctx.run.money / 5) } : undefined) },
  { id: 'gilded_idol', name: 'Gilded Idol', rarity: 'rare', cost: 9, icon: { glyph: '☥', hue: 48 }, tags: ['economy', 'xmult'],
    desc: '×0.25 Mult for every $10 you have (plus ×1).', main: (ctx) => (ctx.run.money >= 10 ? { xmult: 1 + 0.25 * Math.floor(ctx.run.money / 10) } : undefined) },
  { id: 'coupon_clipper', name: 'Coupon Clipper', rarity: 'common', cost: 5, icon: { glyph: '✄', hue: 160 }, tags: ['economy', 'shop'],
    desc: 'Everything in the shop costs $1 less.', mods: (m) => { m.shopDiscount += 1; } },
  { id: 'haggler', name: 'Haggler', rarity: 'common', cost: 4, icon: { glyph: '☏', hue: 25 }, tags: ['economy', 'shop'],
    desc: 'Charms and consumables sell for $2 more.', mods: (m) => { m.sellBonus += 2; } },
  { id: 'rainy_day', name: 'Rainy Day Fund', rarity: 'common', cost: 4, icon: { glyph: '☂', hue: 210 }, tags: ['economy'],
    desc: 'Gains $2 of sell value at end of each round.', onRoundEnd: (_g, s) => { s.sellBonus += 2; } },
  { id: 'gamblers_purse', name: 'Gambler’s Purse', rarity: 'common', cost: 4, icon: { glyph: '⚂', hue: 0 }, tags: ['economy', 'chance'],
    desc: '1 in 3 chance to earn $7 at end of round.', payout: (g) => (g.chance(1, 3) ? 7 : 0) },
  { id: 'compound_interest', name: 'Compound Interest', rarity: 'uncommon', cost: 7, icon: { glyph: '%', hue: 130 }, tags: ['economy'],
    desc: 'Raises the interest cap by $5.', mods: (m) => { m.interestCap += 5; } },
  { id: 'golden_goose', name: 'Golden Goose', rarity: 'uncommon', cost: 6, icon: { glyph: '⚜', hue: 48 }, tags: ['economy', 'enhance'],
    desc: 'Earn $1 for each Treasure card in your deck at end of round.', payout: (g) => countDeck(g, (c) => c.enhancement === 'treasure') },
  { id: 'free_sample', name: 'Free Sample', rarity: 'uncommon', cost: 6, icon: { glyph: '↺', hue: 180 }, tags: ['shop'],
    desc: 'The first reroll in each shop is free.', onShopEnter: (g) => { if (g.run.shop) g.run.shop.freeRerolls += 1; } },
  { id: 'debt_collector', name: 'Line of Credit', rarity: 'uncommon', cost: 6, icon: { glyph: '∓', hue: 0 }, tags: ['economy', 'risk'],
    desc: 'You may go up to $20 into debt.', mods: (m) => { m.debtLimit += 20; } },
  { id: 'jackpot', name: 'Jackpot', rarity: 'uncommon', cost: 6, icon: { glyph: '⚅', hue: 50 }, tags: ['economy', 'hand'],
    desc: 'Earn $8 when you play Four of a Kind or better.', main: (ctx) => (handRank(ctx.hand) >= handRank('four') ? { money: 8 } : undefined) },
  { id: 'loan_shark', name: 'Loan Shark', rarity: 'common', cost: 3, icon: { glyph: '⛵', hue: 200 }, tags: ['economy', 'risk'],
    desc: 'Gain $15 when acquired. Lose $2 at end of every round.',
    onAcquire: (g) => g.addMoney(15), payout: () => -2 },
  { id: 'overachiever', name: 'Overachiever', rarity: 'common', cost: 5, icon: { glyph: '★', hue: 55 }, tags: ['economy'],
    desc: 'Earn $3 when a single hand scores at least the blind’s full target.',
    after: (ctx) => { if (Math.floor(ctx.chips * ctx.mult) >= ctx.target) ctx.addMoney(3); } },
  { id: 'gold_rush', name: 'Gold Rush', rarity: 'common', cost: 5, icon: { glyph: '⛏', hue: 40 }, tags: ['economy', 'enhance'],
    desc: 'Treasure cards held at end of round earn an extra $2.',
    payout: (g) => g.handCards().filter((c) => c.enhancement === 'treasure' && !g.isDebuffed(c)).length * 2 },
  { id: 'mother_lode', name: 'Mother Lode', rarity: 'uncommon', cost: 6, icon: { glyph: '◆', hue: 45 }, tags: ['enhance', 'held'],
    desc: 'Treasure cards held in hand give +5 Mult.', onHeld: (_c, _s, c) => (c.enhancement === 'treasure' ? { mult: 5 } : undefined) },
  { id: 'blood_pact', name: 'Blood Pact', rarity: 'uncommon', cost: 6, icon: { glyph: '☩', hue: 355 }, tags: ['xmult', 'risk'],
    desc: '×1.75 Mult. Lose $1 every time you play a hand.', main: () => ({ xmult: 1.75 }), after: (ctx) => ctx.addMoney(-1) },

  // ───────────── Discards ─────────────
  { id: 'spring_cleaning', name: 'Spring Cleaning', rarity: 'common', cost: 4, icon: { glyph: '✧', hue: 90 }, tags: ['discard'],
    desc: '+1 discard each round.', mods: (m) => { m.discards += 1; } },
  { id: 'recycler', name: 'Recycler', rarity: 'common', cost: 4, icon: { glyph: '♻', hue: 120 }, tags: ['discard', 'chips'],
    desc: '+20 Chips for each remaining discard.', main: (ctx) => ((ctx.run.round?.discardsLeft ?? 0) > 0 ? { chips: 20 * ctx.run.round!.discardsLeft } : undefined) },
  { id: 'scrap_collector', name: 'Scrap Collector', rarity: 'common', cost: 5, icon: { glyph: '⚙', hue: 30 }, tags: ['discard', 'scaling'], init: { v: 0 },
    desc: 'Gains +2 Chips for every card discarded.', status: (s) => `Currently +${st(s)} Chips`,
    onDiscard: (_g, s, cards) => { s.state.v = st(s) + 2 * cards.length; }, main: (_c, s) => (st(s) ? { chips: st(s) } : undefined) },
  { id: 'fire_sale', name: 'Fire Sale', rarity: 'common', cost: 5, icon: { glyph: '♨', hue: 15 }, tags: ['discard', 'scaling'], init: { v: 0 },
    desc: 'Gains +2 Mult whenever you discard exactly 5 cards at once.', status: (s) => `Currently +${st(s)} Mult`,
    onDiscard: (_g, s, cards) => { if (cards.length === 5) s.state.v = st(s) + 2; }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'burn_notice', name: 'Burn Notice', rarity: 'uncommon', cost: 6, icon: { glyph: '✹', hue: 20 }, tags: ['discard', 'destroy'], init: { used: 0 },
    desc: 'If your first discard of a round is a single card, destroy it and earn $2.',
    onRoundStart: (_g, s) => { s.state.used = 0; },
    onDiscard: (g, s, cards) => {
      if (st(s, 'used')) return;
      s.state.used = 1;
      if (cards.length === 1) { g.destroyCards([cards[0].id]); g.addMoney(2); }
    } },
  { id: 'last_resort', name: 'Last Resort', rarity: 'uncommon', cost: 6, icon: { glyph: '⚠', hue: 5 }, tags: ['discard', 'xmult'],
    desc: '×2.5 Mult when you have no discards left.', main: (ctx) => ((ctx.run.round?.discardsLeft ?? 1) === 0 ? { xmult: 2.5 } : undefined) },
  { id: 'purist', name: 'Purist', rarity: 'uncommon', cost: 6, icon: { glyph: '◇', hue: 190 }, tags: ['discard', 'xmult'],
    desc: '×1.75 Mult if you haven’t discarded this round.', main: (ctx) => ((ctx.run.round?.discardsUsed ?? 1) === 0 ? { xmult: 1.75 } : undefined) },
  { id: 'snowball', name: 'Snowball', rarity: 'common', cost: 5, icon: { glyph: '❄', hue: 195 }, tags: ['scaling', 'discard'], init: { v: 0 },
    desc: 'Gains +1 Mult for each hand played. Resets when you discard.', status: (s) => `Currently +${st(s)} Mult`,
    before: (_c, s) => { s.state.v = st(s) + 1; }, onDiscard: (_g, s) => { s.state.v = 0; }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'kindling', name: 'Kindling', rarity: 'common', cost: 4, icon: { glyph: '✺', hue: 25 }, tags: ['discard', 'mult'],
    desc: '+4 Mult for each discard used this round.', main: (ctx) => ((ctx.run.round?.discardsUsed ?? 0) > 0 ? { mult: 4 * ctx.run.round!.discardsUsed } : undefined) },

  // ───────────── Hand size & slots ─────────────
  { id: 'deep_pockets', name: 'Deep Pockets', rarity: 'uncommon', cost: 6, icon: { glyph: '⊔', hue: 230 }, tags: ['handsize'],
    desc: '+1 hand size.', mods: (m) => { m.handSize += 1; } },
  { id: 'jugglers_gloves', name: 'Juggler’s Gloves', rarity: 'uncommon', cost: 6, icon: { glyph: '✋', hue: 170 }, tags: ['handsize', 'discard'],
    desc: '+2 hand size, −1 discard.', mods: (m) => { m.handSize += 2; m.discards -= 1; } },
  { id: 'minimalist', name: 'Minimalist', rarity: 'common', cost: 5, icon: { glyph: '▢', hue: 0 }, tags: ['mult'],
    desc: '+6 Mult for each empty Charm slot (this charm counts as empty).',
    main: (ctx) => {
      const empty = ctx.mods.charmSlots - ctx.run.charms.length + 1;
      return empty > 0 ? { mult: 6 * empty } : undefined;
    } },
  { id: 'cartographer', name: 'Cartographer', rarity: 'uncommon', cost: 6, icon: { glyph: '⌖', hue: 40 }, tags: ['consumable'],
    desc: '+1 consumable slot.', mods: (m) => { m.consumableSlots += 1; } },
  { id: 'daredevil', name: 'Daredevil', rarity: 'uncommon', cost: 6, icon: { glyph: '⚡', hue: 55 }, tags: ['xmult', 'risk'],
    desc: '×2 Mult. −1 hand each round.', mods: (m) => { m.hands -= 1; }, main: () => ({ xmult: 2 }) },
  { id: 'extra_hand', name: 'Fourth Wind', rarity: 'uncommon', cost: 7, icon: { glyph: '✚', hue: 140 }, tags: ['hands'],
    desc: '+1 hand each round.', mods: (m) => { m.hands += 1; } },

  // ───────────── Deck manipulation / creation ─────────────
  { id: 'photocopier', name: 'Photocopier', rarity: 'uncommon', cost: 7, icon: { glyph: '⎘', hue: 200 }, tags: ['duplicate'],
    desc: 'If the first hand of a round is a single card, add a permanent copy of it to your hand.',
    after: (ctx) => { if (ctx.firstHand && ctx.played.length === 1) ctx.addCard(copyCard(ctx.run, ctx.played[0]), true); } },
  { id: 'gardener', name: 'Gardener', rarity: 'uncommon', cost: 6, icon: { glyph: '✿', hue: 110 }, tags: ['deck', 'enhance'],
    desc: 'When a round starts, add a random Plated or Ember card to your hand.',
    onRoundStart: (g) => {
      const suits: Suit[] = ['S', 'H', 'D', 'C'];
      const card = makeCard(g.run, 2 + Math.floor(g.rand('gen') * 13), suits[Math.floor(g.rand('gen') * 4)]);
      card.enhancement = g.rand('gen') < 0.5 ? 'plated' : 'ember';
      g.addCard(card, true);
    } },
  { id: 'grave_digger', name: 'Grave Robber', rarity: 'uncommon', cost: 6, icon: { glyph: '⚰', hue: 270 }, tags: ['destroy', 'scaling', 'xmult'], init: { v: 1 },
    desc: 'Gains ×0.2 Mult each time a playing card is destroyed.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    onCardsDestroyed: (_g, s, cards) => { s.state.v = st(s) + 0.2 * cards.length; }, main: (_c, s) => (st(s) > 1 ? { xmult: st(s) } : undefined) },
  { id: 'sculptor', name: 'Sculptor', rarity: 'uncommon', cost: 6, icon: { glyph: '⚒', hue: 205 }, tags: ['enhance'],
    desc: 'Scored number cards have a 1 in 6 chance to become Plated before scoring.',
    before: (ctx) => { for (const c of ctx.scoring) if (isNumber(c) && !c.enhancement && ctx.chance(1, 6)) c.enhancement = 'plated'; } },
  { id: 'alchemist_stone', name: 'Alchemist’s Stone', rarity: 'uncommon', cost: 7, icon: { glyph: '⚗', hue: 150 }, tags: ['enhance', 'deck'],
    desc: 'At end of round, a random unenhanced card in your deck gains a random enhancement.',
    onRoundEnd: (g) => {
      const pool = g.run.deck.filter((c) => !c.enhancement);
      if (!pool.length) return;
      const c = pool[Math.floor(g.rand('gen') * pool.length)];
      c.enhancement = ENHANCEMENT_IDS[Math.floor(g.rand('gen') * ENHANCEMENT_IDS.length)];
    } },
  { id: 'trailblazer', name: 'Trailblazer', rarity: 'uncommon', cost: 6, icon: { glyph: '⛰', hue: 30 }, tags: ['scaling', 'cards'],
    desc: 'Every scored card permanently gains +3 Chips.', onScored: (_c, _s, card) => { card.bonusChips += 3; return { msg: 'Upgrade!' }; } },
  { id: 'static_coil', name: 'Static Coil', rarity: 'uncommon', cost: 6, icon: { glyph: '⌁', hue: 60 }, tags: ['scaling', 'cards'],
    desc: 'Scored cards have a 1 in 3 chance to permanently gain +1 Mult.',
    onScored: (ctx, _s, card) => { if (ctx.chance(1, 3)) { card.bonusMult += 1; return { msg: 'Charged!' }; } } },
  { id: 'leech_ring', name: 'Leech Ring', rarity: 'rare', cost: 8, icon: { glyph: '◍', hue: 340 }, tags: ['scaling', 'enhance'], init: { v: 0 },
    desc: 'Gains +3 Mult for each enhanced card scored, then strips the enhancement.', status: (s) => `Currently +${st(s)} Mult`,
    before: (ctx, s) => {
      for (const c of ctx.scoring) if (c.enhancement && c.enhancement !== 'monolith' && !ctx.isDebuffed(c)) { c.enhancement = null; s.state.v = st(s) + 3; }
    }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'phoenix_feather', name: 'Phoenix Feather', rarity: 'rare', cost: 8, icon: { glyph: '❦', hue: 18, hue2: 50 }, tags: ['destroy', 'duplicate'], init: { used: 0 },
    desc: 'The first card destroyed each round is reborn into your deck as a Spectrum copy.',
    onRoundStart: (_g, s) => { s.state.used = 0; },
    onCardsDestroyed: (g, s, cards) => {
      if (st(s, 'used') || !cards.length) return;
      s.state.used = 1;
      const c = copyCard(g.run, cards[0]);
      c.edition = 'spectrum';
      if (c.enhancement === 'crystal') c.enhancement = null;
      g.addCard(c, false);
    } },

  // ───────────── Consumable generation ─────────────
  { id: 'oracle_bones', name: 'Oracle Bones', rarity: 'uncommon', cost: 6, icon: { glyph: '☍', hue: 40 }, tags: ['consumable'],
    desc: 'Create an Omen when you play a Straight (if you have room).',
    after: (ctx) => { if (ctx.contains.has('straight')) ctx.createConsumable('omen'); } },
  { id: 'stargazer', name: 'Stargazer', rarity: 'uncommon', cost: 6, icon: { glyph: '✵', hue: 230 }, tags: ['hand', 'chance'],
    desc: '1 in 4 chance to level up the played hand.',
    before: (ctx) => { if (ctx.chance(1, 4)) { ctx.levelHand(ctx.hand, 1); ctx.log(`${handName(ctx.hand)} leveled up!`); } } },
  { id: 'night_owl', name: 'Night Owl', rarity: 'uncommon', cost: 6, icon: { glyph: '☾', hue: 240 }, tags: ['consumable'],
    desc: 'At end of round, create the Star for your most played hand.',
    onRoundEnd: (g) => { const h = g.mostPlayedHand(); const star = STAR_FOR[h]; if (star) g.createConsumable('star', star); } },
  { id: 'superstition', name: 'Superstition', rarity: 'uncommon', cost: 6, icon: { glyph: '☊', hue: 280 }, tags: ['consumable'],
    desc: 'Create an Omen when a blind starts.', onRoundStart: (g) => { g.createConsumable('omen'); } },
  { id: 'hex_collector', name: 'Hex Collector', rarity: 'uncommon', cost: 6, icon: { glyph: '⛧', hue: 260 }, tags: ['consumable', 'skip'],
    desc: 'Create a Hex whenever you skip a blind.', onSkipBlind: (g) => { g.createConsumable('hex'); } },
  { id: 'messenger', name: 'Messenger Pigeon', rarity: 'common', cost: 4, icon: { glyph: '✉', hue: 200 }, tags: ['consumable'],
    desc: 'Create a Star when you defeat a Boss blind.', onBossDefeated: (g) => { g.createConsumable('star'); } },
  { id: 'fortune_cookie', name: 'Fortune Cookie', rarity: 'common', cost: 4, icon: { glyph: '◒', hue: 35 }, tags: ['consumable', 'chance'],
    desc: '1 in 3 chance to create an Omen when you discard.', onDiscard: (g) => { if (g.chance(1, 3)) g.createConsumable('omen'); } },

  // ───────────── Retriggers ─────────────
  { id: 'echo_chamber', name: 'Echo Chamber', rarity: 'uncommon', cost: 6, icon: { glyph: '◉', hue: 300 }, tags: ['retrigger'],
    desc: 'Retrigger the first scored card twice.', retrigScored: (ctx, _s, c) => (ctx.scoring[0]?.id === c.id ? 2 : 0) },
  { id: 'encore', name: 'Encore', rarity: 'common', cost: 5, icon: { glyph: '↩', hue: 330 }, tags: ['retrigger'],
    desc: 'Retrigger the last scored card once.', retrigScored: (ctx, _s, c) => (ctx.scoring[ctx.scoring.length - 1]?.id === c.id ? 1 : 0) },
  { id: 'reverb', name: 'Reverb', rarity: 'uncommon', cost: 7, icon: { glyph: '≈', hue: 180 }, tags: ['retrigger', 'held'],
    desc: 'Retrigger all held-in-hand abilities.', retrigHeld: () => 1 },
  { id: 'seal_stamper', name: 'Seal Stamper', rarity: 'uncommon', cost: 6, icon: { glyph: '⊛', hue: 0 }, tags: ['retrigger', 'seal'],
    desc: 'Retrigger scored cards that have a seal.', retrigScored: (_c, _s, c) => (c.seal ? 1 : 0) },
  { id: 'glass_harmonica', name: 'Glass Harmonica', rarity: 'uncommon', cost: 6, icon: { glyph: '♬', hue: 190 }, tags: ['retrigger', 'enhance'],
    desc: 'Retrigger scored Crystal cards.', retrigScored: (_c, _s, c) => (c.enhancement === 'crystal' ? 1 : 0) },
  { id: 'last_call', name: 'Last Call', rarity: 'uncommon', cost: 7, icon: { glyph: '⌛', hue: 25 }, tags: ['retrigger'],
    desc: 'Retrigger every scored card on the final hand of the round.', retrigScored: (ctx) => (ctx.lastHand ? 1 : 0) },
  { id: 'mirror_ball', name: 'Mirror Ball', rarity: 'rare', cost: 8, icon: { glyph: '❂', hue: 280, hue2: 180 }, tags: ['retrigger', 'edition'],
    desc: 'Retrigger scored cards that have an edition twice.', retrigScored: (_c, _s, c) => (c.edition ? 2 : 0) },
  { id: 'double_tap', name: 'Double Tap', rarity: 'rare', cost: 8, icon: { glyph: '⁑', hue: 10 }, tags: ['retrigger', 'hand'],
    desc: 'Retrigger every scored card if the played hand is a Pair or Two Pair.',
    retrigScored: (ctx) => (ctx.hand === 'pair' || ctx.hand === 'twopair' ? 1 : 0) },

  // ───────────── Scaling ─────────────
  scaleOnHand('river_stone', 'River Stone', 'straight', 'chips', 15, '⊸', 190),
  scaleOnHand('tidemark', 'Tidemark', 'flush', 'mult', 2, '⌇', 200),
  scaleOnHand('pair_bond', 'Pair Bond', 'twopair', 'mult', 2, '∞', 330),
  scaleOnHand('trip_wire', 'Trip Wire', 'three', 'chips', 12, '⋔', 60),
  scaleOnHand('steady_hand', 'Steady Hand', 'high', 'chips', 4, '☝', 90),
  { id: 'momentum', name: 'Momentum', rarity: 'rare', cost: 8, icon: { glyph: '➤', hue: 15 }, tags: ['scaling', 'xmult'], init: { v: 1 },
    desc: 'Gains ×0.2 Mult whenever you beat a blind with your first hand.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    onRoundEnd: (g, s) => { if ((g.run.round?.handsPlayed ?? 0) === 1) s.state.v = st(s) + 0.2; },
    main: (_c, s) => (st(s) > 1 ? { xmult: st(s) } : undefined) },
  { id: 'album', name: 'Collector’s Album', rarity: 'uncommon', cost: 6, icon: { glyph: '❒', hue: 30 }, tags: ['scaling', 'hand'],
    desc: '+3 Mult for each different hand type you have played this run.',
    main: (ctx) => ({ mult: 3 * ctx.run.handTypesSeen.length }) },
  { id: 'hoarder', name: 'Hoarder', rarity: 'common', cost: 4, icon: { glyph: '⚿', hue: 50 }, tags: ['consumable', 'chips'],
    desc: '+30 Chips for each consumable you hold.', main: (ctx) => (ctx.run.consumables.length ? { chips: 30 * ctx.run.consumables.length } : undefined) },
  { id: 'bonfire', name: 'Bonfire', rarity: 'uncommon', cost: 6, icon: { glyph: '♨', hue: 5 }, tags: ['scaling', 'shop'], init: { v: 0 },
    desc: 'Gains +4 Mult each time you sell a charm or consumable.', status: (s) => `Currently +${st(s)} Mult`,
    onOtherSold: (_g, s) => { s.state.v = st(s) + 4; }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'ledger', name: 'Ledger', rarity: 'common', cost: 5, icon: { glyph: '☷', hue: 140 }, tags: ['scaling', 'shop'], init: { v: 0 },
    desc: 'Gains +2 Mult every time you reroll the shop.', status: (s) => `Currently +${st(s)} Mult`,
    onReroll: (_g, s) => { s.state.v = st(s) + 2; }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'long_game', name: 'Long Game', rarity: 'common', cost: 4, icon: { glyph: '⏳', hue: 35 }, tags: ['scaling'], init: { v: 0 },
    desc: 'Gains +8 Chips at the end of every round.', status: (s) => `Currently +${st(s)} Chips`,
    onRoundEnd: (_g, s) => { s.state.v = st(s) + 8; }, main: (_c, s) => (st(s) ? { chips: st(s) } : undefined) },
  { id: 'patience', name: 'Patience', rarity: 'common', cost: 5, icon: { glyph: '⌚', hue: 160 }, tags: ['scaling', 'hands'], init: { v: 0 },
    desc: 'At end of round, gains +1 Mult for each hand you didn’t play.', status: (s) => `Currently +${st(s)} Mult`,
    onRoundEnd: (g, s) => { s.state.v = st(s) + (g.run.round?.handsLeft ?? 0); }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'cultivator', name: 'Cultivator', rarity: 'rare', cost: 8, icon: { glyph: '❁', hue: 100, hue2: 50 }, tags: ['scaling', 'xmult'], init: { v: 1 },
    desc: 'Gains ×0.02 Mult for every card scored.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    before: (ctx, s) => { s.state.v = st(s) + 0.02 * ctx.scoring.filter((c) => !ctx.isDebuffed(c)).length; },
    main: (_c, s) => (st(s) > 1 ? { xmult: st(s) } : undefined) },
  { id: 'hydra', name: 'Hydra', rarity: 'rare', cost: 8, icon: { glyph: '⚕', hue: 140, hue2: 280 }, tags: ['scaling', 'boss', 'xmult'], init: { v: 1 },
    desc: 'Gains ×0.5 Mult whenever you defeat a Boss blind.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    onBossDefeated: (_g, s) => { s.state.v = st(s) + 0.5; }, main: (_c, s) => (st(s) > 1 ? { xmult: st(s) } : undefined) },
  { id: 'lucky_streak', name: 'Lucky Streak', rarity: 'uncommon', cost: 6, icon: { glyph: '☘', hue: 135 }, tags: ['scaling', 'enhance', 'chance'], init: { v: 0 },
    desc: 'Gains +3 Mult every time a Fortune card pays out.', status: (s) => `Currently +${st(s)} Mult`,
    after: (ctx, s) => { s.state.v = st(s) + 3 * (ctx.run.flags.fortuneHits ?? 0); }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'constellation', name: 'Constellation Chart', rarity: 'uncommon', cost: 6, icon: { glyph: '✶', hue: 225 }, tags: ['consumable', 'scaling'],
    desc: '+2 Mult for every Star used this run.', main: (ctx) => (ctx.run.stats.starsUsed ? { mult: 2 * ctx.run.stats.starsUsed } : undefined) },
  { id: 'arcane_library', name: 'Arcane Library', rarity: 'uncommon', cost: 6, icon: { glyph: '⚝', hue: 285 }, tags: ['consumable', 'scaling'],
    desc: '+8 Chips for every Omen used this run.', main: (ctx) => (ctx.run.stats.omensUsed ? { chips: 8 * ctx.run.stats.omensUsed } : undefined) },
  { id: 'star_forge', name: 'Star Forge', rarity: 'rare', cost: 8, icon: { glyph: '✷', hue: 30, hue2: 230 }, tags: ['consumable', 'hand'],
    desc: 'Using a Star levels its hand up one extra time.',
    onConsumableUsed: (g, _s, kind, id) => { if (kind === 'star') { const h = STAR_HAND[id]; if (h) g.levelHand(h, 1); } } },

  // ───────────── Enhancement & deck synergies ─────────────
  { id: 'iron_lung', name: 'Iron Lung', rarity: 'uncommon', cost: 7, icon: { glyph: '⛓', hue: 210 }, tags: ['enhance', 'xmult'],
    desc: '×0.25 Mult for each Iron card in your full deck (plus ×1).',
    main: (ctx) => { const n = countDeck(ctx, (c) => c.enhancement === 'iron'); return n ? { xmult: 1 + 0.25 * n } : undefined; } },
  { id: 'masonry', name: 'Masonry', rarity: 'common', cost: 5, icon: { glyph: '▦', hue: 30 }, tags: ['enhance', 'chips'],
    desc: '+25 Chips for each Monolith card in your full deck.',
    main: (ctx) => { const n = countDeck(ctx, (c) => c.enhancement === 'monolith'); return n ? { chips: 25 * n } : undefined; } },
  { id: 'stonecutter', name: 'Stonecutter', rarity: 'common', cost: 4, icon: { glyph: '⛏', hue: 25 }, tags: ['enhance', 'chips'],
    desc: 'Scored Monolith cards give an extra +50 Chips.', onScored: (_c, _s, c) => (c.enhancement === 'monolith' ? { chips: 50 } : undefined) },
  { id: 'glass_menagerie', name: 'Glass Menagerie', rarity: 'uncommon', cost: 6, icon: { glyph: '❖', hue: 185 }, tags: ['enhance', 'rules'],
    desc: 'Crystal cards never shatter, but give ×1.5 Mult instead of ×2.', rules: ['unbreakable'] },
  { id: 'blacksmith', name: 'Blacksmith', rarity: 'uncommon', cost: 6, icon: { glyph: '⚒', hue: 15 }, tags: ['enhance', 'held'],
    desc: 'Iron cards held in hand give an extra ×1.25 Mult.', onHeld: (_c, _s, c) => (c.enhancement === 'iron' ? { xmult: 1.25 } : undefined) },
  { id: 'wild_child', name: 'Wild Child', rarity: 'uncommon', cost: 6, icon: { glyph: '✺', hue: 290 }, tags: ['enhance', 'xmult'],
    desc: 'Scored Prism cards give ×1.5 Mult.', onScored: (_c, _s, c) => (c.enhancement === 'prism' ? { xmult: 1.5 } : undefined) },
  { id: 'gilded_frame', name: 'Gilded Frame', rarity: 'common', cost: 4, icon: { glyph: '▤', hue: 45 }, tags: ['enhance', 'mult'],
    desc: 'Scored Plated cards also give +4 Mult.', onScored: (_c, _s, c) => (c.enhancement === 'plated' ? { mult: 4 } : undefined) },
  { id: 'enchanter', name: 'Enchanter', rarity: 'common', cost: 5, icon: { glyph: '✦', hue: 270 }, tags: ['enhance', 'mult'],
    desc: 'Scored enhanced cards give +3 Mult.', onScored: (_c, _s, c) => (c.enhancement ? { mult: 3 } : undefined) },
  { id: 'vanilla', name: 'Vanilla Bean', rarity: 'common', cost: 4, icon: { glyph: '❍', hue: 45 }, tags: ['chips'],
    desc: 'Scored cards with no enhancement give +12 Chips.', onScored: (_c, _s, c) => (!c.enhancement ? { chips: 12 } : undefined) },
  { id: 'editor', name: 'Editor’s Cut', rarity: 'uncommon', cost: 6, icon: { glyph: '✐', hue: 300 }, tags: ['edition', 'xmult'],
    desc: 'Scored cards with an edition give ×1.25 Mult.', onScored: (_c, _s, c) => (c.edition ? { xmult: 1.25 } : undefined) },
  { id: 'seal_collector', name: 'Seal Collector', rarity: 'common', cost: 4, icon: { glyph: '⊕', hue: 350 }, tags: ['seal', 'chips'],
    desc: '+12 Chips for each sealed card in your full deck.',
    main: (ctx) => { const n = countDeck(ctx, (c) => !!c.seal); return n ? { chips: 12 * n } : undefined; } },
  { id: 'wildfire', name: 'Wildfire', rarity: 'common', cost: 5, icon: { glyph: '♆', hue: 10 }, tags: ['enhance', 'mult'],
    desc: '+1 Mult for each Ember card in your full deck.',
    main: (ctx) => { const n = countDeck(ctx, (c) => c.enhancement === 'ember'); return n ? { mult: n } : undefined; } },
  { id: 'card_counter', name: 'Card Counter', rarity: 'common', cost: 5, icon: { glyph: '⊟', hue: 205 }, tags: ['deck', 'chips'],
    desc: '+2 Chips for each card remaining in your draw pile.',
    main: (ctx) => ((ctx.run.round?.drawPile.length ?? 0) ? { chips: 2 * ctx.run.round!.drawPile.length } : undefined) },
  { id: 'thin_deck', name: 'Lean Machine', rarity: 'uncommon', cost: 6, icon: { glyph: '⫶', hue: 0 }, tags: ['deck', 'mult'],
    desc: '+2 Mult for every card fewer than 52 in your full deck.',
    main: (ctx) => (ctx.run.deck.length < 52 ? { mult: 2 * (52 - ctx.run.deck.length) } : undefined) },
  { id: 'fat_deck', name: 'Overstuffed', rarity: 'common', cost: 4, icon: { glyph: '⊞', hue: 30 }, tags: ['deck', 'chips'],
    desc: '+5 Chips for every card above 52 in your full deck.',
    main: (ctx) => (ctx.run.deck.length > 52 ? { chips: 5 * (ctx.run.deck.length - 52) } : undefined) },

  // ───────────── Charm synergies ─────────────
  { id: 'crowd', name: 'Crowd Pleaser', rarity: 'common', cost: 4, icon: { glyph: '☻', hue: 15 }, tags: ['synergy', 'mult'],
    desc: '+3 Mult for each charm you own.', main: (ctx) => ({ mult: 3 * ctx.run.charms.length }) },
  { id: 'common_ground', name: 'Common Ground', rarity: 'common', cost: 4, icon: { glyph: '◌', hue: 90 }, tags: ['synergy', 'mult'],
    desc: '+4 Mult for each Common charm you own.',
    main: (ctx) => { const n = ctx.run.charms.filter((c) => CHARM_MAP[c.id]?.rarity === 'common').length; return n ? { mult: 4 * n } : undefined; } },
  { id: 'rarity_hunter', name: 'Rarity Hunter', rarity: 'rare', cost: 8, icon: { glyph: '◈', hue: 0, hue2: 300 }, tags: ['synergy', 'xmult'],
    desc: 'Each Uncommon or Rare charm gives ×1.2 Mult.',
    main: (ctx) => {
      const n = ctx.run.charms.filter((c) => { const r = CHARM_MAP[c.id]?.rarity; return r === 'uncommon' || r === 'rare'; }).length;
      return n ? { xmult: Math.pow(1.2, n) } : undefined;
    } },
  { id: 'exponent', name: 'Exponent', rarity: 'rare', cost: 9, icon: { glyph: '^', hue: 200, hue2: 320 }, tags: ['synergy', 'xmult'],
    desc: '×1.1 Mult for each other charm you own, compounding.',
    main: (ctx) => { const n = ctx.run.charms.length - 1; return n > 0 ? { xmult: Math.pow(1.1, n) } : undefined; } },
  { id: 'mimic', name: 'Mimic', rarity: 'rare', cost: 10, icon: { glyph: '⧉', hue: 200, hue2: 260 }, tags: ['synergy', 'copy'],
    desc: 'Copies the ability of the charm to its right.', copies: 'right' },
  { id: 'echo_idol', name: 'Echo Idol', rarity: 'rare', cost: 10, icon: { glyph: '⧈', hue: 320, hue2: 30 }, tags: ['synergy', 'copy'],
    desc: 'Copies the ability of your leftmost charm.', copies: 'left' },
  { id: 'avalanche', name: 'Avalanche', rarity: 'rare', cost: 8, icon: { glyph: '▲', hue: 195 }, tags: ['xmult'],
    desc: 'Each scored card gives ×1.1 Mult.', onScored: () => ({ xmult: 1.1 }) },

  // ───────────── Rule changers ─────────────
  { ...rule('loaded_dice', 'Loaded Dice', 'loadedDice', 'Doubles all listed probabilities (e.g. 1 in 4 becomes 2 in 4).', '⚄', 0) },
  { ...rule('bridge', 'Rope Bridge', 'bridge', 'Straights may skip one rank between cards (e.g. 2 4 5 7 8).', '⌒', 35) },
  { ...rule('short_hand', 'Short Hand', 'shortHand', 'Flushes and Straights can be made with 4 cards.', '✋', 210) },
  { ...rule('blurred_ink', 'Blurred Ink', 'blurred', 'Hearts and Diamonds count as the same suit, as do Spades and Clubs.', '☁', 300) },
  { ...rule('open_book', 'Open Book', 'openBook', 'Every played card counts as scoring.', '⎙', 45) },
  { ...rule('lightning_rod', 'Lightning Rod', 'noDebuff', 'Playing cards can’t be debuffed.', 'ϟ', 55, 'rare') },

  // ───────────── Risk & reward ─────────────
  { id: 'glass_cannon', name: 'Glass Cannon', rarity: 'uncommon', cost: 6, icon: { glyph: '☄', hue: 190 }, tags: ['xmult', 'risk'],
    desc: '×3 Mult. 1 in 6 chance to shatter at end of round.',
    main: () => ({ xmult: 3 }),
    onRoundEnd: (g, s) => { if (g.chance(1, 6, 'charmbreak')) { g.removeCharm(s.uid); g.log('Glass Cannon shattered!'); } } },
  { id: 'all_in', name: 'All-In', rarity: 'uncommon', cost: 6, icon: { glyph: '⛁', hue: 0 }, tags: ['xmult', 'risk'],
    desc: '×2.5 Mult on the final hand of a round.', main: (ctx) => (ctx.lastHand ? { xmult: 2.5 } : undefined) },
  { id: 'opening_gambit', name: 'Opening Gambit', rarity: 'common', cost: 5, icon: { glyph: '♞', hue: 120 }, tags: ['xmult'],
    desc: '×1.5 Mult on the first hand of a round.', main: (ctx) => (ctx.firstHand ? { xmult: 1.5 } : undefined) },
  { id: 'overclock', name: 'Overclock', rarity: 'common', cost: 5, icon: { glyph: '⚡', hue: 280 }, tags: ['mult', 'risk', 'destroy'],
    desc: '+12 Mult. 1 in 8 chance to destroy a random scored card.',
    main: (ctx) => ({ mult: 12 }),
    after: (ctx) => {
      if (ctx.scoring.length && ctx.chance(1, 8)) {
        const c = ctx.scoring[Math.floor(ctx.rand('luck') * ctx.scoring.length)];
        ctx.toDestroy.add(c.id);
      }
    } },
  { id: 'revolver', name: 'Revolver', rarity: 'uncommon', cost: 6, icon: { glyph: '⦿', hue: 20 }, tags: ['xmult', 'chance'],
    desc: '1 in 6 chance for ×6 Mult.', main: (ctx) => (ctx.chance(1, 6) ? { xmult: 6 } : { msg: 'Click.' }) },
  { id: 'underdog', name: 'Underdog', rarity: 'uncommon', cost: 6, icon: { glyph: '⇡', hue: 35 }, tags: ['xmult'],
    desc: '×2 Mult if your round score is below half the target before this hand.',
    main: (ctx) => (ctx.scoreBefore < ctx.target / 2 ? { xmult: 2 } : undefined) },
  { id: 'clutch', name: 'Clutch', rarity: 'common', cost: 4, icon: { glyph: '✪', hue: 15 }, tags: ['mult'],
    desc: '+20 Mult if your round score is below a quarter of the target before this hand.',
    main: (ctx) => (ctx.scoreBefore < ctx.target / 4 ? { mult: 20 } : undefined) },
  { id: 'insurance', name: 'Insurance Policy', rarity: 'uncommon', cost: 6, icon: { glyph: '⛨', hue: 140 }, tags: ['risk'],
    desc: 'Prevents defeat once if you scored at least 50% of the target. Then it is consumed.', noCopy: true },
  { id: 'double_or_nothing', name: 'Double or Nothing', rarity: 'rare', cost: 7, icon: { glyph: '⚀', hue: 340 }, tags: ['economy', 'risk'],
    desc: 'At end of round: 1 in 2 chance to double your money (max +$25), otherwise lose half (rounded down).',
    payout: (g) => {
      const m = Math.max(0, g.run.money);
      return g.chance(1, 2, 'payout') ? Math.min(25, m) : -Math.floor(m / 2);
    }, noCopy: true },

  // ───────────── Round & boss specific ─────────────
  { id: 'warm_up', name: 'Warm Up', rarity: 'common', cost: 4, icon: { glyph: '☀', hue: 50 }, tags: ['round', 'mult'],
    desc: '+15 Mult during Small blinds.', main: (ctx) => (ctx.run.round?.blindType === 'small' ? { mult: 15 } : undefined) },
  { id: 'big_game', name: 'Big Game Hunter', rarity: 'common', cost: 4, icon: { glyph: '⌖', hue: 25 }, tags: ['round', 'mult'],
    desc: '+15 Mult during Big blinds.', main: (ctx) => (ctx.run.round?.blindType === 'big' ? { mult: 15 } : undefined) },
  { id: 'boss_slayer', name: 'Boss Slayer', rarity: 'uncommon', cost: 7, icon: { glyph: '⚔', hue: 0 }, tags: ['round', 'boss', 'xmult'],
    desc: '×2 Mult during Boss blinds.', main: (ctx) => (ctx.run.round?.blindType === 'boss' ? { xmult: 2 } : undefined) },
  { id: 'scout', name: 'Scout', rarity: 'uncommon', cost: 6, icon: { glyph: '⌕', hue: 160 }, tags: ['boss'],
    desc: 'Boss blinds require 25% less score.', mods: (m, run) => { if (run.round?.blindType === 'boss' || (run.phase === 'blindSelect' && run.blindIndex === 2)) m.targetMult *= 0.75; } },
  { id: 'night_shift', name: 'Night Shift', rarity: 'uncommon', cost: 6, icon: { glyph: '☽', hue: 245 }, tags: ['boss', 'hands'],
    desc: '+1 hand and +1 discard during Boss blinds.', mods: (m, run) => { if (run.round?.blindType === 'boss') { m.hands += 1; m.discards += 1; } } },
  { id: 'wardbreaker', name: 'Wardbreaker', rarity: 'uncommon', cost: 6, icon: { glyph: '⚚', hue: 300 }, tags: ['boss'],
    desc: 'Sell this charm to disable the current Boss blind’s effect.', noCopy: true,
    onSell: (g) => { if (g.run.round?.bossId) { g.run.round.bossDisabled = true; g.log('Boss effect disabled!'); } } },
  { id: 'patron_saint', name: 'Patron Saint', rarity: 'rare', cost: 8, icon: { glyph: '✠', hue: 50 }, tags: ['boss'],
    desc: 'Every Boss blind effect is disabled while you hold this.', noCopy: true,
    onRoundStart: (g) => { if (g.run.round?.bossId) g.run.round.bossDisabled = true; } },
  { id: 'skipper', name: 'Skipping Stone', rarity: 'common', cost: 4, icon: { glyph: '◦', hue: 190 }, tags: ['skip', 'scaling'],
    desc: '+5 Mult for every blind you have skipped this run.', main: (ctx) => (ctx.run.stats.blindsSkipped ? { mult: 5 * ctx.run.stats.blindsSkipped } : undefined) },
  { id: 'early_bird', name: 'Early Bird', rarity: 'common', cost: 4, icon: { glyph: '☼', hue: 60 }, tags: ['round', 'chips'],
    desc: '+60 Chips on the first hand of each round.', main: (ctx) => (ctx.firstHand ? { chips: 60 } : undefined) },
  { id: 'closer', name: 'The Closer', rarity: 'common', cost: 4, icon: { glyph: '⏹', hue: 0 }, tags: ['round', 'mult'],
    desc: '+20 Mult on the final hand of a round.', main: (ctx) => (ctx.lastHand ? { mult: 20 } : undefined) },
  { id: 'ante_up', name: 'Ante Up', rarity: 'common', cost: 4, icon: { glyph: '⇧', hue: 280 }, tags: ['scaling', 'mult'],
    desc: '+3 Mult for each Ante reached.', main: (ctx) => ({ mult: 3 * ctx.run.ante }) },

  // ───────────── More combo & synergy ─────────────
  { id: 'chain_link', name: 'Chain Link', rarity: 'uncommon', cost: 6, icon: { glyph: '⛓', hue: 40 }, tags: ['combo', 'scaling'], init: { v: 0, last: -1 },
    desc: 'Gains +3 Mult each time you play the same hand type twice in a row; resets otherwise.', status: (s) => `Currently +${st(s)} Mult`,
    before: (ctx, s) => {
      const idx = handRank(ctx.hand);
      s.state.v = st(s, 'last') === idx ? st(s) + 3 : 0;
      s.state.last = idx;
    }, main: (_c, s) => (st(s) ? { mult: st(s) } : undefined) },
  { id: 'variety_show', name: 'Variety Show', rarity: 'uncommon', cost: 6, icon: { glyph: '☲', hue: 320 }, tags: ['combo'],
    desc: '×1.5 Mult if the played hand type hasn’t been played yet this round.',
    main: (ctx) => ((ctx.run.round?.handTypesPlayed.filter((h) => h === ctx.hand).length ?? 0) <= 1 ? { xmult: 1.5 } : undefined) },
  { id: 'high_roller', name: 'High Roller', rarity: 'common', cost: 4, icon: { glyph: '⬆', hue: 50 }, tags: ['rank', 'chips'],
    desc: 'Adds the rank chips of your highest held card to Chips.',
    main: (ctx) => {
      const held = ctx.held.filter((c) => hasRank(c) && !ctx.isDebuffed(c));
      if (!held.length) return undefined;
      const top = held.reduce((a, b) => (b.rank > a.rank ? b : a));
      return { chips: top.rank === 14 ? 11 : Math.min(10, top.rank) };
    } },
  { id: 'lowball', name: 'Lowball', rarity: 'common', cost: 4, icon: { glyph: '⬇', hue: 210 }, tags: ['rank', 'held'],
    desc: 'Adds double the rank of your lowest held card to Mult.',
    main: (ctx) => {
      const held = ctx.held.filter((c) => hasRank(c) && !ctx.isDebuffed(c));
      if (!held.length) return undefined;
      const low = held.reduce((a, b) => (b.rank < a.rank ? b : a));
      return { mult: 2 * (low.rank === 14 ? 1 : low.rank) };
    } },
  { id: 'pocket_aces', name: 'Pocket Aces', rarity: 'uncommon', cost: 6, icon: { glyph: '⁂', hue: 0 }, tags: ['rank', 'held'],
    desc: 'Aces held in hand give +8 Mult.', onHeld: (_c, _s, c) => (hasRank(c) && c.rank === 14 ? { mult: 8 } : undefined) },
  { id: 'red_alert', name: 'Red Alert', rarity: 'common', cost: 4, icon: { glyph: '◆', hue: 355 }, tags: ['suit', 'held'],
    desc: 'Red cards held in hand give +2 Mult.', onHeld: (_c, _s, c) => (hasRank(c) && isRed(c.suit) ? { mult: 2 } : undefined) },
  { id: 'black_out', name: 'Midnight Oil', rarity: 'common', cost: 4, icon: { glyph: '◼', hue: 240 }, tags: ['suit', 'held'],
    desc: 'Black cards held in hand give +15 Chips.', onHeld: (_c, _s, c) => (hasRank(c) && !isRed(c.suit) ? { chips: 15 } : undefined) },
  { id: 'suit_up', name: 'Suit Up', rarity: 'uncommon', cost: 6, icon: { glyph: '♤', hue: 10 }, tags: ['suit', 'held'],
    desc: '×1.5 Mult if all cards held in hand share a suit.',
    main: (ctx) => {
      const held = ctx.held.filter(hasRank);
      if (!held.length) return undefined;
      const suits: Suit[] = ['S', 'H', 'D', 'C'];
      return suits.some((s) => held.every((c) => ctx.suitIs(c, s))) ? { xmult: 1.5 } : undefined;
    } },
  { id: 'empty_hand', name: 'Empty Hand', rarity: 'uncommon', cost: 6, icon: { glyph: '◯', hue: 50 }, tags: ['held', 'xmult'],
    desc: '×2 Mult if you have 2 or fewer cards left in hand after playing.', main: (ctx) => (ctx.held.length <= 2 ? { xmult: 2 } : undefined) },
  { id: 'crystal_ball', name: 'Crystal Ball', rarity: 'common', cost: 4, icon: { glyph: '⚪', hue: 270 }, tags: ['chance', 'consumable'],
    desc: '1 in 5 chance to create a Star for the played hand.',
    after: (ctx) => { if (ctx.chance(1, 5)) { const sid = STAR_FOR[ctx.hand]; if (sid) ctx.createConsumable('star', sid); } } },
  { id: 'tarot_tax', name: 'Augury', rarity: 'common', cost: 4, icon: { glyph: '☉', hue: 45 }, tags: ['consumable', 'economy'],
    desc: 'Earn $2 whenever you use an Omen.', onConsumableUsed: (g, _s, kind) => { if (kind === 'omen') g.addMoney(2); } },
  { id: 'astronomer', name: 'Astronomer', rarity: 'uncommon', cost: 6, icon: { glyph: '⊚', hue: 220 }, tags: ['consumable', 'shop'],
    desc: 'Stars and Star packs in the shop are free.', mods: (m) => { m.rules.add('freeStars'); } },
  { id: 'shopaholic', name: 'Shopaholic', rarity: 'uncommon', cost: 6, icon: { glyph: '⊕', hue: 330 }, tags: ['shop'],
    desc: '+1 item slot in the shop.', mods: (m) => { m.shopSlots += 1; } },
  { id: 'bargain_bin', name: 'Bargain Bin', rarity: 'common', cost: 4, icon: { glyph: '⊻', hue: 100 }, tags: ['shop'],
    desc: 'Rerolls cost $1 less.', mods: (m) => { m.rerollDiscount += 1; } },
  { id: 'connoisseur', name: 'Connoisseur', rarity: 'uncommon', cost: 6, icon: { glyph: '♢', hue: 280 }, tags: ['shop', 'edition'],
    desc: 'Charms in the shop are three times as likely to have an edition.', mods: (m) => { m.editionRate *= 3; } },
  { id: 'talent_scout', name: 'Talent Scout', rarity: 'uncommon', cost: 6, icon: { glyph: '⚑', hue: 40 }, tags: ['shop'],
    desc: 'Uncommon and Rare charms appear twice as often.', mods: (m) => { m.rarityBoost *= 2; } },
  { id: 'card_shark', name: 'Card Shark', rarity: 'common', cost: 4, icon: { glyph: '🂠', hue: 200 }, tags: ['shop', 'deck'],
    desc: 'Playing cards can appear in the shop.', mods: (m) => { m.cardRate += 4; } },
  { id: 'souvenir', name: 'Souvenir', rarity: 'common', cost: 4, icon: { glyph: '✾', hue: 300 }, tags: ['shop', 'scaling'], init: { v: 0 },
    desc: 'Gains +10 Chips every time you buy something.', status: (s) => `Currently +${st(s)} Chips`,
    onBuy: (_g, s) => { s.state.v = st(s) + 10; }, main: (_c, s) => (st(s) ? { chips: st(s) } : undefined) },
  { id: 'pack_rat', name: 'Pack Rat', rarity: 'common', cost: 4, icon: { glyph: '⊡', hue: 30 }, tags: ['pack', 'economy'],
    desc: 'Earn $3 whenever you skip a pack.', onPackSkipped: (g) => g.addMoney(3) },
  { id: 'lucky_cat', name: 'Beckoning Cat', rarity: 'uncommon', cost: 6, icon: { glyph: '✋', hue: 45 }, tags: ['chance', 'enhance'],
    desc: 'Fortune cards are twice as likely to pay out.', mods: (m) => { m.rules.add('luckyFortune'); } },
  { id: 'magnetism', name: 'Magnetism', rarity: 'common', cost: 5, icon: { glyph: '⊃', hue: 320 }, tags: ['enhance', 'held'],
    desc: 'Magnet cards held in hand give an extra +4 Mult.', onHeld: (_c, _s, c) => (c.enhancement === 'magnet' ? { mult: 4 } : undefined) },
  { id: 'voltage', name: 'High Voltage', rarity: 'uncommon', cost: 6, icon: { glyph: 'ϟ', hue: 58 }, tags: ['enhance', 'xmult'],
    desc: 'Scored Volt cards give ×1.25 Mult.', onScored: (_c, _s, c) => (c.enhancement === 'volt' ? { xmult: 1.25 } : undefined) },
  { id: 'fortune_teller', name: 'Palm Reader', rarity: 'common', cost: 4, icon: { glyph: '✋', hue: 300 }, tags: ['consumable', 'mult'],
    desc: '+1 Mult for every Omen used this run.', main: (ctx) => (ctx.run.stats.omensUsed ? { mult: ctx.run.stats.omensUsed } : undefined) },
  { id: 'specter', name: 'Specter', rarity: 'uncommon', cost: 6, icon: { glyph: '☁', hue: 250 }, tags: ['consumable', 'xmult'],
    desc: '×0.2 Mult for every Hex used this run (plus ×1).', main: (ctx) => (ctx.run.stats.hexesUsed ? { xmult: 1 + 0.2 * ctx.run.stats.hexesUsed } : undefined) },
  { id: 'tinkerer', name: 'Tinkerer', rarity: 'uncommon', cost: 6, icon: { glyph: '⚙', hue: 190 }, tags: ['edition'],
    desc: 'When a round ends, 1 in 4 chance a random charm without an edition gains Shimmer, Aurora or Spectrum.',
    onRoundEnd: (g) => {
      if (!g.chance(1, 4)) return;
      const pool = g.run.charms.filter((c) => !c.edition);
      if (!pool.length) return;
      const c = pool[Math.floor(g.rand('gen') * pool.length)];
      c.edition = (['shimmer', 'aurora', 'spectrum'] as const)[Math.floor(g.rand('gen') * 3)];
      void CHARM_EDITION_IDS;
    } },

  // ───────────── Legendary ─────────────
  { id: 'morrow', name: 'Morrow, Keeper of Echoes', rarity: 'legendary', cost: 20, icon: { glyph: '♾', hue: 190, hue2: 280 }, tags: ['legendary', 'retrigger'],
    desc: 'Retrigger every scored card once.', retrigScored: () => 1 },
  { id: 'vesper', name: 'Vesper, the Night Queen', rarity: 'legendary', cost: 20, icon: { glyph: '♛', hue: 270, hue2: 330 }, tags: ['legendary', 'face'],
    desc: 'Scored Queens give ×2 Mult. Queens held in hand give ×1.5 Mult.',
    onScored: (_c, _s, c) => (hasRank(c) && c.rank === 12 ? { xmult: 2 } : undefined),
    onHeld: (_c, _s, c) => (hasRank(c) && c.rank === 12 ? { xmult: 1.5 } : undefined) },
  { id: 'ignis', name: 'Ignis, the Undying', rarity: 'legendary', cost: 20, icon: { glyph: '♨', hue: 10, hue2: 50 }, tags: ['legendary', 'destroy'], init: { v: 1 },
    desc: 'Gains ×0.75 Mult every time a playing card is destroyed.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    onCardsDestroyed: (_g, s, cards) => { s.state.v = st(s) + 0.75 * cards.length; }, main: (_c, s) => (st(s) > 1 ? { xmult: st(s) } : undefined) },
  { id: 'aurelia', name: 'Aurelia, the Gilded', rarity: 'legendary', cost: 20, icon: { glyph: '☀', hue: 45, hue2: 20 }, tags: ['legendary', 'economy'],
    desc: 'Earn your interest a second time at end of round. ×2 Mult while you have $25 or more.',
    payout: (g) => Math.min(g.mods.interestCap, Math.floor(Math.max(0, g.run.money) / g.mods.interestPer)),
    main: (ctx) => (ctx.run.money >= 25 ? { xmult: 2 } : undefined) },
  { id: 'old_tom', name: 'Old Tom, the Hoarder', rarity: 'legendary', cost: 20, icon: { glyph: '⚿', hue: 30, hue2: 260 }, tags: ['legendary', 'consumable'],
    desc: 'When you leave the shop, create a Void copy of a random consumable you hold.', noCopy: true,
    onShopExit: (g) => {
      const pool = g.run.consumables;
      if (!pool.length) return;
      const c = pool[Math.floor(g.rand('gen') * pool.length)];
      g.createConsumable(c.kind, c.id, 'void');
    } },
  { id: 'ouroboros', name: 'Ouroboros', rarity: 'legendary', cost: 20, icon: { glyph: '◯', hue: 140, hue2: 50 }, tags: ['legendary', 'scaling'], init: { v: 2 },
    desc: 'Starts at ×2 Mult and gains ×1 Mult whenever you defeat a Boss blind.', status: (s) => `Currently ×${fmt(st(s))} Mult`,
    onBossDefeated: (_g, s) => { s.state.v = st(s) + 1; }, main: (_c, s) => ({ xmult: st(s) }) },
];

// Hand → Star id map (filled by consumables module to avoid circular data).
export const STAR_FOR: Partial<Record<HandType, string>> = {};
export const STAR_HAND: Record<string, HandType> = {};

export const CHARM_MAP: Record<string, CharmDef> = Object.fromEntries(CHARMS.map((c) => [c.id, c]));

// Unlock requirements for a subset of charms (achievement ids defined in progression).
const UNLOCKS: Record<string, string> = {
  mimic: 'ach_win', echo_idol: 'ach_ante8_twice', gilded_idol: 'ach_rich', exponent: 'ach_charms5',
  royal_decree: 'ach_royal', mirror_ball: 'ach_editions', ace_pilot: 'ach_aces', patron_saint: 'ach_boss10',
  lightning_rod: 'ach_boss5', double_tap: 'ach_pairs', avalanche: 'ach_score100k', rarity_hunter: 'ach_rares',
  cultivator: 'ach_hands100', hydra: 'ach_ante6', phoenix_feather: 'ach_destroy10', leech_ring: 'ach_enhance10',
  heart_of_gold: 'ach_hearts', star_forge: 'ach_stars10', kingmaker: 'ach_kings', double_or_nothing: 'ach_money100',
};
for (const [id, ach] of Object.entries(UNLOCKS)) if (CHARM_MAP[id]) CHARM_MAP[id].unlock = ach;

export type { ScoreCtx };
