// Shared engine services: modifier aggregation, debuffs, and the GameCtx used by every effect.
import type {
  Card, CharmInstance, ConsumableInstance, ConsumableKind, EditionId, HandType, Mods, Rarity, RunState,
} from './types';
import { HAND_ORDER } from './types';
import { rand, pick, weightedPick } from './rng';
import { newId } from './cards';
import { CHARM_MAP, CHARMS } from './content/charms';
import { CONSUMABLE_MAP, OMENS, STARS, HEXES } from './content/consumables';
import { BOSS_MAP } from './content/bosses';
import { DECK_MAP } from './content/decks';
import { CHALLENGE_MAP } from './content/challenges';
import { BOON_MAP } from './content/boons';
import { HEATS } from './content/heat';
import type { CharmDef } from './content/defs';

export function baseMods(run: RunState): Mods {
  return {
    handSize: run.base.handSize,
    hands: run.base.hands,
    discards: run.base.discards,
    charmSlots: run.base.charmSlots,
    consumableSlots: run.base.consumableSlots,
    interestCap: 5,
    interestPer: 5,
    shopDiscount: 0,
    shopDiscountPct: 0,
    rerollDiscount: 0,
    shopSlots: 2,
    packSlots: 2,
    debtLimit: 0,
    sellBonus: 0,
    rules: new Set(),
    editionRate: 1,
    rarityBoost: 1,
    omenRate: 1,
    starRate: 1,
    cardRate: 0,
    handReward: 1,
    blindRewardBonus: 0,
    targetMult: 1,
  };
}

export function bossActive(run: RunState): boolean {
  return !!(run.round && run.round.bossId && !run.round.bossDisabled);
}

export function getMods(run: RunState): Mods {
  const m = baseMods(run);
  DECK_MAP[run.deckId]?.mods?.(m, run);
  if (run.challengeId) CHALLENGE_MAP[run.challengeId]?.mods?.(m, run);
  for (const h of HEATS) if (h.level <= run.heat) h.mods?.(m, run);
  for (const b of run.boons) BOON_MAP[b]?.mods?.(m, run);
  for (const c of run.charms) {
    const def = CHARM_MAP[c.id];
    if (!def) continue;
    if (c.edition === 'void') m.charmSlots += 1;
    if (run.round?.disabledCharm === c.uid) continue;
    def.rules?.forEach((r) => m.rules.add(r));
    def.mods?.(m, run, c);
  }
  for (const card of run.deck) if (card.edition === 'void') m.handSize += 1;
  if (run.round) {
    m.handSize += run.round.handSizeBonus;
    if (bossActive(run)) BOSS_MAP[run.round.bossId!]?.mods?.(m, run);
  }
  m.handSize = Math.max(1, m.handSize);
  m.hands = Math.max(1, m.hands);
  m.discards = Math.max(0, m.discards);
  return m;
}

export function isDebuffed(run: RunState, card: Card, mods?: Mods): boolean {
  const m = mods ?? getMods(run);
  if (m.rules.has('noDebuff')) return false;
  if (run.challengeId) {
    const ch = CHALLENGE_MAP[run.challengeId];
    if (ch?.debuff?.(card, run)) return true;
  }
  if (bossActive(run)) {
    const b = BOSS_MAP[run.round!.bossId!];
    if (b?.debuff?.(card, run)) return true;
  }
  return false;
}

export function findCard(run: RunState, id: string): Card | undefined {
  return run.deck.find((c) => c.id === id);
}

export function charmDef(c: CharmInstance): CharmDef {
  return CHARM_MAP[c.id];
}

export function consumableCount(run: RunState): number {
  return run.consumables.filter((c) => c.edition !== 'void').length;
}

export function charmSellValue(run: RunState, c: CharmInstance, mods?: Mods): number {
  const def = CHARM_MAP[c.id];
  const m = mods ?? getMods(run);
  return Math.max(1, Math.floor((def?.cost ?? 2) / 2) + c.sellBonus + m.sellBonus);
}

