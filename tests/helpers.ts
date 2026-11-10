import type { Card, RunState, Suit, EnhancementId, EditionId, SealId } from '../src/engine/types';
import { createRun, selectBlind } from '../src/engine/run';
import { makeCard } from '../src/engine/cards';
import { GameCtx } from '../src/engine/core';

export interface CardSpec { e?: EnhancementId; ed?: EditionId; s?: SealId }

const RANK: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };
export function parse(run: RunState, spec: string, extra: CardSpec = {}): Card {
  const suit = spec.slice(-1) as Suit;
  const r = spec.slice(0, -1);
  const rank = RANK[r] ?? parseInt(r, 10);
  return makeCard(run, rank, suit, { enhancement: extra.e ?? null, edition: extra.ed ?? null, seal: extra.s ?? null });
}

export function cards(run: RunState, specs: string[]): Card[] {
  return specs.map((s) => parse(run, s));
}

export function startedRun(seed = 'TESTSEED', opts: Parameters<typeof createRun>[0] = {}): RunState {
  const run = createRun({ seed, ...opts });
  return selectBlind(run).run;
}

/** Replace the hand with the given cards (added to the deck). Returns ids in order. */
export function setHand(run: RunState, specs: (string | [string, CardSpec])[]): string[] {
  const r = run.round!;
  const ids: string[] = [];
  for (const sp of specs) {
    const c = typeof sp === 'string' ? parse(run, sp) : parse(run, sp[0], sp[1]);
    run.deck.push(c);
    ids.push(c.id);
  }
  r.drawPile.push(...r.hand);
  r.hand = ids;
  return ids;
}

export function addCharm(run: RunState, id: string, edition: EditionId | null = null) {
  const g = new GameCtx(run);
  return g.createCharm(id, edition, true)!;
}

export function setTarget(run: RunState, target: number) {
  run.round!.target = target;
}
