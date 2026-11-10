// Playing card enhancements, editions and seals.
import type { EnhancementId, EditionId, SealId } from '../types';

export interface EnhancementDef {
  id: EnhancementId;
  name: string;
  desc: string;
  color: string;
}

export const ENHANCEMENTS: Record<EnhancementId, EnhancementDef> = {
  plated: { id: 'plated', name: 'Plated', desc: '+30 Chips when scored.', color: '#4aa3ff' },
  ember: { id: 'ember', name: 'Ember', desc: '+4 Mult when scored.', color: '#ff5a4a' },
  crystal: { id: 'crystal', name: 'Crystal', desc: '×2 Mult when scored. 1 in 4 chance to shatter afterwards.', color: '#b9f3ff' },
  iron: { id: 'iron', name: 'Iron', desc: '×1.5 Mult while held in hand.', color: '#9aa3ad' },
  treasure: { id: 'treasure', name: 'Treasure', desc: 'Earn $3 if held in hand at end of round.', color: '#ffc93c' },
  fortune: { id: 'fortune', name: 'Fortune', desc: '1 in 5 chance for +20 Mult. 1 in 15 chance to earn $20.', color: '#4cd28a' },
  prism: { id: 'prism', name: 'Prism', desc: 'Counts as every suit.', color: '#d68bff' },
  monolith: { id: 'monolith', name: 'Monolith', desc: '+50 Chips. Has no rank or suit and always scores.', color: '#7b6f63' },
  volt: { id: 'volt', name: 'Volt', desc: '+2 Mult when scored, then permanently gains +1 Mult.', color: '#ffe14a' },
  magnet: { id: 'magnet', name: 'Magnet', desc: '+4 Mult while held in hand.', color: '#ff7ad1' },
};

export interface EditionDef {
  id: EditionId;
  name: string;
  cardDesc: string;
  charmDesc: string;
  /** Can be applied to charms. */
  forCharms: boolean;
  /** Extra shop cost. */
  cost: number;
}

export const EDITIONS: Record<EditionId, EditionDef> = {
  shimmer: { id: 'shimmer', name: 'Shimmer', cardDesc: '+50 Chips when scored.', charmDesc: '+50 Chips.', forCharms: true, cost: 2 },
  aurora: { id: 'aurora', name: 'Aurora', cardDesc: '+10 Mult when scored.', charmDesc: '+10 Mult.', forCharms: true, cost: 3 },
  spectrum: { id: 'spectrum', name: 'Spectrum', cardDesc: '×1.5 Mult when scored.', charmDesc: '×1.5 Mult.', forCharms: true, cost: 5 },
  void: { id: 'void', name: 'Void', cardDesc: '+1 hand size while in your deck.', charmDesc: '+1 Charm slot.', forCharms: true, cost: 5 },
  gilt: { id: 'gilt', name: 'Gilt', cardDesc: 'Earn $2 when scored.', charmDesc: 'Earn $2 at end of round.', forCharms: true, cost: 2 },
  echo: { id: 'echo', name: 'Echo', cardDesc: 'Retrigger this card once.', charmDesc: '', forCharms: false, cost: 4 },
};

export interface SealDef {
  id: SealId;
  name: string;
  desc: string;
  color: string;
}

export const SEALS: Record<SealId, SealDef> = {
  ruby: { id: 'ruby', name: 'Ruby Seal', desc: 'Retrigger this card once.', color: '#e0244a' },
  azure: { id: 'azure', name: 'Azure Seal', desc: 'If held in hand at end of round, create the Star for your last played hand.', color: '#2d7dff' },
  golden: { id: 'golden', name: 'Golden Seal', desc: 'Earn $3 when this card is scored.', color: '#f2b705' },
  violet: { id: 'violet', name: 'Violet Seal', desc: 'Create an Omen when this card is discarded.', color: '#9b4dff' },
  silver: { id: 'silver', name: 'Silver Seal', desc: '+3 Mult while held in hand; its held abilities trigger twice.', color: '#d9dee5' },
  jade: { id: 'jade', name: 'Jade Seal', desc: 'When scored, this card permanently gains +6 Chips.', color: '#1fbf8f' },
};

export const ENHANCEMENT_IDS = Object.keys(ENHANCEMENTS) as EnhancementId[];
export const CARD_EDITION_IDS: EditionId[] = ['shimmer', 'aurora', 'spectrum', 'void', 'gilt', 'echo'];
export const CHARM_EDITION_IDS: EditionId[] = ['shimmer', 'aurora', 'spectrum', 'void', 'gilt'];
export const SEAL_IDS = Object.keys(SEALS) as SealId[];
