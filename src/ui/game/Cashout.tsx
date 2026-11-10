import React from 'react';
import type { GameStore } from '../store';
import { cashOut, cashoutTotal } from '../../engine/run';

export function Cashout({ store }: { store: GameStore }) {
  const run = store.run!;
  const lines = run.cashout ?? [];
  const total = cashoutTotal(run);
  return (
    <div className="cashout panel">
      <h2 className="stage-title">Blind defeated!</h2>
      {run.round && <p className="muted">Scored {run.round.score.toLocaleString()} / {run.round.target.toLocaleString()}</p>}
      <ul className="cash-lines">
        {lines.map((l, i) => (
          <li key={i} style={{ ['--i' as string]: i } as React.CSSProperties}>
            <span>{l.label}</span>
            <b className={l.amount < 0 ? 't-mult' : 't-money'}>{l.amount < 0 ? '-' : ''}${Math.abs(l.amount)}</b>
          </li>
        ))}
      </ul>
      <button className="btn btn-big btn-cash" onClick={() => store.act(cashOut(run), 'money')}>
        Cash out <span className="t-money">{total < 0 ? '-' : ''}${Math.abs(total)}</span>
      </button>
    </div>
  );
}
