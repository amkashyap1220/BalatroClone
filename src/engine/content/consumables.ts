// Consumables: Omens (card manipulation), Stars (hand upgrades) and Hexes (powerful, risky effects).
import type { Card, EnhancementId, HandType, SealId, Suit } from '../types';
import { HAND_ORDER } from '../types';
import type { ConsumableDef } from './defs';
import { HANDS } from '../hands';
import { copyCard, makeCard } from '../cards';
import { CHARMS, STAR_FOR, STAR_HAND } from './charms';
import { charmSellValue, type GameCtx } from '../core';

const ENH_POOL: EnhancementId[] = ['plated', 'ember', 'crystal', 'iron', 'treasure', 'fortune', 'prism', 'volt', 'magnet'];
const SUITS: Suit[] = ['S', 'H', 'D', 'C'];

function enhanceOmen(id: string, name: string, enh: EnhancementId, max: number, glyph: string, hue: number, label: string): ConsumableDef {
  return {
    id, kind: 'omen', name, cost: 3, icon: { glyph, hue }, select: [1, max],
    desc: `Turn up to ${max} selected card${max > 1 ? 's' : ''} into ${label} card${max > 1 ? 's' : ''}.`,
    use: (_g, sel) => { for (const c of sel) c.enhancement = enh; },
  };
}
function suitOmen(id: string, name: string, suit: Suit, glyph: string, hue: number, label: string): ConsumableDef {
  return {
    id, kind: 'omen', name, cost: 3, icon: { glyph, hue }, select: [1, 3],
    desc: `Convert up to 3 selected cards to ${label}.`,
    use: (_g, sel) => { for (const c of sel) c.suit = suit; },
  };
}
function sealHex(id: string, name: string, seal: SealId, glyph: string, hue: number, label: string): ConsumableDef {
  return {
    id, kind: 'hex', name, cost: 4, icon: { glyph, hue }, select: [1, 1],
    desc: `Add a ${label} to 1 selected card.`,
    use: (_g, sel) => { sel[0].seal = seal; },
  };
}
function randomEnhancedCard(g: GameCtx, ranks: number[]): Card {
  const r = ranks[Math.floor(g.rand('gen') * ranks.length)];
  const s = SUITS[Math.floor(g.rand('gen') * 4)];
  const c = makeCard(g.run, r, s);
  c.enhancement = ENH_POOL[Math.floor(g.rand('gen') * ENH_POOL.length)];
  return c;
}
function destroyRandomInHand(g: GameCtx, exclude: Set<string> = new Set()) {
  const hand = g.handCards().filter((c) => !exclude.has(c.id));
  if (!hand.length) return;
  const c = hand[Math.floor(g.rand('gen') * hand.length)];
  g.destroyCards([c.id]);
}

