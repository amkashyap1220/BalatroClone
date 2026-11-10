import React from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { ACHIEVEMENTS, collectionProgress, favoriteHand } from '../../engine/progression';
import { HANDS } from '../../engine/hands';
import { HAND_ORDER } from '../../engine/types';
import { fmt } from '../format';

export function StatsScreen({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const p = store.profile;
  const s = p.stats;
  const col = collectionProgress(p);
  const fav = favoriteHand(p);
  const rows: [string, React.ReactNode][] = [
    ['Runs played', s.runs], ['Wins', s.wins], ['Losses', s.losses],
    ['Win rate', s.runs ? `${Math.round((s.wins / s.runs) * 100)}%` : '—'],
    ['Highest ante', s.highestAnte], ['Best single hand', <>{fmt(s.bestHand)} {s.bestHandType && <small className="muted">({HANDS[s.bestHandType].name})</small>}</>],
    ['Favourite hand', fav ? HANDS[fav].name : '—'], ['Hands played', s.handsPlayed], ['Cards played', s.cardsPlayed],
    ['Money earned', `$${fmt(s.moneyEarned)}`], ['Most money held', `$${s.mostMoney}`], ['Charms bought', s.charmsBought],
    ['Consumables used', s.consumablesUsed], ['Bosses defeated', s.bossesDefeated], ['Blinds skipped', s.blindsSkipped],
    ['Shop rerolls', s.rerolls], ['Cards destroyed', s.cardsDestroyed], ['Collection', `${col.found}/${col.total} (${Math.round((col.found / col.total) * 100)}%)`],
    ['Challenges complete', p.challengesDone.length], ['Heat unlocked', p.maxHeat],
  ];
  const maxCount = Math.max(1, ...HAND_ORDER.map((h) => s.handCounts[h] ?? 0));
  return (
    <div className="page">
      <header className="page-head">
        <button className="btn btn-back" onClick={() => go('menu')}>← Back</button>
        <h2>Statistics</h2>
      </header>
      <div className="stats-layout">
        <section className="panel">
          <h3>Lifetime</h3>
          <dl className="stat-list">{rows.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}</dl>
        </section>
        <section className="panel">
          <h3>Most played hands</h3>
          <div className="bars">
            {HAND_ORDER.map((h) => (
              <div key={h} className="bar-row">
                <span>{HANDS[h].name}</span>
                <div className="bar"><i style={{ width: `${((s.handCounts[h] ?? 0) / maxCount) * 100}%` }} /></div>
                <b>{s.handCounts[h] ?? 0}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel span2">
          <h3>Achievements <small>{p.achievements.length}/{ACHIEVEMENTS.length}</small></h3>
          <div className="ach-grid">
            {ACHIEVEMENTS.map((a) => {
              const got = p.achievements.includes(a.id);
              return (
                <div key={a.id} className={`ach ${got ? 'got' : ''}`}>
                  <span className="ach-icon">{got ? '🏆' : '🔒'}</span>
                  <div><b>{a.name}</b><small>{a.desc}</small></div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
