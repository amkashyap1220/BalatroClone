// Boons: permanent run upgrades. One is offered in the shop each ante.
import type { BoonDef } from './defs';

export const BOONS: BoonDef[] = [
  { id: 'extra_shelf', name: 'Extra Shelf', desc: '+1 item slot in the shop.', icon: { glyph: '▤', hue: 30 }, mods: (m) => { m.shopSlots += 1; } },
  { id: 'warehouse', name: 'Warehouse', desc: '+1 more item slot in the shop.', icon: { glyph: '▦', hue: 30 }, requires: 'extra_shelf', mods: (m) => { m.shopSlots += 1; } },
  { id: 'clearance', name: 'Clearance Rack', desc: 'Everything in the shop is 25% off.', icon: { glyph: '%', hue: 0 }, mods: (m) => { m.shopDiscountPct = Math.max(m.shopDiscountPct, 0.25); } },
  { id: 'liquidation', name: 'Liquidation', desc: 'Everything in the shop is 50% off.', icon: { glyph: '½', hue: 0 }, requires: 'clearance', mods: (m) => { m.shopDiscountPct = Math.max(m.shopDiscountPct, 0.5); } },
  { id: 'lucky_token', name: 'Lucky Token', desc: 'Rerolls cost $2 less.', icon: { glyph: '◎', hue: 140 }, mods: (m) => { m.rerollDiscount += 2; } },
  { id: 'golden_token', name: 'Golden Token', desc: 'Rerolls cost a further $2 less.', icon: { glyph: '◉', hue: 48 }, requires: 'lucky_token', mods: (m) => { m.rerollDiscount += 2; } },
  { id: 'satchel', name: 'Satchel', desc: '+1 consumable slot.', icon: { glyph: '⊔', hue: 25 }, mods: (m) => { m.consumableSlots += 1; } },
  { id: 'second_wind', name: 'Second Wind', desc: '+1 hand every round.', icon: { glyph: '✚', hue: 200 }, mods: (m) => { m.hands += 1; } },
  { id: 'third_wind', name: 'Third Wind', desc: '+1 more hand every round.', icon: { glyph: '✜', hue: 200 }, requires: 'second_wind', mods: (m) => { m.hands += 1; } },
  { id: 'compactor', name: 'Trash Compactor', desc: '+1 discard every round.', icon: { glyph: '⊠', hue: 100 }, mods: (m) => { m.discards += 1; } },
  { id: 'savings', name: 'Savings Account', desc: 'Interest cap +$5.', icon: { glyph: '$', hue: 120 }, mods: (m) => { m.interestCap += 5; } },
  { id: 'trust_fund', name: 'Trust Fund', desc: 'Interest cap +$5 more.', icon: { glyph: '$$', hue: 120 }, requires: 'savings', mods: (m) => { m.interestCap += 5; } },
  { id: 'wide_grip', name: 'Wide Grip', desc: '+1 hand size.', icon: { glyph: '✋', hue: 280 }, mods: (m) => { m.handSize += 1; } },
  { id: 'display_case', name: 'Display Case', desc: '+1 Charm slot.', icon: { glyph: '◫', hue: 300 }, mods: (m) => { m.charmSlots += 1; } },
  { id: 'polish', name: 'Polish', desc: 'Charms in the shop are twice as likely to have an edition.', icon: { glyph: '✧', hue: 190 }, mods: (m) => { m.editionRate *= 2; } },
  { id: 'star_atlas', name: 'Star Atlas', desc: 'Stars appear twice as often in the shop.', icon: { glyph: '✦', hue: 230 }, mods: (m) => { m.starRate *= 2; } },
  { id: 'omen_stall', name: 'Omen Stall', desc: 'Omens appear twice as often in the shop.', icon: { glyph: '☉', hue: 280 }, mods: (m) => { m.omenRate *= 2; } },
  { id: 'card_table', name: 'Card Table', desc: 'Playing cards (often enhanced) can appear in the shop.', icon: { glyph: '▭', hue: 10 }, mods: (m) => { m.cardRate += 4; m.rules.add('enhancedShopCards'); } },
  { id: 'telescope', name: 'Telescope', desc: 'Star packs always include the Star for your most played hand.', icon: { glyph: '⌕', hue: 220 }, mods: (m) => { m.rules.add('telescope'); } },
  { id: 'bounty', name: 'Bounty Hunter', desc: 'Boss blinds pay $3 more.', icon: { glyph: '☠', hue: 15 }, mods: (m) => { m.rules.add('bossBounty'); } },
  { id: 'recruiter', name: 'Recruiter', desc: 'Uncommon and Rare charms appear 50% more often.', icon: { glyph: '⚑', hue: 50 }, mods: (m) => { m.rarityBoost *= 1.5; } },
];

export const BOON_MAP: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]));
