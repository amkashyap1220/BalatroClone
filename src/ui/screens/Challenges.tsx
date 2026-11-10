import React from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { CHALLENGES } from '../../engine/content/challenges';
import { ACHIEVEMENT_MAP, CHALLENGE_UNLOCKS, isChallengeUnlocked } from '../../engine/progression';
import { createRun } from '../../engine/run';

export function ChallengesScreen({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const p = store.profile;
  const start = (id: string) => {
    if (store.savedRun && !confirm('Starting a challenge will abandon your saved run. Continue?')) return;
    if (store.savedRun) store.abandonRun();
    store.startRun(createRun({ challengeId: id }));
    store.sfx('deal');
    go('game');
  };
  return (
    <div className="page">
      <header className="page-head">
        <button className="btn btn-back" onClick={() => go('menu')}>← Back</button>
        <h2>Challenges <small>{p.challengesDone.length}/{CHALLENGES.length} complete</small></h2>
      </header>
      <div className="challenge-grid">
        {CHALLENGES.map((c, i) => {
          const ok = isChallengeUnlocked(p, c.id);
          const done = p.challengesDone.includes(c.id);
          const req = CHALLENGE_UNLOCKS[c.id];
          return (
            <div key={c.id} className={`challenge panel ${ok ? '' : 'locked'} ${done ? 'done' : ''}`}>
              <div className="challenge-num">{String(i + 1).padStart(2, '0')}</div>
              <h3>{ok ? c.name : 'Locked'} {done && <span className="done-badge">✓ Complete</span>}</h3>
              {ok ? (
                <>
                  <p className="muted">{c.desc}</p>
                  <ul>{c.rules.map((r) => <li key={r}>{r}</li>)}</ul>
                  <p className="goal">Goal: defeat the Ante {c.winAnte ?? 8} Boss.</p>
                  <button className="btn btn-play" onClick={() => start(c.id)}>Start</button>
                </>
              ) : (
                <p className="muted">Unlock with “{ACHIEVEMENT_MAP[req]?.name}”: {ACHIEVEMENT_MAP[req]?.desc}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
