// Definition interfaces for data-driven content. Content modules export arrays of these.
import type {
  Card, CharmInstance, ConsumableKind, Effect, HandType, Mods, Rarity, RunState, EditionId,
} from '../types';
import type { GameCtx, ScoreCtx } from '../core';

export interface Icon {
  glyph: string;
  hue: number;
  hue2?: number;
}

export interface CharmDef {
  id: string;
  name: string;
  rarity: Rarity;
  cost: number;
  desc: string;
  /** Optional live readout of the charm's current value, e.g. "Currently +12 Mult". */
  status?: (self: CharmInstance, run: RunState) => string;
  icon: Icon;
  tags: string[];
  /** Achievement id that unlocks this charm. Absent = unlocked from the start. */
  unlock?: string;
  init?: Record<string, number>;
  /** Cannot be copied by Mimic-style charms. */
  noCopy?: boolean;
  /** Copies the charm to the right/left. */
  copies?: 'right' | 'left';
  rules?: string[];
  mods?: (m: Mods, run: RunState, self: CharmInstance) => void;
  before?: (ctx: ScoreCtx, self: CharmInstance) => void;
  onScored?: (ctx: ScoreCtx, self: CharmInstance, card: Card) => Effect | void;
  onHeld?: (ctx: ScoreCtx, self: CharmInstance, card: Card) => Effect | void;
  retrigScored?: (ctx: ScoreCtx, self: CharmInstance, card: Card) => number;
  retrigHeld?: (ctx: ScoreCtx, self: CharmInstance, card: Card) => number;
  main?: (ctx: ScoreCtx, self: CharmInstance) => Effect | void;
  after?: (ctx: ScoreCtx, self: CharmInstance) => void;
  onDiscard?: (g: GameCtx, self: CharmInstance, cards: Card[]) => void;
  onRoundStart?: (g: GameCtx, self: CharmInstance) => void;
  /** Money paid out at cash-out. Pure: may be copied. */
  payout?: (g: GameCtx, self: CharmInstance) => number;
  /** State changes at end of round (scaling, self destruction). */
  onRoundEnd?: (g: GameCtx, self: CharmInstance) => void;
  onBossDefeated?: (g: GameCtx, self: CharmInstance) => void;
  onShopEnter?: (g: GameCtx, self: CharmInstance) => void;
  onShopExit?: (g: GameCtx, self: CharmInstance) => void;
  onReroll?: (g: GameCtx, self: CharmInstance) => void;
  onAcquire?: (g: GameCtx, self: CharmInstance) => void;
  onSell?: (g: GameCtx, self: CharmInstance) => void;
  onOtherSold?: (g: GameCtx, self: CharmInstance, sold: CharmInstance) => void;
  onCardsDestroyed?: (g: GameCtx, self: CharmInstance, cards: Card[]) => void;
  onConsumableUsed?: (g: GameCtx, self: CharmInstance, kind: ConsumableKind, id: string) => void;
  onSkipBlind?: (g: GameCtx, self: CharmInstance) => void;
  onPackSkipped?: (g: GameCtx, self: CharmInstance) => void;
  onBuy?: (g: GameCtx, self: CharmInstance) => void;
}

export interface ConsumableDef {
  id: string;
  kind: ConsumableKind;
  name: string;
  desc: string;
  icon: Icon;
  cost: number;
  /** Number of hand cards that must be selected. */
  select?: [number, number];
  /** Star: hand type upgraded. */
  hand?: HandType;
  unlock?: string;
  canUse?: (g: GameCtx, selected: Card[]) => boolean;
  use: (g: GameCtx, selected: Card[]) => void;
}

export interface BossDef {
  id: string;
  name: string;
  desc: string;
  counter: string;
  icon: Icon;
  minAnte: number;
  /** Multiplier applied to the ante's base score (small blind = 1). */
  scoreMult: number;
  finale?: boolean;
  difficulty: 1 | 2 | 3;
  debuff?: (card: Card, run: RunState) => boolean;
  mods?: (m: Mods, run: RunState) => void;
  onStart?: (g: GameCtx) => void;
  /** Return a reason string to forbid playing these cards. */
  canPlay?: (run: RunState, cards: Card[], hand: HandType) => string | null;
  /** Modify the base chips/mult of the hand. */
  base?: (ctx: ScoreCtx) => void;
  /** Called before scoring, may change state (e.g. lower hand level). */
  beforeScore?: (ctx: ScoreCtx) => void;
  afterHand?: (g: GameCtx, played: Card[]) => void;
  onDiscard?: (g: GameCtx, cards: Card[]) => void;
  /** Should this freshly drawn card be face down? */
  faceDown?: (g: GameCtx, card: Card, index: number) => boolean;
  /** Pick a charm to disable before each hand. */
  disableCharm?: boolean;
  noReward?: boolean;
}

export interface DeckDef {
  id: string;
  name: string;
  desc: string;
  strategy: string;
  colors: [string, string];
  pattern: string;
  unlock?: string;
  build?: (g: GameCtx) => Card[];
  setup?: (g: GameCtx) => void;
  mods?: (m: Mods, run: RunState) => void;
}

export interface ChallengeDef {
  id: string;
  name: string;
  desc: string;
  rules: string[];
  deck: string;
  unlock?: string;
  charms?: { id: string; edition?: EditionId }[];
  consumables?: string[];
  money?: number;
  build?: (g: GameCtx) => Card[];
  setup?: (g: GameCtx) => void;
  mods?: (m: Mods, run: RunState) => void;
  bossOrder?: string[];
  debuff?: (card: Card, run: RunState) => boolean;
  /** Shop cannot sell these kinds. */
  banShop?: ('charm' | 'consumable' | 'pack' | 'boon')[];
  winAnte?: number;
}

export interface BoonDef {
  id: string;
  name: string;
  desc: string;
  icon: Icon;
  requires?: string;
  mods?: (m: Mods, run: RunState) => void;
  onBuy?: (g: GameCtx) => void;
}

export interface TokenDef {
  id: string;
  name: string;
  desc: string;
  icon: Icon;
  minAnte?: number;
  /** Applied right away on skip. */
  instant?: (g: GameCtx) => void;
  /** Kept in run.tokens and consumed later by the matching system. */
  trigger?: 'shop' | 'round' | 'boss';
}

export interface PackDef {
  id: string;
  name: string;
  desc: string;
  cost: number;
  size: number;
  picks: number;
  kind: 'card' | 'omen' | 'star' | 'hex' | 'charm' | 'enhanced' | 'discovery';
  weight: number;
  colors: [string, string];
  needsHand: boolean;
}

export interface HeatDef {
  level: number;
  name: string;
  desc: string;
  mods?: (m: Mods, run: RunState) => void;
}
