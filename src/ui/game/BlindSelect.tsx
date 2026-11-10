import React from 'react';
import type { GameStore } from '../store';
import { selectBlind, skipBlind, upcomingBlinds, BLIND_NAMES } from '../../engine/run';
import { BOSS_MAP } from '../../engine/content/bosses';
import { TOKEN_MAP } from '../../engine/content/misc';
import { BossToken, TokenChip, bossTip, tokenTip } from '../components';
import { useTip } from '../tooltip';
import { fmt, Rich } from '../format';

export function BlindSelect({ store }: { store: GameStore }) {
  const run = store.run!;
  const tip = useTip();
  const blinds = upcomingBlinds(run);
  return (
    <div className="blind-select">
      <h2 className="stage-title">Ante {run.ante}</h2>
      <div className="blind-cards">
        {blinds.map((b) => {
          const boss = b.bossId ? BOSS_MAP[b.bossId] : null;
          const current = b.state === 'current';
          return (
            <div key={b.index} className={`blind-card ${b.type} ${b.state}`}>
              <div className="blind-card-head">{boss ? boss.name : BLIND_NAMES[b.type]}</div>
              <div className="blind-card-art" {...(boss ? tip(bossTip(boss.id)) : {})}>
                {boss ? <BossToken id={boss.id} size={84} spin={current} /> : <div className={`blind-chip big chip-${b.type}`}>{b.type === 'small' ? 'S' : 'B'}</div>}
              </div>
              {boss && <p className="blind-desc"><Rich text={boss.desc} /></p>}
              <div className="blind-target"><span className="muted small">Score at least</span><b>{fmt(b.target)}</b></div>
              <div className="blind-reward">Reward: <span className="t-money">{b.reward ? '$'.repeat(Math.min(b.reward, 8)) : 'none'}</span></div>
              {current ? (
                <button className="btn btn-play" onClick={() => store.act(selectBlind(run), 'deal')}>Select</button>
              ) : (
                <div className="blind-state">{b.state === 'done' ? 'Done' : 'Upcoming'}</div>
              )}
              {b.token && b.state !== 'done' && (
                <div className="skip-box">
                  <div {...tip(tokenTip(b.token))}><TokenChip id={b.token} size={40} /></div>
                  <div className="skip-text"><b>{TOKEN_MAP[b.token]?.name}</b><small>{TOKEN_MAP[b.token]?.desc}</small></div>
                  {current && <button className="btn small btn-skip" onClick={() => store.act(skipBlind(run), 'skip')}>Skip</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
