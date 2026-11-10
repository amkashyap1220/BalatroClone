// Run state machine. Every action clones the incoming state and returns a new one (or an error),
// so the UI can treat RunState as immutable and the engine stays deterministic for a given seed.
import type {
  BlindType, Card, CashoutLine, HandType, PackChoice, RunState, ScoreResult, ShopItem, ConsumableKind, EditionId,
} from './types';
import { HAND_ORDER, SUITS } from './types';
import { GameCtx, bossActive, charmSellValue, consumableSellValue, findCard, getMods, charmAllowed } from './core';
import { rand, pick, shuffle, weightedPick, randomSeed } from './rng';
import { makeCard, standardDeck, hasRank } from './cards';
import { scoreHand, previewHand, resolveCharm } from './scoring';
import { CHARM_MAP, CHARMS, STAR_FOR } from './content/charms';
import { CONSUMABLE_MAP, OMENS, STARS, HEXES } from './content/consumables';
import { BOSSES, BOSS_MAP } from './content/bosses';
import { DECK_MAP } from './content/decks';
import { CHALLENGE_MAP } from './content/challenges';
import { BOONS, BOON_MAP } from './content/boons';
import { PACKS, PACK_MAP, TOKENS, TOKEN_MAP } from './content/misc';
import { EDITIONS, ENHANCEMENT_IDS, SEAL_IDS } from './content/modifications';

export const SAVE_VERSION = 3;
export const WIN_ANTE = 8;
export const MAX_SELECT = 5;

export type ActionResult = { run: RunState; error?: string; score?: ScoreResult };

const clone = (r: RunState): RunState => structuredClone(r);
const fail = (run: RunState, error: string): ActionResult => ({ run, error });

// ───────────────────────────── Score targets ─────────────────────────────
const ANTE_BASE = [100, 300, 800, 2000, 4500, 10000, 20000, 35000, 55000];

export function anteBase(ante: number): number {
  if (ante < 1) return ANTE_BASE[0];
  if (ante <= 8) return ANTE_BASE[ante];
  const k = ante - 8;
  return Math.floor(55000 * Math.pow(2.6, k) * Math.pow(1.12, k * k));
}

function niceRound(n: number): number {
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 100000) return Math.round(n / 100) * 100;
  const mag = Math.pow(10, Math.floor(Math.log10(n)) - 2);
  return Math.round(n / mag) * mag;
}

export function blindTarget(run: RunState, blind: BlindType, bossId?: string): number {
  const m = getMods(run);
  const mult = blind === 'small' ? 1 : blind === 'big' ? 1.5 : BOSS_MAP[bossId ?? run.bossId]?.scoreMult ?? 2;
  return niceRound(anteBase(run.ante) * mult * m.targetMult);
}

export function blindReward(run: RunState, blind: BlindType): number {
  const m = getMods(run);
  if (blind === 'small') return m.rules.has('noSmallReward') ? 0 : 3;
  if (blind === 'big') return 4;
  return 5 + (m.rules.has('bossBounty') ? 3 : 0);
}

export const BLIND_NAMES: Record<BlindType, string> = { small: 'Small Blind', big: 'Big Blind', boss: 'Boss Blind' };
export const blindTypeOf = (i: number): BlindType => (i === 0 ? 'small' : i === 1 ? 'big' : 'boss');

// ───────────────────────────── Run creation ─────────────────────────────
export interface NewRunOptions {
  deckId?: string;
  seed?: string;
  challengeId?: string | null;
  heat?: number;
}

export function emptyStats(): RunState['stats'] {
  return {
    handsPlayed: 0, discards: 0, cardsPlayed: 0, bestHand: 0, bestHandType: null, moneyEarned: 0, rerolls: 0,
    charmsBought: 0, consumablesUsed: 0, starsUsed: 0, omensUsed: 0, hexesUsed: 0, cardsDestroyed: 0,
    bossesDefeated: 0, blindsSkipped: 0, handCounts: {},
  };
}

export function createRun(opts: NewRunOptions = {}): RunState {
  const challenge = opts.challengeId ? CHALLENGE_MAP[opts.challengeId] : null;
  const deckId = challenge?.deck ?? opts.deckId ?? 'ivory';
  const run: RunState = {
    version: SAVE_VERSION,
    seed: (opts.seed || randomSeed()).toUpperCase(),
    rng: {},
    uid: 0,
    deckId,
    challengeId: challenge?.id ?? null,
    heat: challenge ? 0 : Math.max(0, Math.min(5, opts.heat ?? 0)),
    ante: 1,
    blindIndex: 0,
    phase: 'blindSelect',
    money: 4,
    deck: [],
    round: null,
    charms: [],
    consumables: [],
    handLevels: Object.fromEntries(HAND_ORDER.map((h) => [h, 1])) as Record<HandType, number>,
    boons: [],
    tokens: [],
    skipTokens: ['tok_cash', 'tok_cash'],
    shop: null,
    pack: null,
    packQueue: [],
    bossId: 'crimson_veil',
    usedBosses: [],
    stats: emptyStats(),
    lastConsumable: null,
    cashout: null,
    won: false,
    endless: false,
    base: { handSize: 8, hands: 4, discards: 3, charmSlots: 5, consumableSlots: 2 },
    handTypesSeen: [],
    log: [],
    defeatScore: 0,
    boonOffer: null,
    boonAnte: 0,
    flags: {},
  };
  const g = new GameCtx(run);
  const deck = DECK_MAP[deckId];
  run.deck = challenge?.build?.(g) ?? deck?.build?.(g) ?? standardDeck(run);
  deck?.setup?.(g);
  if (challenge) {
    if (challenge.money !== undefined) run.money = challenge.money;
    challenge.setup?.(g);
    for (const c of challenge.charms ?? []) g.createCharm(c.id, c.edition ?? null, true);
    for (const id of challenge.consumables ?? []) {
      const def = CONSUMABLE_MAP[id];
      if (def) run.consumables.push({ uid: `k${++run.uid}`, id, kind: def.kind, edition: null });
    }
  }
  run.bossId = chooseBoss(run);
  run.skipTokens = rollSkipTokens(run);
  return run;
}