export const OMENS: ConsumableDef[] = [
  enhanceOmen('omen_smith', 'The Smith', 'plated', 2, '⚒', 210, 'Plated'),
  enhanceOmen('omen_kindler', 'The Kindler', 'ember', 2, '♨', 5, 'Ember'),
  enhanceOmen('omen_glassblower', 'The Glassblower', 'crystal', 1, '❖', 185, 'Crystal'),
  enhanceOmen('omen_forge', 'The Forge', 'iron', 2, '⚙', 220, 'Iron'),
  enhanceOmen('omen_miser', 'The Miser', 'treasure', 2, '⚜', 45, 'Treasure'),
  enhanceOmen('omen_gambler', 'The Gambler', 'fortune', 2, '⚂', 140, 'Fortune'),
  enhanceOmen('omen_prism', 'The Prism', 'prism', 2, '✺', 285, 'Prism'),
  enhanceOmen('omen_mason', 'The Mason', 'monolith', 1, '▦', 30, 'Monolith'),
  enhanceOmen('omen_conductor', 'The Conductor', 'volt', 2, 'ϟ', 55, 'Volt'),
  enhanceOmen('omen_lodestone', 'The Lodestone', 'magnet', 2, '⊃', 320, 'Magnet'),
  suitOmen('omen_rose', 'The Rose', 'H', '❀', 350, 'Hearts'),
  suitOmen('omen_lantern', 'The Lantern', 'D', '☼', 35, 'Diamonds'),
  suitOmen('omen_raven', 'The Raven', 'S', '♤', 250, 'Spades'),
  suitOmen('omen_grove', 'The Grove', 'C', '☘', 120, 'Clubs'),
  { id: 'omen_climber', kind: 'omen', name: 'The Climber', cost: 3, icon: { glyph: '⇧', hue: 90 }, select: [1, 2],
    desc: 'Raise the rank of up to 2 selected cards by 1 (Aces wrap to 2).',
    use: (_g, sel) => { for (const c of sel) c.rank = c.rank === 14 ? 2 : c.rank + 1; } },
  { id: 'omen_mirror', kind: 'omen', name: 'The Mirror', cost: 3, icon: { glyph: '⧉', hue: 200 }, select: [2, 2],
    desc: 'Select 2 cards: the left card becomes an exact copy of the right card.',
    use: (_g, sel) => {
      const [left, right] = sel;
      Object.assign(left, { ...right, id: left.id });
    } },
  { id: 'omen_reaper', kind: 'omen', name: 'The Reaper', cost: 3, icon: { glyph: '⚰', hue: 0 }, select: [1, 2],
    desc: 'Destroy up to 2 selected cards.', use: (g, sel) => g.destroyCards(sel.map((c) => c.id)) },
  { id: 'omen_twins', kind: 'omen', name: 'The Twins', cost: 3, icon: { glyph: '♊', hue: 300 }, select: [1, 1],
    desc: 'Add a permanent copy of 1 selected card to your hand.', use: (g, sel) => g.addCard(copyCard(g.run, sel[0]), true) },
  { id: 'omen_banker', kind: 'omen', name: 'The Banker', cost: 3, icon: { glyph: '$', hue: 100 }, desc: 'Double your money (max +$20).',
    use: (g) => g.addMoney(Math.min(20, Math.max(0, g.run.money))) },
  { id: 'omen_collector', kind: 'omen', name: 'The Collector', cost: 3, icon: { glyph: '⚖', hue: 45 },
    desc: 'Earn the total sell value of your charms (max $50).',
    use: (g) => g.addMoney(Math.min(50, g.run.charms.reduce((s, c) => s + charmSellValue(g.run, c, g.mods), 0))) },
  { id: 'omen_seer', kind: 'omen', name: 'The Seer', cost: 3, icon: { glyph: '☉', hue: 230 }, desc: 'Create up to 2 random Stars (must have room).',
    use: (g) => { g.createConsumable('star'); g.createConsumable('star'); } },
  { id: 'omen_echo', kind: 'omen', name: 'The Echo', cost: 3, icon: { glyph: '↺', hue: 270 },
    desc: 'Create a copy of the last Omen or Star you used this run (not The Echo).',
    canUse: (g) => !!g.run.lastConsumable && g.run.lastConsumable !== 'omen_echo' && g.hasConsumableRoom(),
    use: (g) => { if (g.run.lastConsumable) g.createConsumable(CONSUMABLE_MAP[g.run.lastConsumable].kind, g.run.lastConsumable); } },
  { id: 'omen_coin', kind: 'omen', name: 'The Coin Toss', cost: 3, icon: { glyph: '◐', hue: 50 },
    desc: '1 in 4 chance to add Shimmer, Aurora or Spectrum to a random charm without an edition.',
    canUse: (g) => g.run.charms.some((c) => !c.edition),
    use: (g) => {
      if (!g.chance(1, 4)) { g.log('The coin landed tails.'); return; }
      const pool = g.run.charms.filter((c) => !c.edition);
      const c = pool[Math.floor(g.rand('gen') * pool.length)];
      c.edition = (['shimmer', 'aurora', 'spectrum'] as const)[Math.floor(g.rand('gen') * 3)];
    } },
  { id: 'omen_patron', kind: 'omen', name: 'The Patron', cost: 3, icon: { glyph: '☺', hue: 160 },
    desc: 'Create a random Common or Uncommon charm (must have room).', canUse: (g) => g.hasCharmRoom(),
    use: (g) => { g.createCharm(g.randomCharmId(g.rand('gen') < 0.7 ? 'common' : 'uncommon', 'gen')); } },
  { id: 'omen_wanderer', kind: 'omen', name: 'The Wanderer', cost: 3, icon: { glyph: '✧', hue: 180 },
    desc: 'Create up to 2 random Omens (must have room).',
    use: (g) => {
      for (let i = 0; i < 2; i++) {
        const pool = OMENS.filter((o) => o.id !== 'omen_wanderer');
        g.createConsumable('omen', pool[Math.floor(g.rand('gen') * pool.length)].id);
      }
    } },
];