export function consumableSellValue(run: RunState, c: ConsumableInstance, mods?: Mods): number {
  const def = CONSUMABLE_MAP[c.id];
  const m = mods ?? getMods(run);
  return Math.max(1, Math.floor((def?.cost ?? 3) / 2) + m.sellBonus);
}

/** GameCtx bundles the run with helper operations shared by every effect definition. */
export class GameCtx {
  run: RunState;
  mods: Mods;
  destroyedThisAction: Card[] = [];
  constructor(run: RunState) {
    this.run = run;
    this.mods = getMods(run);
  }
  refreshMods() {
    this.mods = getMods(this.run);
  }
  rand(stream = 'misc'): number {
    return rand(this.run, stream);
  }
  /** n in d chance, doubled by probability-doubling rules. */
  chance(n: number, d: number, stream = 'luck'): boolean {
    let num = n;
    if (this.mods.rules.has('loadedDice')) num *= 2;
    return rand(this.run, stream) < num / d;
  }
  log(msg: string) {
    this.run.log.push(msg);
    if (this.run.log.length > 60) this.run.log.splice(0, this.run.log.length - 60);
  }
  addMoney(n: number) {
    if (!n) return;
    this.run.money += n;
    if (n > 0) this.run.stats.moneyEarned += n;
  }
  charmDef(c: CharmInstance): CharmDef {
    return CHARM_MAP[c.id];
  }
  activeCharms(): CharmInstance[] {
    return this.run.charms.filter((c) => this.run.round?.disabledCharm !== c.uid && CHARM_MAP[c.id]);
  }
  isDebuffed(card: Card): boolean {
    return isDebuffed(this.run, card, this.mods);
  }
  hasConsumableRoom(): boolean {
    return consumableCount(this.run) < this.mods.consumableSlots;
  }
  hasCharmRoom(): boolean {
    return this.run.charms.length < this.mods.charmSlots;
  }
  randomConsumableId(kind: ConsumableKind, stream = 'consumable'): string {
    let pool = kind === 'omen' ? OMENS : kind === 'star' ? STARS : HEXES;
    // Five of a Kind's Star only appears once that hand has been played.
    if (kind === 'star' && !(this.run.stats.handCounts.five ?? 0)) pool = pool.filter((d) => d.hand !== 'five');
    return pick(this.run, stream, pool).id;
  }
  createConsumable(kind: ConsumableKind, id?: string, edition: EditionId | null = null): boolean {
    if (edition !== 'void' && !this.hasConsumableRoom()) return false;
    const cid = id ?? this.randomConsumableId(kind);
    const def = CONSUMABLE_MAP[cid];
    if (!def) return false;
    this.run.consumables.push({ uid: newId(this.run, 'k'), id: cid, kind: def.kind, edition });
    return true;
  }
  randomCharmId(rarity: Rarity, stream = 'charm', exclude: Set<string> = new Set()): string {
    const owned = new Set(this.run.charms.map((c) => c.id));
    let pool = CHARMS.filter((d) => d.rarity === rarity && !owned.has(d.id) && !exclude.has(d.id) && charmAllowed(this.run, d));
    if (!pool.length) pool = CHARMS.filter((d) => d.rarity === rarity);
    return pick(this.run, stream, pool).id;
  }
  rollRarity(stream = 'charm'): Rarity {
    const b = this.mods.rarityBoost;
    return weightedPick(this.run, stream, ['common', 'uncommon', 'rare'] as Rarity[], (r) =>
      r === 'common' ? 70 : r === 'uncommon' ? 25 * b : 5 * b,
    );
  }
  newCharm(id: string, edition: EditionId | null = null): CharmInstance {
    const def = CHARM_MAP[id];
    return { uid: newId(this.run, 'j'), id, edition, state: { ...(def?.init ?? {}) }, sellBonus: 0 };
  }
  /** Adds a charm if there is room (or it's Void). Fires its acquire hook. */
  createCharm(id: string, edition: EditionId | null = null, force = false): CharmInstance | null {
    if (!force && edition !== 'void' && !this.hasCharmRoom()) return null;
    const inst = this.newCharm(id, edition);
    this.run.charms.push(inst);
    CHARM_MAP[id]?.onAcquire?.(this, inst);
    this.refreshMods();
    return inst;
  }
  removeCharm(uid: string) {
    this.run.charms = this.run.charms.filter((c) => c.uid !== uid);
    this.refreshMods();
  }
  addCard(card: Card, toHand = false) {
    this.run.deck.push(card);
    const r = this.run.round;
    if (r && (this.run.phase === 'playing' || this.run.phase === 'pack')) {
      if (toHand) r.hand.push(card.id);
      else {
        const pos = Math.floor(this.rand('deck') * (r.drawPile.length + 1));
        r.drawPile.splice(pos, 0, card.id);
      }
    } else if (toHand && this.run.pack) {
      this.run.pack.hand.push(card.id);
    }
    for (const c of this.activeCharms()) {
      // placeholder hook point for "card added" charms handled via flags
      void c;
    }
  }
  destroyCards(ids: string[]) {
    if (!ids.length) return;
    const set = new Set(ids);
    const cards = this.run.deck.filter((c) => set.has(c.id));
    if (!cards.length) return;
    this.run.deck = this.run.deck.filter((c) => !set.has(c.id));
    const r = this.run.round;
    if (r) {
      r.hand = r.hand.filter((id) => !set.has(id));
      r.drawPile = r.drawPile.filter((id) => !set.has(id));
      r.discardPile = r.discardPile.filter((id) => !set.has(id));
    }
    if (this.run.pack) this.run.pack.hand = this.run.pack.hand.filter((id) => !set.has(id));
    this.run.stats.cardsDestroyed += cards.length;
    this.destroyedThisAction.push(...cards);
    for (const c of this.activeCharms()) CHARM_MAP[c.id].onCardsDestroyed?.(this, c, cards);
  }
  levelHand(hand: HandType, n = 1) {
    this.run.handLevels[hand] = Math.max(1, (this.run.handLevels[hand] ?? 1) + n);
  }
  mostPlayedHand(): HandType {
    let best: HandType = 'high';
    let bestN = -1;
    for (const h of HAND_ORDER) {
      const n = this.run.stats.handCounts[h] ?? 0;
      if (n > bestN) {
        best = h;
        bestN = n;
      }
    }
    return best;
  }
  handCards(): Card[] {
    const ids = this.run.round?.hand ?? this.run.pack?.hand ?? [];
    return ids.map((id) => findCard(this.run, id)).filter((c): c is Card => !!c);
  }
}

/** Charms locked behind achievements are excluded from random generation until unlocked. */
let unlockedCharms: Set<string> | null = null;
export function setUnlockedCharms(ids: Set<string> | null) {
  unlockedCharms = ids;
}
export function charmAllowed(run: RunState, d: CharmDef): boolean {
  if (d.rarity === 'legendary') return false;
  if (!d.unlock) return true;
  return unlockedCharms ? unlockedCharms.has(d.id) : true;
}

export interface ScoreCtx extends GameCtx {
  hand: HandType;
  played: Card[];
  scoring: Card[];
  held: Card[];
  contains: Set<HandType>;
  chips: number;
  mult: number;
  firstHand: boolean;
  lastHand: boolean;
  /** Score accumulated in the round before this hand. */
  scoreBefore: number;
  target: number;
  toDestroy: Set<string>;
  /** Index of the scoring card currently being evaluated. */
  cardIndex: number;
  isFace: (c: Card) => boolean;
  suitIs: (c: Card, s: Card['suit']) => boolean;
}