export function chooseBoss(run: RunState): string {
  const ch = run.challengeId ? CHALLENGE_MAP[run.challengeId] : null;
  if (ch?.bossOrder?.length) return ch.bossOrder[(run.ante - 1) % ch.bossOrder.length];
  const finale = run.ante % 8 === 0;
  let pool = BOSSES.filter((b) => (finale ? b.finale : !b.finale && b.minAnte <= run.ante));
  let fresh = pool.filter((b) => !run.usedBosses.includes(b.id));
  if (!fresh.length) {
    run.usedBosses = run.usedBosses.filter((id) => !pool.some((b) => b.id === id));
    fresh = pool;
  }
  pool = fresh;
  const b = pick(run, 'boss', pool);
  run.usedBosses.push(b.id);
  return b.id;
}

function rollSkipTokens(run: RunState): [string, string] {
  const pool = TOKENS.filter((t) => (t.minAnte ?? 1) <= run.ante);
  const a = pick(run, 'token', pool).id;
  const b = pick(run, 'token', pool.filter((t) => t.id !== a)).id;
  return [a, b];
}

// ───────────────────────────── Rounds ─────────────────────────────
function drawToHand(g: GameCtx) {
  const r = g.run.round!;
  g.refreshMods();
  const boss = bossActive(g.run) ? BOSS_MAP[r.bossId!] : null;
  let i = 0;
  while (r.hand.length < g.mods.handSize && r.drawPile.length) {
    const id = r.drawPile.pop()!;
    r.hand.push(id);
    const card = findCard(g.run, id);
    if (boss?.faceDown && card && boss.faceDown(g, card, i)) r.faceDown.push(id);
    i++;
  }
}

function pickDisabledCharm(g: GameCtx) {
  const r = g.run.round!;
  r.disabledCharm = null;
  if (!bossActive(g.run) || !BOSS_MAP[r.bossId!]?.disableCharm || !g.run.charms.length) return;
  r.disabledCharm = g.run.charms[Math.floor(rand(g.run, 'boss') * g.run.charms.length)].uid;
}

export function selectBlind(input: RunState): ActionResult {
  if (input.phase !== 'blindSelect') return fail(input, 'Not choosing a blind.');
  const run = clone(input);
  const blindType = blindTypeOf(run.blindIndex);
  const bossId = blindType === 'boss' ? run.bossId : null;
  run.round = {
    blindType, bossId, bossDisabled: false, target: 0, score: 0, handsLeft: 0, discardsLeft: 0,
    handsPlayed: 0, discardsUsed: 0, drawPile: [], hand: [], discardPile: [], faceDown: [], handTypesPlayed: [],
    disabledCharm: null, handSizeBonus: 0, lastHandScore: 0, lockedHand: null,
  };
  const r = run.round;
  if (bossId && run.charms.some((c) => c.id === 'patron_saint')) r.bossDisabled = true;
  // Round tokens
  run.tokens = run.tokens.filter((t) => {
    if (TOKEN_MAP[t]?.trigger !== 'round') return true;
    if (t === 'tok_juggle') r.handSizeBonus += 3;
    return false;
  });
  const g = new GameCtx(run);
  r.handsLeft = g.mods.hands;
  r.discardsLeft = g.mods.discards;
  r.target = blindTarget(run, blindType, bossId ?? undefined);
  r.drawPile = shuffle(run, 'deck', run.deck.map((c) => c.id));
  run.phase = 'playing';
  if (bossActive(run)) BOSS_MAP[bossId!]?.onStart?.(g);
  drawToHand(g);
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onRoundStart?.(g, c);
  g.refreshMods();
  r.handsLeft = g.mods.hands;
  r.discardsLeft = g.mods.discards;
  pickDisabledCharm(g);
  return { run };
}

export function skipBlind(input: RunState): ActionResult {
  if (input.phase !== 'blindSelect') return fail(input, 'Not choosing a blind.');
  if (input.blindIndex === 2) return fail(input, 'Boss blinds cannot be skipped.');
  if (input.challengeId === 'speedrun' && false) return fail(input, '');
  const run = clone(input);
  const g = new GameCtx(run);
  const tokenId = run.skipTokens[run.blindIndex as 0 | 1];
  const tok = TOKEN_MAP[tokenId];
  run.stats.blindsSkipped++;
  if (tok?.instant) tok.instant(g);
  else if (tok) run.tokens.push(tok.id);
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onSkipBlind?.(g, c);
  run.blindIndex = (run.blindIndex + 1) as 0 | 1 | 2;
  if (run.flags.rerollBoss) {
    delete run.flags.rerollBoss;
    run.bossId = chooseBoss(run);
  }
  g.log(`Skipped blind for ${tok?.name ?? 'a token'}.`);
  if (run.packQueue.length) openNextQueuedPack(run, 'blindSelect');
  return { run };
}