const STAR_NAMES: [HandType, string, number][] = [
  ['high', 'Sirius', 200], ['pair', 'Vega', 220], ['twopair', 'Rigel', 190], ['three', 'Altair', 40],
  ['straight', 'Deneb', 160], ['flush', 'Polaris', 210], ['full', 'Antares', 10], ['four', 'Betelgeuse', 20],
  ['sflush', 'Capella', 50], ['royal', 'Arcturus', 30], ['five', 'Aldebaran', 0],
];

export const STARS: ConsumableDef[] = STAR_NAMES.map(([hand, name, hue]) => ({
  id: `star_${hand}`, kind: 'star' as const, name, cost: 3, hand, icon: { glyph: '✦', hue },
  desc: `Level up ${HANDS[hand].name}: +${HANDS[hand].lvlChips} Chips and +${HANDS[hand].lvlMult} Mult.`,
  use: (g: GameCtx) => g.levelHand(hand, 1),
}));
for (const s of STARS) {
  STAR_FOR[s.hand!] = s.id;
  STAR_HAND[s.id] = s.hand!;
}

export const HEXES: ConsumableDef[] = [
  { id: 'hex_phantom', kind: 'hex', name: 'Phantom Court', cost: 4, icon: { glyph: '♛', hue: 270 },
    desc: 'Destroy 1 random card in hand, then add 3 random enhanced face cards to your hand.',
    use: (g) => { destroyRandomInHand(g); for (let i = 0; i < 3; i++) g.addCard(randomEnhancedCard(g, [11, 12, 13]), true); } },
  { id: 'hex_abyss', kind: 'hex', name: 'Abyss', cost: 4, icon: { glyph: '◍', hue: 240 },
    desc: 'Destroy 1 random card in hand, then add 4 random enhanced number cards to your hand.',
    use: (g) => { destroyRandomInHand(g); for (let i = 0; i < 4; i++) g.addCard(randomEnhancedCard(g, [2, 3, 4, 5, 6, 7, 8, 9, 10]), true); } },
  { id: 'hex_ritual', kind: 'hex', name: 'Ritual of Aces', cost: 4, icon: { glyph: 'A', hue: 0 },
    desc: 'Destroy 1 random card in hand, then add 2 random enhanced Aces to your hand.',
    use: (g) => { destroyRandomInHand(g); for (let i = 0; i < 2; i++) g.addCard(randomEnhancedCard(g, [14]), true); } },
  { id: 'hex_bloodmoon', kind: 'hex', name: 'Blood Moon', cost: 4, icon: { glyph: '☾', hue: 355 },
    desc: 'Every card in hand becomes the same random suit. −1 hand size for the rest of the run.',
    canUse: (g) => g.handCards().length > 0,
    use: (g) => { const s = SUITS[Math.floor(g.rand('gen') * 4)]; for (const c of g.handCards()) c.suit = s; g.run.base.handSize -= 1; } },
  { id: 'hex_morph', kind: 'hex', name: 'Morph', cost: 4, icon: { glyph: '⟲', hue: 300 },
    desc: 'Every card in hand becomes the same random rank. −1 hand size for the rest of the run.',
    canUse: (g) => g.handCards().length > 0,
    use: (g) => { const r = 2 + Math.floor(g.rand('gen') * 13); for (const c of g.handCards()) c.rank = r; g.run.base.handSize -= 1; } },
  sealHex('hex_ruby', 'Ruby Sigil', 'ruby', '⊛', 350, 'Ruby Seal'),
  sealHex('hex_azure', 'Azure Sigil', 'azure', '⊛', 215, 'Azure Seal'),
  sealHex('hex_golden', 'Golden Sigil', 'golden', '⊛', 45, 'Golden Seal'),
  sealHex('hex_violet', 'Violet Sigil', 'violet', '⊛', 275, 'Violet Seal'),
  sealHex('hex_silver', 'Silver Sigil', 'silver', '⊛', 210, 'Silver Seal'),
  sealHex('hex_jade', 'Jade Sigil', 'jade', '⊛', 160, 'Jade Seal'),
  { id: 'hex_shroud', kind: 'hex', name: 'Gilded Shroud', cost: 4, icon: { glyph: '☁', hue: 45 },
    desc: 'Add Shimmer, Aurora or Spectrum to a random charm without an edition. Your money becomes $0.',
    canUse: (g) => g.run.charms.some((c) => !c.edition),
    use: (g) => {
      const pool = g.run.charms.filter((c) => !c.edition);
      const c = pool[Math.floor(g.rand('gen') * pool.length)];
      c.edition = (['shimmer', 'aurora', 'spectrum'] as const)[Math.floor(g.rand('gen') * 3)];
      g.run.money = Math.min(g.run.money, 0);
    } },
  { id: 'hex_rift', kind: 'hex', name: 'Rift', cost: 4, icon: { glyph: '◌', hue: 260 },
    desc: 'Add Void (+1 charm slot) to a random charm without an edition. Lose $5.',
    canUse: (g) => g.run.charms.some((c) => !c.edition),
    use: (g) => {
      const pool = g.run.charms.filter((c) => !c.edition);
      pool[Math.floor(g.rand('gen') * pool.length)].edition = 'void';
      g.addMoney(-5);
    } },
  { id: 'hex_summon', kind: 'hex', name: 'Summoning', cost: 4, icon: { glyph: '⛤', hue: 50 },
    desc: 'Create a Legendary charm (must have room).', canUse: (g) => g.hasCharmRoom(),
    use: (g) => {
      const owned = new Set(g.run.charms.map((c) => c.id));
      let pool = CHARMS.filter((c) => c.rarity === 'legendary' && !owned.has(c.id));
      if (!pool.length) pool = CHARMS.filter((c) => c.rarity === 'legendary');
      g.createCharm(pool[Math.floor(g.rand('gen') * pool.length)].id);
    } },
  { id: 'hex_mitosis', kind: 'hex', name: 'Mitosis', cost: 4, icon: { glyph: '⚭', hue: 120 },
    desc: 'Copy a random charm (without its edition), then destroy a different random charm.',
    canUse: (g) => g.run.charms.length >= 2,
    use: (g) => {
      const src = g.run.charms[Math.floor(g.rand('gen') * g.run.charms.length)];
      const others = g.run.charms.filter((c) => c.uid !== src.uid);
      const victim = others[Math.floor(g.rand('gen') * others.length)];
      g.removeCharm(victim.uid);
      const copy = g.createCharm(src.id, null, true);
      if (copy) copy.state = { ...src.state };
    } },
  { id: 'hex_blacksun', kind: 'hex', name: 'Black Sun', cost: 4, icon: { glyph: '●', hue: 30 },
    desc: 'Level up every poker hand by 1.', use: (g) => { for (const h of HAND_ORDER) g.levelHand(h, 1); } },
  { id: 'hex_eclipse', kind: 'hex', name: 'Eclipse', cost: 4, icon: { glyph: '◑', hue: 280 }, select: [1, 1],
    desc: 'Add Spectrum (×1.5 Mult) to 1 selected card.', use: (_g, sel) => { sel[0].edition = 'spectrum'; } },
  { id: 'hex_reverb', kind: 'hex', name: 'Resonance', cost: 4, icon: { glyph: '≈', hue: 180 }, select: [1, 1],
    desc: 'Add Echo (retrigger) to 1 selected card. Destroy 1 random other card in hand.',
    use: (g, sel) => { sel[0].edition = 'echo'; destroyRandomInHand(g, new Set([sel[0].id])); } },
  { id: 'hex_null', kind: 'hex', name: 'Null', cost: 4, icon: { glyph: '∅', hue: 0 }, select: [1, 1],
    desc: 'Add Void (+1 hand size) to 1 selected card. Destroy 1 random other card in hand.',
    use: (g, sel) => { sel[0].edition = 'void'; destroyRandomInHand(g, new Set([sel[0].id])); } },
  { id: 'hex_wealth', kind: 'hex', name: 'Pact of Wealth', cost: 4, icon: { glyph: '♅', hue: 45 },
    desc: 'Earn $25. −1 discard for the rest of the run.', use: (g) => { g.addMoney(25); g.run.base.discards -= 1; } },
  { id: 'hex_doppel', kind: 'hex', name: 'Doppelganger', cost: 4, icon: { glyph: '⧉', hue: 320 }, select: [1, 1],
    desc: 'Add 2 copies of the selected card to your hand. Destroy 2 random other cards in hand.',
    use: (g, sel) => {
      const keep = new Set([sel[0].id]);
      destroyRandomInHand(g, keep);
      destroyRandomInHand(g, keep);
      g.addCard(copyCard(g.run, sel[0]), true);
      g.addCard(copyCard(g.run, sel[0]), true);
    } },
];

export const CONSUMABLES: ConsumableDef[] = [...OMENS, ...STARS, ...HEXES];
export const CONSUMABLE_MAP: Record<string, ConsumableDef> = Object.fromEntries(CONSUMABLES.map((c) => [c.id, c]));
