import React, { useState } from 'react';
import type { GameStore } from '../store';
import type { Card, Suit } from '../../engine/types';
import { sellCard, sellCardValue } from '../../engine/run';
import { PlayingCard, cardTip } from '../components';
import { useTip } from '../tooltip';
import { SUIT_NAMES, hasRank } from '../../engine/cards';

export function DeckView({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const run = store.run!;
  const tip = useTip();
  const [mode, setMode] = useState<'remaining' | 'full'>(run.round ? 'remaining' : 'full');
  const remaining = new Set(run.round?.drawPile ?? run.deck.map((c) => c.id));
  const canPawn = run.phase === 'shop' && run.shop && !run.shop.cardSoldThisShop;
  const [pawnTarget, setPawnTarget] = useState<string | null>(null);
  const groups: Record<string, Card[]> = { S: [], H: [], C: [], D: [], X: [] };
  for (const c of run.deck) (hasRank(c) ? groups[c.suit] : groups.X).push(c);
  for (const k of Object.keys(groups)) groups[k].sort((a, b) => b.rank - a.rank);
  const counts = { enhanced: run.deck.filter((c) => c.enhancement).length, sealed: run.deck.filter((c) => c.seal).length, editions: run.deck.filter((c) => c.edition).length };
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Deck">
        <button className="btn tiny close" onClick={onClose} aria-label="Close">✕</button>
        <h3>Your deck <small>{run.deck.length} cards · {counts.enhanced} enhanced · {counts.sealed} sealed · {counts.editions} editions</small></h3>
        {run.round && (
          <div className="seg">
            <button className={`chip ${mode === 'remaining' ? 'active' : ''}`} onClick={() => setMode('remaining')}>Remaining ({run.round.drawPile.length})</button>
            <button className={`chip ${mode === 'full' ? 'active' : ''}`} onClick={() => setMode('full')}>Full deck</button>
          </div>
        )}
        {canPawn && <p className="t-hint">Pawn shop: click a card, then sell it for $1–2 (one per shop visit).</p>}
        <div className="deck-groups">
          {(['S', 'H', 'C', 'D', 'X'] as const).map((s) => groups[s].length > 0 && (
            <div key={s} className="deck-group">
              <div className="deck-group-label">{s === 'X' ? 'Monoliths' : SUIT_NAMES[s as Suit]} ({groups[s].length})</div>
              <div className="deck-row">
                {groups[s].map((c) => (
                  <div key={c.id} className="deck-card">
                    <PlayingCard card={c} small dim={mode === 'remaining' && !remaining.has(c.id)} selected={pawnTarget === c.id}
                      onClick={() => canPawn && setPawnTarget(pawnTarget === c.id ? null : c.id)} tipProps={tip(cardTip(c))} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {canPawn && pawnTarget && (
          <button className="btn btn-danger" onClick={() => { const r = store.act(sellCard(run, pawnTarget), 'sell'); if (!r.error) setPawnTarget(null); }}>
            Pawn selected card for ${sellCardValue(run.deck.find((c) => c.id === pawnTarget)!)}
          </button>
        )}
      </div>
    </div>
  );
}
