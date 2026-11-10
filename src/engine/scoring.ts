// Ordered, transparent scoring pipeline.
// 1 hand identification → 2 base → 3-6 per-card (rank, enhancement, edition, seal) → 7 charms per card
// → 8 retriggers → held cards → charm phase → final Chips × Mult. Every change is recorded as a ScoreStep.
import type { Card, CharmInstance, Effect, ScoreResult, ScoreStep, RunState } from './types';
import { evaluateHand, handBase, HANDS } from './hands';
import { GameCtx, type ScoreCtx, bossActive, findCard } from './core';
import { CHARM_MAP } from './content/charms';
import { BOSS_MAP } from './content/bosses';
import type { CharmDef } from './content/defs';
import { cardLabel, isFace, rankChips, suitIs, hasRank } from './cards';

const fmtX = (x: number) => (Math.round(x * 100) / 100).toString();

/** Resolve which charm definition/instance actually executes for this slot (handles copy charms). */
export function resolveCharm(run: RunState, index: number, depth = 0): { def: CharmDef; inst: CharmInstance } | null {
  const inst = run.charms[index];
  if (!inst) return null;
  const def = CHARM_MAP[inst.id];
  if (!def) return null;
  if (!def.copies) return { def, inst };
  if (depth > run.charms.length) return null;
  const targetIdx = def.copies === 'right' ? index + 1 : 0;
  if (targetIdx === index) return null;
  const target = run.charms[targetIdx];
  if (!target || run.round?.disabledCharm === target.uid) return null;
  const tdef = CHARM_MAP[target.id];
  if (!tdef || tdef.noCopy) return null;
  return resolveCharm(run, targetIdx, depth + 1);
}

export function makeScoreCtx(run: RunState, played: Card[], held: Card[]): ScoreCtx {
  const g = new GameCtx(run);
  const rules = g.mods.rules;
  const debuffed = new Set(played.filter((c) => g.isDebuffed(c)).map((c) => c.id));
  const ev = evaluateHand(played, rules, debuffed);
  const r = run.round!;
  const ctx = Object.assign(g, {
    hand: ev.type,
    played,
    scoring: ev.scoring,
    held,
    contains: ev.contains,
    chips: 0,
    mult: 0,
    firstHand: r.handsPlayed === 0,
    lastHand: r.handsLeft <= 1,
    scoreBefore: r.score,
    target: r.target,
    toDestroy: new Set<string>(),
    cardIndex: 0,
    isFace: (c: Card) => isFace(c, rules),
    suitIs: (c: Card, s: Card['suit']) => suitIs(c, s, rules, debuffed.has(c.id)),
  }) as ScoreCtx;
  return ctx;
}

