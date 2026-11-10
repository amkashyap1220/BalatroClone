// A simple autoplayer used by tests (fuzzing invariants) and balance simulations.
import type { RunState } from './types';
import {
  selectBlind, skipBlind, playHand, discardCards, cashOut, leaveShop, buyItem, reroll, rerollCost, shopPrice, canAfford,
  useConsumable, pickPackItem, skipPack, canPlayHand, sellCharm, canUseConsumable, bossViolation,
} from './run';
import { previewHand } from './scoring';
import { findCard, getMods } from './core';
import { CONSUMABLE_MAP } from './content/consumables';
import { mulberry } from './rng';

function combos<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const rec = (start: number, cur: T[]) => {
    if (cur.length === k) { out.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  return out;
}

export function bestPlay(run: RunState): string[] {
  return bestPlayScored(run).ids;
}

export function bestPlayScored(run: RunState): { ids: string[]; score: number } {
  const hand = run.round!.hand;
  let best: string[] = [hand[0]];
  let bestScore = -1;
  for (let k = Math.min(5, hand.length); k >= 1; k--) {
    for (const c of combos(hand, k)) {
      if (canPlayHand(run, c) || bossViolation(run, c)) continue;
      const cards = c.map((id) => findCard(run, id)!);
      const p = previewHand(run, cards);
      const chips = p.chips + p.scoringIds.reduce((s, id) => { const cc = findCard(run, id)!; return s + Math.min(11, cc.rank === 14 ? 11 : cc.rank > 10 ? 10 : cc.rank); }, 0);
      const score = chips * p.mult;
      if (score > bestScore) { bestScore = score; best = c; }
    }
  }
  return { ids: best, score: bestScore };
}

export interface BotStats { actions: number; errors: string[] }

/** Advance the run by one bot decision. Returns the new state. */
export function botStep(run: RunState, rngState: { s: number }, stats: BotStats): RunState {
  const rnd = () => { const [v, n] = mulberry(rngState.s); rngState.s = n; return v; };
  stats.actions++;
  const ok = (res: { run: RunState; error?: string }, label: string) => {
    if (res.error) stats.errors.push(`${label}: ${res.error}`);
    return res.run;
  };
  switch (run.phase) {
    case 'blindSelect':
      if (run.blindIndex < 2 && rnd() < 0.15) return ok(skipBlind(run), 'skip');
      return ok(selectBlind(run), 'select');
    case 'playing': {
      // Use a consumable sometimes
      if (run.consumables.length && rnd() < 0.3) {
        const c = run.consumables[Math.floor(rnd() * run.consumables.length)];
        const def = CONSUMABLE_MAP[c.id];
        const n = def.select ? def.select[0] + Math.floor(rnd() * (def.select[1] - def.select[0] + 1)) : 0;
        const sel = run.round!.hand.slice(0, n);
        if (!canUseConsumable(run, c.uid, sel)) return ok(useConsumable(run, c.uid, sel), 'use');
      }
      const r = run.round!;
      const best = bestPlayScored(run);
      const need = (r.target - r.score) / Math.max(1, r.handsLeft);
      if (r.discardsLeft > 0 && (best.score < need * 0.8 || rnd() < 0.1)) {
        const keep = new Set(best.ids.length >= 2 ? best.ids : []);
        let toss = r.hand.filter((id) => !keep.has(id)).slice(0, 5);
        if (!toss.length) toss = r.hand.slice(-1);
        return ok(discardCards(run, toss), 'discard');
      }
      return ok(playHand(run, best.ids), 'play');
    }
    case 'cashout':
    case 'victory':
      return ok(cashOut(run), 'cashout');
    case 'shop': {
      const shop = run.shop!;
      const m = getMods(run);
      const candidates: (() => RunState | null)[] = [];
      shop.items.forEach((it, i) => { if (!it.sold && canAfford(run, shopPrice(run, it))) candidates.push(() => { const r = buyItem(run, 'items', i); return r.error ? null : r.run; }); });
      shop.packs.forEach((it, i) => { if (!it.sold && canAfford(run, shopPrice(run, it))) candidates.push(() => { const r = buyItem(run, 'packs', i); return r.error ? null : r.run; }); });
      if (shop.boon && !shop.boon.sold && canAfford(run, shopPrice(run, shop.boon))) candidates.push(() => { const r = buyItem(run, 'boon', 0); return r.error ? null : r.run; });
      if (run.charms.length >= m.charmSlots && rnd() < 0.2) candidates.push(() => sellCharm(run, run.charms[0].uid).run);
      // Prefer charms when there is room
      const charmIdx = shop.items.findIndex((it) => !it.sold && it.kind === 'charm' && canAfford(run, shopPrice(run, it)) && run.charms.length < m.charmSlots);
      if (charmIdx >= 0 && rnd() < 0.9) {
        const r = buyItem(run, 'items', charmIdx);
        if (!r.error) return r.run;
      }
      if (rnd() < 0.5 && candidates.length) {
        const res = candidates[Math.floor(rnd() * candidates.length)]();
        if (res) return res;
      }
      if (rnd() < 0.15 && canAfford(run, rerollCost(run)) && run.money > 10) return ok(reroll(run), 'reroll');
      return ok(leaveShop(run), 'leave');
    }
    case 'pack': {
      const p = run.pack!;
      if (rnd() < 0.15) return ok(skipPack(run), 'skippack');
      for (let i = 0; i < p.choices.length; i++) {
        if (p.taken.includes(i)) continue;
        const ch = p.choices[i];
        let sel: string[] = [];
        if (ch.kind === 'consumable') {
          const def = CONSUMABLE_MAP[ch.id];
          if (def.select) sel = p.hand.slice(0, def.select[1]);
        }
        const r = pickPackItem(run, i, sel);
        if (!r.error) return r.run;
      }
      return ok(skipPack(run), 'skippack');
    }
    default:
      return run;
  }
}
