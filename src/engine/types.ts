// Core type definitions for the Royal Flux engine.
// The engine is pure TypeScript with no DOM dependencies so it can be unit tested in Node.

export type Suit = 'S' | 'H' | 'D' | 'C';
export const SUITS: Suit[] = ['S', 'H', 'D', 'C'];
export const RANKS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

export type EnhancementId =
  | 'plated' | 'ember' | 'crystal' | 'iron' | 'treasure' | 'fortune' | 'prism' | 'monolith' | 'volt' | 'magnet';
export type EditionId = 'shimmer' | 'aurora' | 'spectrum' | 'void' | 'gilt' | 'echo';
export type SealId = 'ruby' | 'azure' | 'golden' | 'violet' | 'silver' | 'jade';

export interface Card {
  id: string;
  rank: number; // 2..14 (11=J, 12=Q, 13=K, 14=A)
  suit: Suit;
  enhancement: EnhancementId | null;
  edition: EditionId | null;
  seal: SealId | null;
  /** Permanent bonus chips accumulated on this card (e.g. from Trailblazer). */
  bonusChips: number;
  /** Permanent bonus mult accumulated on this card (Volt enhancement, Static Coil). */
  bonusMult: number;
}

export type HandType =
  | 'high' | 'pair' | 'twopair' | 'three' | 'straight' | 'flush' | 'full' | 'four' | 'sflush' | 'royal' | 'five';

export const HAND_ORDER: HandType[] = [
  'high', 'pair', 'twopair', 'three', 'straight', 'flush', 'full', 'four', 'sflush', 'royal', 'five',
];

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface CharmInstance {
  uid: string;
  id: string;
  edition: EditionId | null;
  state: Record<string, number>;
  /** Extra sell value gained over time. */
  sellBonus: number;
}

export type ConsumableKind = 'omen' | 'star' | 'hex';

export interface ConsumableInstance {
  uid: string;
  id: string;
  kind: ConsumableKind;
  /** Void edition consumables don't take a slot. */
  edition: EditionId | null;
}

export type BlindType = 'small' | 'big' | 'boss';

export interface RoundState {
  blindType: BlindType;
  bossId: string | null;
  bossDisabled: boolean;
  target: number;
  score: number;
  handsLeft: number;
  discardsLeft: number;
  handsPlayed: number;
  discardsUsed: number;
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  /** Card ids that are dealt face down (boss effect). */
  faceDown: string[];
  handTypesPlayed: HandType[];
  /** Charm uid temporarily disabled by a boss. */
  disabledCharm: string | null;
  /** Temporary hand size change for this round (tokens). */
  handSizeBonus: number;
  lastHandScore: number;
  /** Hand type locked in by boss (Monotone). */
  lockedHand: HandType | null;
}

export type ShopItemKind = 'charm' | 'consumable' | 'card' | 'pack' | 'boon';

export interface ShopItem {
  kind: ShopItemKind;
  /** Content id: charm id, consumable id, pack id or boon id. */
  id: string;
  price: number;
  sold: boolean;
  free?: boolean;
  edition?: EditionId | null;
  card?: Card;
  consumableKind?: ConsumableKind;
}

export interface ShopState {
  items: ShopItem[];
  packs: ShopItem[];
  boon: ShopItem | null;
  rerollCost: number;
  rerolls: number;
  freeRerolls: number;
  cardSoldThisShop: boolean;
}

export type PackChoice =
  | { kind: 'card'; card: Card }
  | { kind: 'charm'; id: string; edition: EditionId | null }
  | { kind: 'consumable'; id: string; consumableKind: ConsumableKind };

export interface PackState {
  packId: string;
  choices: PackChoice[];
  picksLeft: number;
  taken: number[];
  /** Cards dealt from the deck so pack Omens/Hexes have targets. */
  hand: string[];
  /** Where to return when done. */
  returnTo: 'shop' | 'blindSelect';
}

export type Phase = 'blindSelect' | 'playing' | 'cashout' | 'shop' | 'pack' | 'gameOver' | 'victory';

export interface CashoutLine {
  label: string;
  amount: number;
}

export interface RunStats {
  handsPlayed: number;
  discards: number;
  cardsPlayed: number;
  bestHand: number;
  bestHandType: HandType | null;
  moneyEarned: number;
  rerolls: number;
  charmsBought: number;
  consumablesUsed: number;
  starsUsed: number;
  omensUsed: number;
  hexesUsed: number;
  cardsDestroyed: number;
  bossesDefeated: number;
  blindsSkipped: number;
  handCounts: Partial<Record<HandType, number>>;
}

export interface RunState {
  version: number;
  seed: string;
  rng: Record<string, number>;
  uid: number;
  deckId: string;
  challengeId: string | null;
  heat: number;
  ante: number;
  blindIndex: 0 | 1 | 2;
  phase: Phase;
  money: number;
  deck: Card[];
  round: RoundState | null;
  charms: CharmInstance[];
  consumables: ConsumableInstance[];
  handLevels: Record<HandType, number>;
  boons: string[];
  tokens: string[];
  /** Token offered for skipping the small and big blind of this ante. */
  skipTokens: [string, string];
  shop: ShopState | null;
  pack: PackState | null;
  packQueue: string[];
  bossId: string;
  usedBosses: string[];
  stats: RunStats;
  lastConsumable: string | null;
  cashout: CashoutLine[] | null;
  won: boolean;
  endless: boolean;
  /** Base resource counts before modifiers. */
  base: { handSize: number; hands: number; discards: number; charmSlots: number; consumableSlots: number };
  /** Ids of hand types played at least once this run. */
  handTypesSeen: HandType[];
  log: string[];
  /** Score that ended the run on defeat. */
  defeatScore: number;
  /** Boon currently offered this ante. */
  boonOffer: string | null;
  boonAnte: number;
  /** One-shot flags (tokens, effects). */
  flags: Record<string, number>;
}

export interface Mods {
  handSize: number;
  hands: number;
  discards: number;
  charmSlots: number;
  consumableSlots: number;
  interestCap: number;
  interestPer: number;
  shopDiscount: number; // flat $ off
  shopDiscountPct: number; // 0..1
  rerollDiscount: number;
  shopSlots: number;
  packSlots: number;
  debtLimit: number;
  sellBonus: number;
  rules: Set<string>;
  editionRate: number; // multiplier on edition chances
  rarityBoost: number; // multiplier on uncommon/rare odds
  omenRate: number;
  starRate: number;
  cardRate: number;
  handReward: number; // $ per remaining hand
  blindRewardBonus: number;
  targetMult: number;
}

export interface Effect {
  chips?: number;
  mult?: number;
  xmult?: number;
  money?: number;
  msg?: string;
}

export type StepKind = 'base' | 'card' | 'held' | 'charm' | 'info' | 'final';

export interface ScoreStep {
  kind: StepKind;
  /** Card id or charm uid that produced the step. */
  source: string | null;
  chips?: number;
  mult?: number;
  xmult?: number;
  money?: number;
  text: string;
  chipsAfter: number;
  multAfter: number;
}

export interface ScoreResult {
  hand: HandType;
  scoringIds: string[];
  chips: number;
  mult: number;
  total: number;
  steps: ScoreStep[];
  destroyed: string[];
}