export function scoreHand(run: RunState, played: Card[], held: Card[]): ScoreResult {
  const ctx = makeScoreCtx(run, played, held);
  const steps: ScoreStep[] = [];
  const rules = ctx.mods.rules;
  run.flags.fortuneHits = 0;

  const push = (s: Omit<ScoreStep, 'chipsAfter' | 'multAfter'>) => steps.push({ ...s, chipsAfter: ctx.chips, multAfter: ctx.mult });
  const apply = (eff: Effect | void | null | undefined, kind: ScoreStep['kind'], source: string | null) => {
    if (!eff) return;
    if (eff.chips) {
      ctx.chips += eff.chips;
      push({ kind, source, chips: eff.chips, text: `${eff.chips > 0 ? '+' : ''}${eff.chips} Chips` });
    }
    if (eff.mult) {
      ctx.mult += eff.mult;
      push({ kind, source, mult: eff.mult, text: `${eff.mult > 0 ? '+' : ''}${eff.mult} Mult` });
    }
    if (eff.xmult !== undefined && eff.xmult !== 1) {
      ctx.mult *= eff.xmult;
      push({ kind, source, xmult: eff.xmult, text: `×${fmtX(eff.xmult)} Mult` });
    }
    if (eff.money) {
      ctx.addMoney(eff.money);
      push({ kind, source, money: eff.money, text: `${eff.money > 0 ? '+' : '-'}$${Math.abs(eff.money)}` });
    }
    if (eff.msg && !eff.chips && !eff.mult && !eff.xmult && !eff.money) push({ kind: 'info', source, text: eff.msg });
  };

  const r = run.round!;
  // ── Boss rule violations: the hand is played but scores nothing.
  if (bossActive(run)) {
    const why = BOSS_MAP[r.bossId!]?.canPlay?.(run, played, ctx.hand);
    if (why) {
      r.handTypesPlayed.push(ctx.hand);
      run.stats.handCounts[ctx.hand] = (run.stats.handCounts[ctx.hand] ?? 0) + 1;
      push({ kind: 'base', source: null, text: `${HANDS[ctx.hand].name}` });
      push({ kind: 'info', source: null, text: `Blocked: ${why}` });
      push({ kind: 'final', source: null, text: 'Scores nothing' });
      return { hand: ctx.hand, scoringIds: [], chips: 0, mult: 0, total: 0, steps, destroyed: [] };
    }
  }
  // ── Hand-level bookkeeping happens before scoring (boss Tithe acts on it).
  r.handTypesPlayed.push(ctx.hand);
  if (bossActive(run)) BOSS_MAP[r.bossId!]?.beforeScore?.(ctx);
  run.stats.handCounts[ctx.hand] = (run.stats.handCounts[ctx.hand] ?? 0) + 1;
  if (!run.handTypesSeen.includes(ctx.hand)) run.handTypesSeen.push(ctx.hand);

  // ── 2. Base hand value
  const base = handBase(ctx.hand, run.handLevels[ctx.hand] ?? 1);
  ctx.chips = base.chips;
  ctx.mult = base.mult;
  if (bossActive(run)) BOSS_MAP[r.bossId!]?.base?.(ctx);
  push({ kind: 'base', source: null, text: `${HANDS[ctx.hand].name} (Lv.${run.handLevels[ctx.hand] ?? 1})` });

  const active = (i: number) => run.round?.disabledCharm !== run.charms[i]?.uid;

  // ── Charm "before" hooks (scaling, card conversion). Never copied.
  for (let i = 0; i < run.charms.length; i++) {
    if (!active(i)) continue;
    const inst = run.charms[i];
    CHARM_MAP[inst.id]?.before?.(ctx, inst);
  }

  // ── 3-8. Scoring cards, left to right, with retriggers
  ctx.scoring.forEach((card, idx) => {
    ctx.cardIndex = idx;
    if (ctx.isDebuffed(card)) {
      push({ kind: 'info', source: card.id, text: 'Debuffed' });
      return;
    }
    let triggers = 1;
    if (card.seal === 'ruby') triggers++;
    if (card.edition === 'echo') triggers++;
    for (let i = 0; i < run.charms.length; i++) {
      if (!active(i)) continue;
      const res = resolveCharm(run, i);
      if (res?.def.retrigScored) triggers += res.def.retrigScored(ctx, res.inst, card);
    }
    triggers = Math.min(triggers, 12);
    for (let t = 0; t < triggers; t++) {
      if (t > 0) push({ kind: 'info', source: card.id, text: 'Again!' });
      // Rank chips + permanent bonuses
      const chips = (hasRank(card) ? rankChips(card.rank) : 0) + card.bonusChips;
      if (chips) apply({ chips }, 'card', card.id);
      if (card.bonusMult) apply({ mult: card.bonusMult }, 'card', card.id);
      // Enhancement
      switch (card.enhancement) {
        case 'plated': apply({ chips: 30 }, 'card', card.id); break;
        case 'ember': apply({ mult: 4 }, 'card', card.id); break;
        case 'crystal': apply({ xmult: rules.has('unbreakable') ? 1.5 : 2 }, 'card', card.id); break;
        case 'monolith': apply({ chips: 50 }, 'card', card.id); break;
        case 'volt': apply({ mult: 2 }, 'card', card.id); card.bonusMult += 1; break;
        case 'fortune': {
          const mul = rules.has('luckyFortune') ? 2 : 1;
          if (ctx.chance(1 * mul, 5)) { apply({ mult: 20 }, 'card', card.id); run.flags.fortuneHits++; }
          if (ctx.chance(1 * mul, 15)) { apply({ money: 20 }, 'card', card.id); run.flags.fortuneHits++; }
          break;
        }
        default: break;
      }
      // Edition
      switch (card.edition) {
        case 'shimmer': apply({ chips: 50 }, 'card', card.id); break;
        case 'aurora': apply({ mult: 10 }, 'card', card.id); break;
        case 'spectrum': apply({ xmult: 1.5 }, 'card', card.id); break;
        case 'gilt': apply({ money: 2 }, 'card', card.id); break;
        default: break;
      }
      // Seal
      if (card.seal === 'golden') apply({ money: 3 }, 'card', card.id);
      if (card.seal === 'jade') { card.bonusChips += 6; push({ kind: 'info', source: card.id, text: '+6 Chips forever' }); }
      // Charms reacting to the scored card
      for (let i = 0; i < run.charms.length; i++) {
        if (!active(i)) continue;
        const res = resolveCharm(run, i);
        if (!res?.def.onScored) continue;
        const eff = res.def.onScored(ctx, res.inst, card);
        apply(eff, 'charm', run.charms[i].uid);
      }
    }
  });

  // ── Held-in-hand effects
  for (const card of held) {
    if (ctx.isDebuffed(card)) continue;
    let triggers = 1;
    if (card.seal === 'silver') triggers++;
    for (let i = 0; i < run.charms.length; i++) {
      if (!active(i)) continue;
      const res = resolveCharm(run, i);
      if (res?.def.retrigHeld) triggers += res.def.retrigHeld(ctx, res.inst, card);
    }
    for (let t = 0; t < triggers; t++) {
      const before = steps.length;
      if (card.enhancement === 'iron') apply({ xmult: 1.5 }, 'held', card.id);
      if (card.enhancement === 'magnet') apply({ mult: 4 }, 'held', card.id);
      if (card.seal === 'silver' && t === 0) apply({ mult: 3 }, 'held', card.id);
      for (let i = 0; i < run.charms.length; i++) {
        if (!active(i)) continue;
        const res = resolveCharm(run, i);
        if (!res?.def.onHeld) continue;
        apply(res.def.onHeld(ctx, res.inst, card), 'charm', run.charms[i].uid);
      }
      if (steps.length === before) break; // nothing to retrigger
    }
  }

  // ── Charm phase, left to right: edition (chips/mult) → ability → Spectrum
  for (let i = 0; i < run.charms.length; i++) {
    if (!active(i)) continue;
    const inst = run.charms[i];
    if (inst.edition === 'shimmer') apply({ chips: 50 }, 'charm', inst.uid);
    if (inst.edition === 'aurora') apply({ mult: 10 }, 'charm', inst.uid);
    const res = resolveCharm(run, i);
    if (res?.def.main) apply(res.def.main(ctx, res.inst), 'charm', inst.uid);
    if (inst.edition === 'spectrum') apply({ xmult: 1.5 }, 'charm', inst.uid);
  }

  ctx.mult = Math.max(ctx.mult, 0);
  const total = Math.floor(ctx.chips * ctx.mult);
  push({ kind: 'final', source: null, text: `${Math.floor(ctx.chips)} × ${fmtX(ctx.mult)} = ${total}` });

  // ── After hooks (consumable creation, money, resets). Never copied.
  for (let i = 0; i < run.charms.length; i++) {
    if (!active(i)) continue;
    const inst = run.charms[i];
    CHARM_MAP[inst.id]?.after?.(ctx, inst);
  }

  // ── Crystal shatter
  if (!rules.has('unbreakable')) {
    for (const card of ctx.scoring) {
      if (card.enhancement === 'crystal' && !ctx.isDebuffed(card) && ctx.chance(1, 4, 'shatter')) ctx.toDestroy.add(card.id);
    }
  }
  const destroyed = [...ctx.toDestroy];
  if (destroyed.length) {
    for (const id of destroyed) {
      const c = findCard(run, id);
      if (c) steps.push({ kind: 'info', source: id, text: c.enhancement === 'crystal' ? 'Shattered!' : 'Destroyed!', chipsAfter: ctx.chips, multAfter: ctx.mult });
    }
    ctx.destroyCards(destroyed);
  }

  return {
    hand: ctx.hand,
    scoringIds: ctx.scoring.map((c) => c.id),
    chips: Math.floor(ctx.chips),
    mult: ctx.mult,
    total,
    steps,
    destroyed,
  };
}

/** Preview the hand type for currently selected cards (UI helper). */
export function previewHand(run: RunState, cards: Card[]) {
  const g = new GameCtx(run);
  const debuffed = new Set(cards.filter((c) => g.isDebuffed(c)).map((c) => c.id));
  const ev = evaluateHand(cards, g.mods.rules, debuffed);
  const base = handBase(ev.type, run.handLevels[ev.type] ?? 1);
  return { type: ev.type, scoringIds: ev.scoring.map((c) => c.id), ...base };
}

export { cardLabel };