export function sortIdsByHand(run: RunState, ids: string[]): string[] {
  const order = run.round?.hand ?? [];
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

export function canPlayHand(run: RunState, ids: string[]): string | null {
  if (run.phase !== 'playing' || !run.round) return 'Not in a round.';
  const r = run.round;
  if (!ids.length) return 'Select at least one card.';
  if (ids.length > MAX_SELECT) return `You can play at most ${MAX_SELECT} cards.`;
  if (new Set(ids).size !== ids.length) return 'Duplicate card selection.';
  if (!ids.every((id) => r.hand.includes(id))) return 'Selected card is not in your hand.';
  if (r.handsLeft <= 0) return 'No hands left.';
  return null;
}

/** Boss rule the selection would break. Such hands may still be played, but score nothing. */
export function bossViolation(run: RunState, ids: string[]): string | null {
  if (!run.round || !bossActive(run) || !ids.length) return null;
  const boss = BOSS_MAP[run.round.bossId!];
  if (!boss?.canPlay) return null;
  const cards = ids.map((id) => findCard(run, id)!).filter(Boolean);
  return boss.canPlay(run, cards, previewHand(run, cards).type);
}

export function playHand(input: RunState, selected: string[]): ActionResult {
  const err = canPlayHand(input, selected);
  if (err) return fail(input, err);
  const run = clone(input);
  const r = run.round!;
  const ids = sortIdsByHand(run, selected);
  const played = ids.map((id) => findCard(run, id)!);
  r.hand = r.hand.filter((id) => !ids.includes(id));
  const held = r.hand.map((id) => findCard(run, id)!).filter(Boolean);
  const res = scoreHand(run, played, held);
  const g = new GameCtx(run);

  r.score += res.total;
  r.lastHandScore = res.total;
  r.handsLeft -= 1;
  r.handsPlayed += 1;
  r.faceDown = r.faceDown.filter((id) => !ids.includes(id));
  if (!r.lockedHand) r.lockedHand = res.hand;
  run.stats.handsPlayed++;
  run.stats.cardsPlayed += played.length;
  if (res.total > run.stats.bestHand) {
    run.stats.bestHand = res.total;
    run.stats.bestHandType = res.hand;
  }
  if (bossActive(run)) BOSS_MAP[r.bossId!]?.afterHand?.(g, played);
  // Played cards go to the discard pile unless destroyed
  const destroyed = new Set(res.destroyed);
  for (const id of ids) if (!destroyed.has(id) && findCard(run, id)) r.discardPile.push(id);

  if (r.score >= r.target) {
    winRound(run);
  } else if (r.handsLeft <= 0) {
    const ins = run.charms.find((c) => c.id === 'insurance');
    if (ins && r.score >= r.target * 0.5) {
      g.removeCharm(ins.uid);
      g.log('Insurance Policy paid out. You survive!');
      run.flags.insured = 1;
      winRound(run);
    } else {
      run.phase = 'gameOver';
      run.defeatScore = r.score;
    }
  } else {
    drawToHand(g);
    pickDisabledCharm(g);
    if (!r.hand.length) {
      run.phase = 'gameOver';
      run.defeatScore = r.score;
    }
  }
  return { run, score: res };
}

export function discardCards(input: RunState, selected: string[]): ActionResult {
  if (input.phase !== 'playing' || !input.round) return fail(input, 'Not in a round.');
  const r0 = input.round;
  if (r0.discardsLeft <= 0) return fail(input, 'No discards left.');
  if (!selected.length) return fail(input, 'Select cards to discard.');
  if (selected.length > MAX_SELECT) return fail(input, `You can discard at most ${MAX_SELECT} cards.`);
  if (new Set(selected).size !== selected.length || !selected.every((id) => r0.hand.includes(id))) return fail(input, 'Invalid selection.');
  const run = clone(input);
  const r = run.round!;
  const g = new GameCtx(run);
  const ids = sortIdsByHand(run, selected);
  const cards = ids.map((id) => findCard(run, id)!);
  r.hand = r.hand.filter((id) => !ids.includes(id));
  r.faceDown = r.faceDown.filter((id) => !ids.includes(id));
  r.discardPile.push(...ids);
  r.discardsLeft -= 1;
  r.discardsUsed += 1;
  run.stats.discards++;
  for (const c of cards) if (c.seal === 'violet' && !g.isDebuffed(c)) g.createConsumable('omen');
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onDiscard?.(g, c, cards);
  if (bossActive(run)) BOSS_MAP[r.bossId!]?.onDiscard?.(g, cards);
  drawToHand(g);
  if (!r.hand.length && r.handsLeft > 0 && !r.drawPile.length) {
    run.phase = 'gameOver';
    run.defeatScore = r.score;
  }
  return { run };
}

export function computeInterest(run: RunState): number {
  const m = getMods(run);
  if (m.interestCap <= 0 || run.money <= 0) return 0;
  return Math.min(m.interestCap, Math.floor(run.money / m.interestPer));
}

function winRound(run: RunState) {
  const r = run.round!;
  const g = new GameCtx(run);
  const lines: CashoutLine[] = [];
  const boss = r.blindType === 'boss' ? BOSS_MAP[r.bossId!] : null;
  const reward = boss?.noReward && !r.bossDisabled ? 0 : blindReward(run, r.blindType);
  lines.push({ label: `${BLIND_NAMES[r.blindType]} reward`, amount: reward });
  if (r.handsLeft > 0) lines.push({ label: `Remaining hands (${r.handsLeft})`, amount: r.handsLeft * g.mods.handReward });
  // Held cards: Treasure pays, Azure seals create Stars
  const heldCards = g.handCards();
  const treasure = heldCards.filter((c) => c.enhancement === 'treasure' && !g.isDebuffed(c)).length;
  if (treasure) lines.push({ label: `Treasure cards held (${treasure})`, amount: treasure * 3 });
  const lastHand = r.handTypesPlayed[r.handTypesPlayed.length - 1];
  for (const c of heldCards) {
    if (c.seal === 'azure' && !g.isDebuffed(c) && lastHand) g.createConsumable('star', STAR_FOR[lastHand]);
  }
  // Charm payouts (copyable)
  for (let i = 0; i < run.charms.length; i++) {
    const inst = run.charms[i];
    if (r.disabledCharm === inst.uid) continue;
    const res = resolveCharm(run, i);
    const amt = res?.def.payout?.(g, res.inst) ?? 0;
    if (amt) lines.push({ label: CHARM_MAP[inst.id].name, amount: amt });
    if (inst.edition === 'gilt') lines.push({ label: `${CHARM_MAP[inst.id].name} (Gilt)`, amount: 2 });
  }
  const interest = computeInterest(run);
  if (interest) lines.push({ label: `Interest ($1 per $${g.mods.interestPer}, max $${g.mods.interestCap})`, amount: interest });
  if (r.blindType === 'boss') {
    run.stats.bossesDefeated++;
    if (run.tokens.includes('tok_invest')) {
      run.tokens = run.tokens.filter((t) => t !== 'tok_invest');
      lines.push({ label: 'Investment', amount: 25 });
    }
    for (const c of g.activeCharms()) CHARM_MAP[c.id].onBossDefeated?.(g, c);
  }
  // End-of-round state changes (scaling, self-destruction). Iterate over a copy.
  for (const c of [...g.activeCharms()]) CHARM_MAP[c.id]?.onRoundEnd?.(g, c);
  run.cashout = lines;
  run.phase = 'cashout';
  const winAnte = (run.challengeId && CHALLENGE_MAP[run.challengeId]?.winAnte) || WIN_ANTE;
  if (r.blindType === 'boss' && run.ante >= winAnte && !run.won) {
    run.won = true;
    run.phase = 'victory';
  }
}

export function cashoutTotal(run: RunState): number {
  return (run.cashout ?? []).reduce((s, l) => s + l.amount, 0);
}

export function cashOut(input: RunState): ActionResult {
  if (input.phase !== 'cashout' && input.phase !== 'victory') return fail(input, 'Nothing to cash out.');
  const run = clone(input);
  const g = new GameCtx(run);
  g.addMoney(cashoutTotal(run));
  run.cashout = null;
  if (input.phase === 'victory') run.endless = true;
  const wasBoss = run.blindIndex === 2;
  run.round = null;
  if (wasBoss) {
    run.ante += 1;
    run.blindIndex = 0;
    run.bossId = chooseBoss(run);
    run.skipTokens = rollSkipTokens(run);
  } else {
    run.blindIndex = (run.blindIndex + 1) as 0 | 1 | 2;
  }
  enterShop(run);
  return { run };
}

// ───────────────────────────── Shop ─────────────────────────────
function rollEdition(g: GameCtx, forCharm: boolean): EditionId | null {
  const r = g.rand('edition');
  const k = g.mods.editionRate;
  const table: [EditionId, number][] = forCharm
    ? [['void', 0.003], ['spectrum', 0.006], ['aurora', 0.014], ['shimmer', 0.02], ['gilt', 0.015]]
    : [['echo', 0.01], ['void', 0.004], ['spectrum', 0.012], ['aurora', 0.02], ['shimmer', 0.03], ['gilt', 0.02]];
  let acc = 0;
  for (const [id, p] of table) {
    acc += p * k;
    if (r < acc) return id;
  }
  return null;
}

function randomPlayingCard(g: GameCtx, enhancedChance: number, extraChance: number): Card {
  const c = makeCard(g.run, 2 + Math.floor(g.rand('shopcard') * 13), SUITS[Math.floor(g.rand('shopcard') * 4)]);
  if (g.rand('shopcard') < enhancedChance) c.enhancement = ENHANCEMENT_IDS[Math.floor(g.rand('shopcard') * ENHANCEMENT_IDS.length)];
  if (g.rand('shopcard') < extraChance) c.edition = rollEdition(g, false) ?? (['shimmer', 'aurora', 'spectrum', 'gilt'] as EditionId[])[Math.floor(g.rand('shopcard') * 4)];
  if (g.rand('shopcard') < extraChance) c.seal = SEAL_IDS[Math.floor(g.rand('shopcard') * SEAL_IDS.length)];
  return c;
}

export function cardPrice(c: Card): number {
  return 1 + (c.enhancement ? 1 : 0) + (c.seal ? 1 : 0) + (c.edition ? EDITIONS[c.edition].cost : 0);
}

function rollShopItem(g: GameCtx): ShopItem {
  const ban = run_ban(g.run);
  const kinds = ['charm', 'omen', 'star', 'card', 'hex'] as const;
  const kind = weightedPick(g.run, 'shop', kinds, (k) => {
    if (k === 'charm') return ban.includes('charm') ? 0 : 20;
    if (k === 'omen') return ban.includes('consumable') ? 0 : 4 * g.mods.omenRate;
    if (k === 'star') return ban.includes('consumable') ? 0 : 4 * g.mods.starRate;
    if (k === 'hex') return ban.includes('consumable') ? 0 : 0.3;
    return g.mods.cardRate;
  });
  if (kind === 'charm') {
    const id = g.randomCharmId(g.rollRarity('shop'), 'shop');
    const edition = rollEdition(g, true);
    const def = CHARM_MAP[id];
    return { kind: 'charm', id, price: def.cost + (edition ? EDITIONS[edition].cost : 0), sold: false, edition };
  }
  if (kind === 'card') {
    const card = randomPlayingCard(g, g.mods.rules.has('enhancedShopCards') ? 0.5 : 0.25, 0.1);
    return { kind: 'card', id: card.id, price: cardPrice(card), sold: false, card };
  }
  const ckind: ConsumableKind = kind;
  const id = g.randomConsumableId(ckind, 'shop');
  return { kind: 'consumable', id, price: CONSUMABLE_MAP[id].cost, sold: false, consumableKind: ckind };
}

function run_ban(run: RunState) {
  return (run.challengeId && CHALLENGE_MAP[run.challengeId]?.banShop) || [];
}

function rollPack(g: GameCtx): ShopItem {
  const ban = run_ban(g.run);
  const p = weightedPick(g.run, 'pack', PACKS, (pk) => {
    if (pk.kind === 'star' && g.mods.starRate === 0) return 0;
    if (pk.kind === 'charm' && ban.includes('charm')) return 0;
    if (ban.includes('pack')) return 0;
    return pk.weight;
  });
  return { kind: 'pack', id: p.id, price: p.cost, sold: false };
}

function rollBoon(g: GameCtx): string | null {
  const owned = new Set(g.run.boons);
  const pool = BOONS.filter((b) => !owned.has(b.id) && (!b.requires || owned.has(b.requires)));
  if (!pool.length) return null;
  return pick(g.run, 'boon', pool).id;
}

export function shopPrice(run: RunState, item: ShopItem): number {
  if (item.free) return 0;
  const m = getMods(run);
  if (m.rules.has('freeStars') && ((item.kind === 'consumable' && item.consumableKind === 'star') || (item.kind === 'pack' && PACK_MAP[item.id]?.kind === 'star'))) return 0;
  const base = item.kind === 'boon' ? 10 : item.price;
  return Math.max(item.kind === 'card' ? 1 : 1, Math.floor((base - m.shopDiscount) * (1 - m.shopDiscountPct)));
}

function enterShop(run: RunState) {
  const g = new GameCtx(run);
  if (run.boonAnte !== run.ante) {
    run.boonOffer = rollBoon(g);
    run.boonAnte = run.ante;
  }
  const items: ShopItem[] = [];
  for (let i = 0; i < g.mods.shopSlots; i++) items.push(rollShopItem(g));
  const packs: ShopItem[] = [];
  for (let i = 0; i < g.mods.packSlots; i++) packs.push(rollPack(g));
  run.shop = {
    items, packs,
    boon: run.boonOffer ? { kind: 'boon', id: run.boonOffer, price: 10, sold: false } : null,
    rerollCost: 5, rerolls: 0, freeRerolls: 0, cardSoldThisShop: false,
  };
  // Shop tokens
  run.tokens = run.tokens.filter((t) => {
    const def = TOKEN_MAP[t];
    if (def?.trigger !== 'shop') return true;
    const shop = run.shop!;
    const freeCharm = (rarity: 'rare' | 'uncommon' | null, edition: EditionId | null) => {
      const id = rarity ? g.randomCharmId(rarity, 'shop') : g.randomCharmId(g.rollRarity('shop'), 'shop');
      shop.items.unshift({ kind: 'charm', id, price: CHARM_MAP[id].cost, sold: false, free: true, edition });
    };
    if (t === 'tok_rare') freeCharm('rare', null);
    if (t === 'tok_uncommon') freeCharm('uncommon', null);
    if (t === 'tok_spectrum') freeCharm(null, 'spectrum');
    if (t === 'tok_coupon') for (const it of shop.items) if (it.kind !== 'card') it.free = true;
    if (t === 'tok_reroll') shop.freeRerolls += 3;
    return false;
  });
  run.phase = 'shop';
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onShopEnter?.(g, c);
}

export function rerollCost(run: RunState): number {
  if (!run.shop) return 0;
  if (run.shop.freeRerolls > 0) return 0;
  return Math.max(0, run.shop.rerollCost - getMods(run).rerollDiscount);
}

export function canAfford(run: RunState, cost: number): boolean {
  return run.money - cost >= -getMods(run).debtLimit;
}

export function reroll(input: RunState): ActionResult {
  if (input.phase !== 'shop' || !input.shop) return fail(input, 'Not in the shop.');
  const cost = rerollCost(input);
  if (!canAfford(input, cost)) return fail(input, 'Not enough money.');
  const run = clone(input);
  const g = new GameCtx(run);
  const shop = run.shop!;
  if (shop.freeRerolls > 0) shop.freeRerolls--;
  else {
    run.money -= cost;
    shop.rerollCost += 1;
  }
  shop.rerolls++;
  run.stats.rerolls++;
  shop.items = [];
  for (let i = 0; i < g.mods.shopSlots; i++) shop.items.push(rollShopItem(g));
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onReroll?.(g, c);
  return { run };
}

export type ShopSection = 'items' | 'packs' | 'boon';

export function buyItem(input: RunState, section: ShopSection, index: number, useNow = false): ActionResult {
  if (input.phase !== 'shop' || !input.shop) return fail(input, 'Not in the shop.');
  const src = section === 'boon' ? input.shop.boon : input.shop[section][index];
  if (!src || src.sold) return fail(input, 'That item is no longer available.');
  const price = shopPrice(input, src);
  if (!canAfford(input, price)) return fail(input, 'Not enough money.');
  const run = clone(input);
  const g = new GameCtx(run);
  const item = section === 'boon' ? run.shop!.boon! : run.shop![section][index];
  switch (item.kind) {
    case 'charm': {
      if (item.edition !== 'void' && !g.hasCharmRoom()) return fail(input, 'No room for another charm. Sell one first.');
      run.money -= price;
      g.createCharm(item.id, item.edition ?? null);
      run.stats.charmsBought++;
      break;
    }
    case 'consumable': {
      const def = CONSUMABLE_MAP[item.id];
      if (useNow) {
        if (def.select) return fail(input, 'This item needs selected cards; buy it first.');
        if (def.canUse && !def.canUse(g, [])) return fail(input, 'Can’t use that right now.');
        run.money -= price;
        applyConsumable(g, def.id, def.kind, []);
      } else {
        if (!g.hasConsumableRoom()) return fail(input, 'Consumable slots are full.');
        run.money -= price;
        g.createConsumable(def.kind, def.id);
      }
      break;
    }
    case 'card': {
      run.money -= price;
      g.addCard({ ...item.card!, id: item.card!.id }, false);
      break;
    }
    case 'pack': {
      run.money -= price;
      item.sold = true;
      afterBuy(g);
      openPack(run, item.id, 'shop');
      return { run };
    }
    case 'boon': {
      run.money -= price;
      run.boons.push(item.id);
      BOON_MAP[item.id]?.onBuy?.(g);
      run.boonOffer = null;
      break;
    }
  }
  item.sold = true;
  afterBuy(g);
  return { run };
}

function afterBuy(g: GameCtx) {
  if (g.run.challengeId === 'inflation') g.run.flags.inflation = (g.run.flags.inflation ?? 0) + 1;
  g.refreshMods();
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onBuy?.(g, c);
}

export function sellCharm(input: RunState, uid: string): ActionResult {
  if (['gameOver', 'victory'].includes(input.phase)) return fail(input, 'Can’t sell now.');
  const inst = input.charms.find((c) => c.uid === uid);
  if (!inst) return fail(input, 'Charm not found.');
  const run = clone(input);
  const g = new GameCtx(run);
  const self = run.charms.find((c) => c.uid === uid)!;
  const value = charmSellValue(run, self, g.mods);
  g.removeCharm(uid);
  run.money += value;
  CHARM_MAP[self.id]?.onSell?.(g, self);
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onOtherSold?.(g, c, self);
  if (run.round) {
    if (run.round.disabledCharm === uid) run.round.disabledCharm = null;
    // Selling hand-size/hands charms mid-round doesn't refund hands but we clamp to new limits.
    g.refreshMods();
  }
  return { run };
}

export function sellConsumable(input: RunState, uid: string): ActionResult {
  if (['gameOver', 'victory'].includes(input.phase)) return fail(input, 'Can’t sell now.');
  const inst = input.consumables.find((c) => c.uid === uid);
  if (!inst) return fail(input, 'Consumable not found.');
  const run = clone(input);
  const g = new GameCtx(run);
  run.money += consumableSellValue(run, inst, g.mods);
  run.consumables = run.consumables.filter((c) => c.uid !== uid);
  const pseudo = { uid, id: inst.id, edition: null, state: {}, sellBonus: 0 };
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onOtherSold?.(g, c, pseudo);
  return { run };
}

export function sellCardValue(c: Card): number {
  return 1 + (c.enhancement || c.edition || c.seal ? 1 : 0);
}

/** Pawn one playing card per shop visit. */
export function sellCard(input: RunState, cardId: string): ActionResult {
  if (input.phase !== 'shop' || !input.shop) return fail(input, 'You can only pawn cards in the shop.');
  if (input.shop.cardSoldThisShop) return fail(input, 'You can only pawn one card per shop visit.');
  if (input.deck.length <= 5) return fail(input, 'Your deck is too small.');
  const card = input.deck.find((c) => c.id === cardId);
  if (!card) return fail(input, 'Card not found.');
  const run = clone(input);
  run.deck = run.deck.filter((c) => c.id !== cardId);
  run.money += sellCardValue(card);
  run.shop!.cardSoldThisShop = true;
  return { run };
}

export function leaveShop(input: RunState): ActionResult {
  if (input.phase !== 'shop') return fail(input, 'Not in the shop.');
  const run = clone(input);
  const g = new GameCtx(run);
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onShopExit?.(g, c);
  run.shop = null;
  run.phase = 'blindSelect';
  return { run };
}

export function moveCharm(input: RunState, from: number, to: number): ActionResult {
  if (from === to || from < 0 || to < 0 || from >= input.charms.length || to >= input.charms.length) return { run: input };
  const run = clone(input);
  const [c] = run.charms.splice(from, 1);
  run.charms.splice(to, 0, c);
  return { run };
}

export function reorderHand(input: RunState, ids: string[]): ActionResult {
  if (!input.round) return { run: input };
  const cur = input.round.hand;
  if (ids.length !== cur.length || !ids.every((id) => cur.includes(id))) return fail(input, 'Invalid order.');
  const run = clone(input);
  run.round!.hand = [...ids];
  return { run };
}

export function sortHand(input: RunState, by: 'rank' | 'suit'): ActionResult {
  if (!input.round) return { run: input };
  const run = clone(input);
  const cards = run.round!.hand.map((id) => findCard(run, id)!);
  const suitOrder = { S: 0, H: 1, C: 2, D: 3 } as const;
  const rk = (c: Card) => (hasRank(c) ? c.rank : 0);
  cards.sort((a, b) => (by === 'rank' ? rk(b) - rk(a) || suitOrder[a.suit] - suitOrder[b.suit] : suitOrder[a.suit] - suitOrder[b.suit] || rk(b) - rk(a)));
  run.round!.hand = cards.map((c) => c.id);
  return { run };
}

// ───────────────────────────── Consumables ─────────────────────────────
function applyConsumable(g: GameCtx, id: string, kind: ConsumableKind, selected: Card[]) {
  const def = CONSUMABLE_MAP[id];
  def.use(g, selected);
  g.run.stats.consumablesUsed++;
  if (kind === 'star') g.run.stats.starsUsed++;
  if (kind === 'omen') g.run.stats.omensUsed++;
  if (kind === 'hex') g.run.stats.hexesUsed++;
  if (kind !== 'hex' && id !== 'omen_echo') g.run.lastConsumable = id;
  for (const c of g.activeCharms()) CHARM_MAP[c.id]?.onConsumableUsed?.(g, c, kind, id);
  g.refreshMods();
}

export function consumableTargets(run: RunState): string[] {
  if (run.phase === 'playing' && run.round) return run.round.hand;
  if (run.phase === 'pack' && run.pack) return run.pack.hand;
  return [];
}

export function canUseConsumable(run: RunState, uid: string, selected: string[]): string | null {
  const inst = run.consumables.find((c) => c.uid === uid);
  if (!inst) return 'Not found.';
  if (['gameOver', 'victory', 'cashout'].includes(run.phase)) return 'Can’t use that now.';
  const def = CONSUMABLE_MAP[inst.id];
  const targets = consumableTargets(run);
  if (!selected.every((id) => targets.includes(id))) return 'Select cards from your hand.';
  if (def.select) {
    const [min, max] = def.select;
    if (selected.length < min || selected.length > max) return min === max ? `Select exactly ${min} card${min > 1 ? 's' : ''}.` : `Select ${min}–${max} cards.`;
  }
  const g = new GameCtx(run);
  // The used item frees its own slot before its effect resolves.
  if (def.canUse) {
    const tmp = structuredClone(run);
    tmp.consumables = tmp.consumables.filter((c) => c.uid !== uid);
    const tg = new GameCtx(tmp);
    const cards = selected.map((id) => findCard(tmp, id)!);
    if (!def.canUse(tg, cards)) return 'Can’t use that right now.';
  }
  void g;
  return null;
}

export function useConsumable(input: RunState, uid: string, selected: string[] = []): ActionResult {
  const err = canUseConsumable(input, uid, selected);
  if (err) return fail(input, err);
  const run = clone(input);
  const inst = run.consumables.find((c) => c.uid === uid)!;
  run.consumables = run.consumables.filter((c) => c.uid !== uid);
  const g = new GameCtx(run);
  const cards = sortIdsByHandOrPack(run, selected).map((id) => findCard(run, id)!);
  applyConsumable(g, inst.id, inst.kind, cards);
  return { run };
}

function sortIdsByHandOrPack(run: RunState, ids: string[]) {
  const order = consumableTargets(run);
  return [...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

// ───────────────────────────── Packs ─────────────────────────────
function distinctPick<T extends { id: string }>(run: RunState, stream: string, pool: T[], n: number): T[] {
  return shuffle(run, stream, pool).slice(0, Math.min(n, pool.length));
}

export function generatePackChoices(g: GameCtx, packId: string): PackChoice[] {
  const pack = PACK_MAP[packId];
  const run = g.run;
  const out: PackChoice[] = [];
  switch (pack.kind) {
    case 'card':
      for (let i = 0; i < pack.size; i++) out.push({ kind: 'card', card: randomPlayingCard(g, 0.3, 0.08) });
      break;
    case 'enhanced':
      for (let i = 0; i < pack.size; i++) {
        const c = randomPlayingCard(g, 1, 0.4);
        if (!c.edition && !c.seal) c.seal = SEAL_IDS[Math.floor(g.rand('pack') * SEAL_IDS.length)];
        out.push({ kind: 'card', card: c });
      }
      break;
    case 'omen':
      for (const d of distinctPick(run, 'pack', OMENS, pack.size)) out.push({ kind: 'consumable', id: d.id, consumableKind: 'omen' });
      break;
    case 'hex':
      for (const d of distinctPick(run, 'pack', HEXES, pack.size)) out.push({ kind: 'consumable', id: d.id, consumableKind: 'hex' });
      break;
    case 'star': {
      let pool = STARS.filter((s) => s.hand !== 'five' || (run.stats.handCounts.five ?? 0) > 0);
      const picks = distinctPick(run, 'pack', pool, pack.size);
      if (g.mods.rules.has('telescope')) {
        const sid = STAR_FOR[g.mostPlayedHand()];
        if (sid && !picks.some((p) => p.id === sid)) picks[0] = CONSUMABLE_MAP[sid];
      }
      pool = picks;
      for (const d of pool) out.push({ kind: 'consumable', id: d.id, consumableKind: 'star' });
      break;
    }
    case 'charm': {
      const seen = new Set<string>();
      for (let i = 0; i < pack.size; i++) {
        const id = g.randomCharmId(g.rollRarity('pack'), 'pack', seen);
        seen.add(id);
        out.push({ kind: 'charm', id, edition: rollEdition(g, true) });
      }
      break;
    }
    case 'discovery': {
      const seen = new Set<string>();
      for (let i = 0; i < pack.size; i++) {
        const k = weightedPick(run, 'pack', ['charm', 'omen', 'star', 'hex', 'card'] as const, (x) =>
          x === 'charm' ? 3 : x === 'card' ? 2 : x === 'hex' ? 1 : x === 'star' ? (g.mods.starRate === 0 ? 0 : 2) : 2,
        );
        if (k === 'charm') {
          const rarity = g.rand('pack') < 0.3 ? 'rare' : 'uncommon';
          const id = g.randomCharmId(rarity, 'pack', seen);
          seen.add(id);
          out.push({ kind: 'charm', id, edition: rollEdition(g, true) });
        } else if (k === 'card') out.push({ kind: 'card', card: randomPlayingCard(g, 1, 0.5) });
        else {
          const pool = (k === 'omen' ? OMENS : k === 'star' ? STARS : HEXES).filter((d) => !seen.has(d.id));
          const d = pick(run, 'pack', pool);
          seen.add(d.id);
          out.push({ kind: 'consumable', id: d.id, consumableKind: k });
        }
      }
      break;
    }
  }
  return out;
}

export function openPack(run: RunState, packId: string, returnTo: 'shop' | 'blindSelect') {
  const g = new GameCtx(run);
  const def = PACK_MAP[packId];
  const choices = generatePackChoices(g, packId);
  let hand: string[] = [];
  if (def.needsHand || choices.some((c) => c.kind === 'consumable' && CONSUMABLE_MAP[c.id]?.select)) {
    hand = shuffle(run, 'packdeal', run.deck.map((c) => c.id)).slice(0, g.mods.handSize);
  }
  run.pack = { packId, choices, picksLeft: def.picks, taken: [], hand, returnTo };
  run.phase = 'pack';
}

function openNextQueuedPack(run: RunState, returnTo: 'shop' | 'blindSelect') {
  const next = run.packQueue.shift();
  if (next) openPack(run, next, returnTo);
}

function closePack(run: RunState) {
  const returnTo = run.pack?.returnTo ?? 'shop';
  run.pack = null;
  run.phase = returnTo;
  if (run.packQueue.length) openNextQueuedPack(run, returnTo);
}

export function canPickPack(run: RunState, index: number, selected: string[]): string | null {
  if (run.phase !== 'pack' || !run.pack) return 'No pack open.';
  const p = run.pack;
  const ch = p.choices[index];
  if (!ch || p.taken.includes(index)) return 'Already taken.';
  if (p.picksLeft <= 0) return 'No picks left.';
  const g = new GameCtx(run);
  if (ch.kind === 'charm' && ch.edition !== 'void' && !g.hasCharmRoom()) return 'No room for another charm.';
  if (ch.kind === 'consumable') {
    const def = CONSUMABLE_MAP[ch.id];
    if (!selected.every((id) => p.hand.includes(id))) return 'Select cards from the dealt hand.';
    if (def.select) {
      const [min, max] = def.select;
      if (selected.length < min || selected.length > max) return min === max ? `Select exactly ${min} card${min > 1 ? 's' : ''} first.` : `Select ${min}–${max} cards first.`;
    }
    if (def.canUse && !def.canUse(g, selected.map((id) => findCard(run, id)!))) return 'Can’t use that right now.';
  }
  return null;
}

export function pickPackItem(input: RunState, index: number, selected: string[] = []): ActionResult {
  const err = canPickPack(input, index, selected);
  if (err) return fail(input, err);
  const run = clone(input);
  const p = run.pack!;
  const ch = p.choices[index];
  const g = new GameCtx(run);
  if (ch.kind === 'card') g.addCard({ ...ch.card }, false);
  else if (ch.kind === 'charm') g.createCharm(ch.id, ch.edition);
  else {
    const cards = selected.map((id) => findCard(run, id)!);
    applyConsumable(g, ch.id, ch.consumableKind, cards);
  }
  if (run.pack) {
    run.pack.taken.push(index);
    run.pack.picksLeft -= 1;
    if (run.pack.picksLeft <= 0 || run.pack.taken.length >= run.pack.choices.length) closePack(run);
  }
  return { run };
}

export function skipPack(input: RunState): ActionResult {
  if (input.phase !== 'pack' || !input.pack) return fail(input, 'No pack open.');
  const run = clone(input);
  const g = new GameCtx(run);
  for (const c of g.activeCharms()) CHARM_MAP[c.id].onPackSkipped?.(g, c);
  closePack(run);
  return { run };
}

// ───────────────────────────── Queries ─────────────────────────────
export function deckRemaining(run: RunState): Card[] {
  if (!run.round) return run.deck;
  return run.round.drawPile.map((id) => findCard(run, id)!).filter(Boolean);
}

export function handCards(run: RunState): Card[] {
  return (run.round?.hand ?? []).map((id) => findCard(run, id)!).filter(Boolean);
}

export function upcomingBlinds(run: RunState) {
  return ([0, 1, 2] as const).map((i) => {
    const type = blindTypeOf(i);
    return {
      index: i,
      type,
      target: blindTarget(run, type),
      reward: type === 'boss' && BOSS_MAP[run.bossId]?.noReward ? 0 : blindReward(run, type),
      bossId: type === 'boss' ? run.bossId : null,
      token: i < 2 ? run.skipTokens[i as 0 | 1] : null,
      state: i < run.blindIndex ? 'done' : i === run.blindIndex ? 'current' : 'upcoming',
    };
  });
}

export { charmAllowed, CHARMS };
