import React from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { cashOut } from '../../engine/run';
import { HANDS } from '../../engine/hands';
import { BOSS_MAP } from '../../engine/content/bosses';
import { fmt } from '../format';
import { Confetti } from './fx';
import { createRun } from '../../engine/run';

export function EndOverlay({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const run = store.run!;
  const win = run.phase === 'victory';
  const s = run.stats;
  const rows: [string, React.ReactNode][] = [
    ['Ante reached', run.ante], ['Best hand', <>{fmt(s.bestHand)}{s.bestHandType && <small className="muted"> {HANDS[s.bestHandType].name}</small>}</>],
    ['Hands played', s.handsPlayed], ['Charms bought', s.charmsBought], ['Bosses defeated', s.bossesDefeated], ['Money earned', `$${s.moneyEarned}`],
    ['Seed', <code>{run.seed}</code>],
  ];
  return (
    <div className="end-overlay">
      {win && <Confetti />}
      <div className={`end-panel panel ${win ? 'win' : 'lose'}`} role="dialog" aria-label={win ? 'Victory' : 'Defeat'}>
        <h1>{win ? 'Victory!' : 'Busted'}</h1>
        <p className="muted">
          {win ? `You beat Ante ${run.ante}. The house has fallen... for now.` : run.round?.bossId ? `Defeated by ${BOSS_MAP[run.round.bossId].name}.` : `Your luck ran out on Ante ${run.ante}.`}
          {!win && run.round && <> Scored {fmt(run.defeatScore)} of {fmt(run.round.target)}.</>}
        </p>
        <dl className="stat-list">{rows.map(([k, v]) => (<React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>))}</dl>
        <div className="end-buttons">
          {win && <button className="btn btn-big btn-play" onClick={() => store.act(cashOut(run), 'money')}>Continue in Endless Mode</button>}
          <button className="btn btn-big" onClick={() => {
            const fresh = createRun({ deckId: run.deckId, heat: run.heat, challengeId: run.challengeId });
            store.abandonRun();
            store.startRun(fresh);
          }}>New Run (same deck)</button>
          <button className="btn" onClick={() => { if (win) store.abandonRun(); else store.quitToMenu(); go('menu'); }}>Main Menu</button>
        </div>
      </div>
    </div>
  );
}
