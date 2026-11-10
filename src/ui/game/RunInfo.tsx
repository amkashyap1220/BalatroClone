import React from 'react';
import type { RunState } from '../../engine/types';
import { HAND_ORDER } from '../../engine/types';
import { HANDS, handBase } from '../../engine/hands';
import { BOON_MAP } from '../../engine/content/boons';
import { TOKEN_MAP } from '../../engine/content/misc';
import { BOSS_MAP } from '../../engine/content/bosses';
import { DECK_MAP } from '../../engine/content/decks';
import { CHALLENGE_MAP } from '../../engine/content/challenges';
import { getMods } from '../../engine/core';
import { Rich } from '../format';

export function RunInfo({ run, onClose }: { run: RunState; onClose: () => void }) {
  const m = getMods(run);
  const ch = run.challengeId ? CHALLENGE_MAP[run.challengeId] : null;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Run info">
        <button className="btn tiny close" onClick={onClose} aria-label="Close">✕</button>
        <h3>Poker hands</h3>
        <table className="hand-table">
          <thead><tr><th>Hand</th><th>Lvl</th><th>Chips × Mult</th><th>Played</th></tr></thead>
          <tbody>
            {[...HAND_ORDER].reverse().filter((h) => h !== 'five' || (run.stats.handCounts.five ?? 0) > 0 || run.handLevels.five > 1).map((h) => {
              const b = handBase(h, run.handLevels[h]);
              return (
                <tr key={h}>
                  <td>{HANDS[h].name}</td>
                  <td className="lvl">{run.handLevels[h]}</td>
                  <td><span className="t-chips">{b.chips}</span> × <span className="t-mult">{b.mult}</span></td>
                  <td>{run.stats.handCounts[h] ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="info-cols">
          <div>
            <h4>Run</h4>
            <p>{DECK_MAP[run.deckId]?.name}{ch && <> · Challenge: <b>{ch.name}</b></>}{run.heat > 0 && <> · Heat {run.heat}</>}</p>
            {ch && <ul className="small">{ch.rules.map((r) => <li key={r}>{r}</li>)}</ul>}
            <p className="small">Seed <code>{run.seed}</code></p>
            <p className="small">Hand size {m.handSize} · Hands {m.hands} · Discards {m.discards} · Interest cap ${m.interestCap}</p>
            <p className="small">Next boss: <b>{BOSS_MAP[run.bossId]?.name}</b> — <Rich text={BOSS_MAP[run.bossId]?.desc ?? ''} /></p>
          </div>
          <div>
            <h4>Boons</h4>
            {run.boons.length ? <ul className="small">{run.boons.map((b) => <li key={b}><b>{BOON_MAP[b].name}</b>: {BOON_MAP[b].desc}</li>)}</ul> : <p className="muted small">None yet.</p>}
            <h4>Pending tokens</h4>
            {run.tokens.length ? <ul className="small">{run.tokens.map((t, i) => <li key={i}><b>{TOKEN_MAP[t]?.name}</b>: {TOKEN_MAP[t]?.desc}</li>)}</ul> : <p className="muted small">None.</p>}
          </div>
        </div>
        {run.log.length > 0 && (<><h4>Recent events</h4><ul className="log small">{run.log.slice(-6).reverse().map((l, i) => <li key={i}>{l}</li>)}</ul></>)}
      </div>
    </div>
  );
}
