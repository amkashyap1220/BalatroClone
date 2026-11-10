import React, { useState } from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { DECKS } from '../../engine/content/decks';
import { HEATS } from '../../engine/content/misc';
import { ACHIEVEMENT_MAP, isDeckUnlocked } from '../../engine/progression';
import { createRun } from '../../engine/run';

export function DeckBack({ colors, pattern, locked }: { colors: [string, string]; pattern: string; locked?: boolean }) {
  return (
    <div className={`deck-back pat-${pattern} ${locked ? 'locked' : ''}`} style={{ ['--c1' as string]: colors[0], ['--c2' as string]: colors[1] }}>
      <div className="deck-back-emblem">{locked ? '🔒' : 'RF'}</div>
    </div>
  );
}

export function NewRunScreen({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const p = store.profile;
  const [deckId, setDeckId] = useState('ivory');
  const [heat, setHeat] = useState(0);
  const [seed, setSeed] = useState('');
  const deck = DECKS.find((d) => d.id === deckId)!;
  const unlocked = isDeckUnlocked(p, deckId);
  const start = () => {
    if (!unlocked) return;
    if (store.savedRun && !confirm('Starting a new run will abandon your saved run. Continue?')) return;
    if (store.savedRun) store.abandonRun();
    const run = createRun({ deckId, heat, seed: seed.trim() || undefined });
    store.startRun(run);
    store.sfx('deal');
    go('game');
  };
  return (
    <div className="page">
      <header className="page-head">
        <button className="btn btn-back" onClick={() => go('menu')}>← Back</button>
        <h2>Choose your deck</h2>
      </header>
      <div className="deck-grid">
        {DECKS.map((d) => {
          const ok = isDeckUnlocked(p, d.id);
          return (
            <button key={d.id} className={`deck-option ${d.id === deckId ? 'active' : ''} ${ok ? '' : 'locked'}`} onClick={() => { setDeckId(d.id); store.sfx('select'); }}>
              <DeckBack colors={d.colors} pattern={d.pattern} locked={!ok} />
              <span className="deck-label">{ok ? d.name : '???'}</span>
              {p.deckWins[d.id] !== undefined && <span className="deck-won" title="Won with this deck">★</span>}
            </button>
          );
        })}
      </div>
      <section className="deck-detail panel">
        <h3>{unlocked ? deck.name : 'Locked deck'}</h3>
        {unlocked ? (
          <>
            <p className="deck-desc">{deck.desc}</p>
            <p className="deck-strat"><b>Strategy:</b> {deck.strategy}</p>
          </>
        ) : (
          <p className="deck-desc">Unlock by earning the achievement <b>{ACHIEVEMENT_MAP[deck.unlock!]?.name}</b>: {ACHIEVEMENT_MAP[deck.unlock!]?.desc}</p>
        )}
        <div className="heat-row">
          <span className="heat-label">Heat</span>
          {[0, 1, 2, 3, 4, 5].map((h) => (
            <button key={h} className={`heat-pip ${h === heat ? 'active' : ''}`} disabled={h > p.maxHeat} onClick={() => setHeat(h)} title={h === 0 ? 'Standard difficulty' : HEATS[h - 1].name}>
              {h === 0 ? '○' : '🔥'.repeat(1)}{h > 0 && <small>{h}</small>}
            </button>
          ))}
        </div>
        <p className="heat-desc">
          {heat === 0 ? 'Standard rules.' : HEATS.filter((h) => h.level <= heat).map((h) => `${h.name}: ${h.desc}`).join(' ')}
          {p.maxHeat < 5 && <span className="muted"> Win a run on your highest Heat to unlock the next.</span>}
        </p>
        <div className="seed-row">
          <label htmlFor="seed">Seed (optional)</label>
          <input id="seed" value={seed} maxLength={12} onChange={(e) => setSeed(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="Random" />
        </div>
        <button className="btn btn-big btn-play" disabled={!unlocked} onClick={start}>Start Run</button>
      </section>
    </div>
  );
}
