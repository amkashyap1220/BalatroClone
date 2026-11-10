// Meta progression: lifetime statistics, discovery, achievements and unlocks.
import type { HandType, RunState, ScoreResult } from './types';
import { HAND_ORDER } from './types';
import { CHARMS, CHARM_MAP } from './content/charms';
import { CONSUMABLES } from './content/consumables';
import { BOSSES } from './content/bosses';
import { DECKS } from './content/decks';
import { CHALLENGES } from './content/challenges';
import { BOONS } from './content/boons';
import { findCard } from './core';

export const PROFILE_VERSION = 1;

export interface LifetimeStats {
  runs: number;
  wins: number;
  losses: number;
  highestAnte: number;
  bestHand: number;
  bestHandType: HandType | null;
  handCounts: Partial<Record<HandType, number>>;
  handsPlayed: number;
  moneyEarned: number;
  cardsPlayed: number;
  charmsBought: number;
  consumablesUsed: number;
  bossesDefeated: number;
  rerolls: number;
  cardsDestroyed: number;
  blindsSkipped: number;
  mostMoney: number;
}

export interface Profile {
  version: number;
  name: string;
  created: number;
  stats: LifetimeStats;
  discovered: string[];
  achievements: string[];
  challengesDone: string[];
  deckWins: Record<string, number>;
  maxHeat: number;
  /** Run ids already counted, so a run is never recorded twice. */
  recordedRuns: string[];
}

export function newProfile(): Profile {
  return {
    version: PROFILE_VERSION,
    name: 'Player',
    created: Date.now(),
    stats: {
      runs: 0, wins: 0, losses: 0, highestAnte: 0, bestHand: 0, bestHandType: null, handCounts: {}, handsPlayed: 0,
      moneyEarned: 0, cardsPlayed: 0, charmsBought: 0, consumablesUsed: 0, bossesDefeated: 0, rerolls: 0,
      cardsDestroyed: 0, blindsSkipped: 0, mostMoney: 0,
    },
    discovered: [],
    achievements: [],
    challengesDone: [],
    deckWins: {},
    maxHeat: 0,
    recordedRuns: [],
  };
}

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  /** Checked against the profile and (optionally) the active run. */
  check?: (p: Profile, run: RunState | null) => boolean;
}

