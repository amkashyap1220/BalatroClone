import React from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { collectionProgress } from '../../engine/progression';
import { DECK_MAP } from '../../engine/content/decks';
import { PlayingCard } from '../components';
import type { Card } from '../../engine/types';

const DEMO: Card[] = [
  { id: 'd1', rank: 14, suit: 'S', enhancement: null, edition: 'spectrum', seal: null, bonusChips: 0, bonusMult: 0 },
  { id: 'd2', rank: 13, suit: 'H', enhancement: null, edition: null, seal: 'ruby', bonusChips: 0, bonusMult: 0 },
  { id: 'd3', rank: 12, suit: 'D', enhancement: 'treasure', edition: null, seal: null, bonusChips: 0, bonusMult: 0 },
  { id: 'd4', rank: 11, suit: 'C', enhancement: null, edition: 'shimmer', seal: null, bonusChips: 0, bonusMult: 0 },
  { id: 'd5', rank: 10, suit: 'H', enhancement: 'crystal', edition: null, seal: null, bonusChips: 0, bonusMult: 0 },
];

export function MainMenu({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const p = store.profile;
  const col = collectionProgress(p);
  const saved = store.savedRun;
  return (
    <div className="menu-screen">
      <div className="menu-fan" aria-hidden>
        {DEMO.map((c, i) => (
          <PlayingCard key={c.id} card={c} className="menu-fan-card" style={{ ['--i' as string]: i - 2 } as React.CSSProperties} />
        ))}
      </div>
      <h1 className="logo">
        <span className="logo-royal">ROYAL</span>
        <span className="logo-flux">FLUX</span>
      </h1>
      <p className="tagline">A poker roguelike of chips, charms and calculated risk</p>
      <nav className="menu-buttons">
        <button className="btn btn-big btn-play" onClick={() => go('newRun')}>Play</button>
        <button className="btn btn-big btn-continue" disabled={!saved} onClick={() => { if (store.continueRun()) go('game'); }}>
          Continue{saved && <small>Ante {saved.ante} · {DECK_MAP[saved.deckId]?.name} · ${saved.money}</small>}
        </button>
        <div className="menu-row">
          <button className="btn" onClick={() => go('challenges')}>Challenges</button>
          <button className="btn" onClick={() => go('collection')}>Collection</button>
        </div>
        <div className="menu-row">
          <button className="btn" onClick={() => go('stats')}>Statistics</button>
          <button className="btn" onClick={() => go('settings')}>Settings</button>
        </div>
      </nav>
      <div className="menu-profile">
        <span>Wins <b>{p.stats.wins}</b></span>
        <span>Best Ante <b>{p.stats.highestAnte}</b></span>
        <span>Collection <b>{col.found}/{col.total}</b></span>
        <span>Achievements <b>{p.achievements.length}</b></span>
      </div>
      <footer className="menu-foot">Original game · synthesized audio · progress saves automatically</footer>
    </div>
  );
}