const runOwns = (run: RunState | null, pred: (id: string, ed: string | null) => boolean) => !!run && run.charms.some((c) => pred(c.id, c.edition));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first', name: 'Shuffle Up', desc: 'Play your first hand.', check: (p) => p.stats.handsPlayed >= 1 },
  { id: 'ach_ante4', name: 'Rising Stakes', desc: 'Reach Ante 4.', check: (p, r) => p.stats.highestAnte >= 4 || (r?.ante ?? 0) >= 4 },
  { id: 'ach_ante6', name: 'High Roller', desc: 'Reach Ante 6.', check: (p, r) => p.stats.highestAnte >= 6 || (r?.ante ?? 0) >= 6 },
  { id: 'ach_win', name: 'House Edge', desc: 'Win a run by beating Ante 8.', check: (p) => p.stats.wins >= 1 },
  { id: 'ach_ante8_twice', name: 'Repeat Offender', desc: 'Win 2 runs.', check: (p) => p.stats.wins >= 2 },
  { id: 'ach_endless', name: 'Into the Endless', desc: 'Reach Ante 10.', check: (p, r) => p.stats.highestAnte >= 10 || (r?.ante ?? 0) >= 10 },
  { id: 'ach_endless12', name: 'No Limit', desc: 'Reach Ante 12.', check: (p, r) => p.stats.highestAnte >= 12 || (r?.ante ?? 0) >= 12 },
  { id: 'ach_flush', name: 'Flushed', desc: 'Play a Flush.', check: (p) => (p.stats.handCounts.flush ?? 0) >= 1 },
  { id: 'ach_faces', name: 'Four of a Feather', desc: 'Play a Four of a Kind.', check: (p) => (p.stats.handCounts.four ?? 0) >= 1 },
  { id: 'ach_royal', name: 'Long Live the King', desc: 'Play a Royal Flush.', check: (p) => (p.stats.handCounts.royal ?? 0) >= 1 },
  { id: 'ach_five', name: 'Impossible Hand', desc: 'Play a Five of a Kind.', check: (p) => (p.stats.handCounts.five ?? 0) >= 1 },
  { id: 'ach_pairs', name: 'Pair Programming', desc: 'Play 50 hands containing a Pair as their type.', check: (p) => (p.stats.handCounts.pair ?? 0) >= 50 },
  { id: 'ach_hands100', name: 'Seasoned Player', desc: 'Play 100 hands in total.', check: (p) => p.stats.handsPlayed >= 100 },
  { id: 'ach_rich', name: 'Deep Pockets', desc: 'Hold $50 at once.', check: (p, r) => p.stats.mostMoney >= 50 || (r?.money ?? 0) >= 50 },
  { id: 'ach_money100', name: 'Whale', desc: 'Hold $100 at once.', check: (p, r) => p.stats.mostMoney >= 100 || (r?.money ?? 0) >= 100 },
  { id: 'ach_charms5', name: 'Full House Party', desc: 'Own 5 charms at once.', check: (_p, r) => (r?.charms.length ?? 0) >= 5 },
  { id: 'ach_rares', name: 'Rare Taste', desc: 'Own 2 Rare charms at once.', check: (_p, r) => (r?.charms.filter((c) => CHARM_MAP[c.id]?.rarity === 'rare').length ?? 0) >= 2 },
  { id: 'ach_legend', name: 'Living Legend', desc: 'Own a Legendary charm.', check: (_p, r) => runOwns(r, (id) => CHARM_MAP[id]?.rarity === 'legendary') },
  { id: 'ach_editions', name: 'Collector’s Edition', desc: 'Own a Spectrum charm.', check: (_p, r) => runOwns(r, (_id, ed) => ed === 'spectrum') },
  { id: 'ach_boss5', name: 'Warden Breaker', desc: 'Defeat 5 Boss blinds in total.', check: (p) => p.stats.bossesDefeated >= 5 },
  { id: 'ach_boss10', name: 'Warden Bane', desc: 'Defeat 15 Boss blinds in total.', check: (p) => p.stats.bossesDefeated >= 15 },
  { id: 'ach_score100k', name: 'Six Figures', desc: 'Score 100,000 in a single hand.', check: (p) => p.stats.bestHand >= 100000 },
  { id: 'ach_score1m', name: 'Seven Figures', desc: 'Score 1,000,000 in a single hand.', check: (p) => p.stats.bestHand >= 1000000 },
  { id: 'ach_destroy10', name: 'Demolition', desc: 'Destroy 10 playing cards in one run.', check: (_p, r) => (r?.stats.cardsDestroyed ?? 0) >= 10 },
  { id: 'ach_enhance10', name: 'Artisan', desc: 'Have 10 enhanced cards in your deck.', check: (_p, r) => (r?.deck.filter((c) => c.enhancement).length ?? 0) >= 10 },
  { id: 'ach_stars10', name: 'Stargazer', desc: 'Use 10 Stars in one run.', check: (_p, r) => (r?.stats.starsUsed ?? 0) >= 10 },
  { id: 'ach_skip5', name: 'Fast Forward', desc: 'Skip 5 blinds in one run.', check: (_p, r) => (r?.stats.blindsSkipped ?? 0) >= 5 },
  { id: 'ach_hearts', name: 'Heartfelt', desc: 'Play a Flush made entirely of Hearts.' },
  { id: 'ach_kings', name: 'Court of Kings', desc: 'Play a hand with 3 or more Kings scoring.' },
  { id: 'ach_aces', name: 'Ace Up the Sleeve', desc: 'Play Four of a Kind with Aces.' },
  { id: 'ach_challenge', name: 'Challenger', desc: 'Complete any challenge.', check: (p) => p.challengesDone.length >= 1 },
  { id: 'ach_heat', name: 'Feel the Heat', desc: 'Win a run on Heat 1 or higher.' },
  { id: 'ach_decks', name: 'Deck Master', desc: 'Win with 3 different decks.', check: (p) => Object.keys(p.deckWins).length >= 3 },
];
export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));

export const CHALLENGE_UNLOCKS: Record<string, string> = {
  speedrun: 'ach_win', gauntlet: 'ach_ante6', minimalist: 'ach_charms5', cosmic: 'ach_stars10', club_ban: 'ach_ante4', inflation: 'ach_rich',
};

export function isDeckUnlocked(p: Profile, deckId: string): boolean {
  const d = DECKS.find((x) => x.id === deckId);
  return !!d && (!d.unlock || p.achievements.includes(d.unlock));
}
export function isChallengeUnlocked(p: Profile, id: string): boolean {
  const req = CHALLENGE_UNLOCKS[id];
  return !req || p.achievements.includes(req);
}
export function unlockedCharmIds(p: Profile): Set<string> {
  return new Set(CHARMS.filter((c) => !c.unlock || p.achievements.includes(c.unlock)).map((c) => c.id));
}

/** Mark everything currently visible in the run as discovered. */
export function discoverFromRun(p: Profile, run: RunState): string[] {
  const seen = new Set(p.discovered);
  const added: string[] = [];
  const add = (id: string | null | undefined) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      added.push(id);
    }
  };
  run.charms.forEach((c) => add(c.id));
  run.consumables.forEach((c) => add(c.id));
  run.boons.forEach(add);
  add(run.deckId);
  if (run.round?.bossId) add(run.round.bossId);
  if (run.phase === 'blindSelect') add(run.bossId);
  run.shop?.items.forEach((i) => i.kind !== 'card' && add(i.id));
  if (run.shop?.boon) add(run.shop.boon.id);
  run.pack?.choices.forEach((c) => c.kind !== 'card' && add(c.id));
  p.discovered.push(...added);
  return added;
}

/** Called after every scored hand to update lifetime stats and hand-based achievements. */
export function recordHand(p: Profile, run: RunState, res: ScoreResult): string[] {
  p.stats.handsPlayed++;
  p.stats.handCounts[res.hand] = (p.stats.handCounts[res.hand] ?? 0) + 1;
  if (res.total > p.stats.bestHand) {
    p.stats.bestHand = res.total;
    p.stats.bestHandType = res.hand;
  }
  const unlocked: string[] = [];
  const grant = (id: string) => {
    if (!p.achievements.includes(id)) {
      p.achievements.push(id);
      unlocked.push(id);
    }
  };
  const scoring = res.scoringIds.map((id) => findCard(run, id)).filter((c) => !!c);
  if ((res.hand === 'flush' || res.hand === 'sflush' || res.hand === 'royal') && scoring.length && scoring.every((c) => c!.suit === 'H')) grant('ach_hearts');
  if (scoring.filter((c) => c!.rank === 13 && c!.enhancement !== 'monolith').length >= 3) grant('ach_kings');
  if (res.hand === 'four' && scoring.filter((c) => c!.rank === 14).length >= 4) grant('ach_aces');
  return unlocked;
}

/** Re-evaluate checkable achievements. Returns newly unlocked achievement ids. */
export function checkAchievements(p: Profile, run: RunState | null): string[] {
  if (run) {
    p.stats.mostMoney = Math.max(p.stats.mostMoney, run.money);
    p.stats.highestAnte = Math.max(p.stats.highestAnte, run.ante);
  }
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (p.achievements.includes(a.id) || !a.check) continue;
    if (a.check(p, run)) {
      p.achievements.push(a.id);
      out.push(a.id);
    }
  }
  return out;
}

export function runKey(run: RunState): string {
  return `${run.seed}:${run.deckId}:${run.challengeId ?? ''}`;
}

/** Record a finished run (victory or defeat). Safe to call more than once per run. */
export function recordRunEnd(p: Profile, run: RunState, outcome: 'win' | 'loss' | 'abandon'): string[] {
  const key = `${runKey(run)}:${outcome}`;
  if (p.recordedRuns.includes(key)) return [];
  p.recordedRuns.push(key);
  if (p.recordedRuns.length > 200) p.recordedRuns.splice(0, p.recordedRuns.length - 200);
  const s = p.stats;
  const winOnly = outcome === 'win';
  // A run that was won and then ends in endless mode was already counted at its victory.
  if (!(outcome !== 'win' && run.won)) {
    s.runs++;
    s.moneyEarned += run.stats.moneyEarned;
    s.cardsPlayed += run.stats.cardsPlayed;
    s.charmsBought += run.stats.charmsBought;
    s.consumablesUsed += run.stats.consumablesUsed;
    s.bossesDefeated += run.stats.bossesDefeated;
    s.rerolls += run.stats.rerolls;
    s.cardsDestroyed += run.stats.cardsDestroyed;
    s.blindsSkipped += run.stats.blindsSkipped;
  }
  if (outcome === 'loss' && !run.won) s.losses++;
  s.highestAnte = Math.max(s.highestAnte, run.ante);
  const unlocked: string[] = [];
  if (winOnly) {
    s.wins++;
    p.deckWins[run.deckId] = Math.max(p.deckWins[run.deckId] ?? -1, run.heat);
    if (!run.challengeId && run.heat >= p.maxHeat && p.maxHeat < 5) p.maxHeat = run.heat + 1;
    if (run.challengeId && !p.challengesDone.includes(run.challengeId)) p.challengesDone.push(run.challengeId);
    if (run.heat >= 1 && !p.achievements.includes('ach_heat')) {
      p.achievements.push('ach_heat');
      unlocked.push('ach_heat');
    }
  }
  unlocked.push(...checkAchievements(p, run));
  return unlocked;
}

export interface CollectionEntry {
  id: string;
  category: 'charm' | 'omen' | 'star' | 'hex' | 'boss' | 'deck' | 'boon' | 'challenge';
  name: string;
}

export function allCollectibles(): CollectionEntry[] {
  return [
    ...CHARMS.map((c) => ({ id: c.id, category: 'charm' as const, name: c.name })),
    ...CONSUMABLES.map((c) => ({ id: c.id, category: c.kind, name: c.name })),
    ...BOSSES.map((b) => ({ id: b.id, category: 'boss' as const, name: b.name })),
    ...DECKS.map((d) => ({ id: d.id, category: 'deck' as const, name: d.name })),
    ...BOONS.map((b) => ({ id: b.id, category: 'boon' as const, name: b.name })),
  ];
}

export function collectionProgress(p: Profile): { found: number; total: number } {
  const all = allCollectibles();
  const set = new Set(p.discovered);
  return { found: all.filter((e) => set.has(e.id)).length, total: all.length };
}

export function favoriteHand(p: Profile): HandType | null {
  let best: HandType | null = null;
  let n = 0;
  for (const h of HAND_ORDER) {
    const c = p.stats.handCounts[h] ?? 0;
    if (c > n) {
      n = c;
      best = h;
    }
  }
  return best;
}

export { CHALLENGES };
