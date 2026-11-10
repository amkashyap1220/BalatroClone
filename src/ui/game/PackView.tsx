import React from 'react';
import type { GameStore } from '../store';
import { pickPackItem, skipPack, canPickPack } from '../../engine/run';
import { PACK_MAP } from '../../engine/content/misc';
import { CHARM_MAP } from '../../engine/content/charms';
import { CONSUMABLE_MAP } from '../../engine/content/consumables';
import { useTip } from '../tooltip';
import { CharmArt, ConsumableArt, PlayingCard, charmTip, consumableTip, cardTip } from '../components';

export function PackView({ store, selected, clearSel }: { store: GameStore; selected: string[]; clearSel: () => void }) {
  const run = store.run!;
  const pack = run.pack!;
  const def = PACK_MAP[pack.packId];
  const tip = useTip();
  const pick = (i: number) => {
    const ch = pack.choices[i];
    const res = store.act(pickPackItem(run, i, selected), ch.kind === 'consumable' ? 'use' : 'buy');
    if (!res.error) clearSel();
  };
  return (
    <div className="pack-view">
      <h2 className="stage-title">{def.name}</h2>
      <p className="muted">Choose {pack.picksLeft} more{pack.hand.length ? ' · select cards from the dealt hand for Omens and Hexes' : ''}</p>
      <div className="pack-choices">
        {pack.choices.map((ch, i) => {
          const taken = pack.taken.includes(i);
          const err = taken ? null : canPickPack(run, i, selected);
          let art: React.ReactNode;
          let tp = {};
          if (ch.kind === 'card') { art = <PlayingCard card={ch.card} />; tp = tip(cardTip(ch.card)); }
          else if (ch.kind === 'charm') { const d = CHARM_MAP[ch.id]; art = <CharmArt def={d} edition={ch.edition} />; tp = tip(charmTip(d, { uid: '', id: ch.id, edition: ch.edition, state: { ...(d.init ?? {}) }, sellBonus: 0 }, run)); }
          else { const d = CONSUMABLE_MAP[ch.id]; art = <ConsumableArt def={d} />; tp = tip(consumableTip(d)); }
          return (
            <div key={i} className={`pack-choice ${taken ? 'taken' : ''}`} style={{ ['--i' as string]: i } as React.CSSProperties}>
              <div className="pack-choice-art" {...tp}>{art}</div>
              {!taken && <button className="btn small btn-buy" onClick={() => pick(i)} title={err ?? ''}>{ch.kind === 'consumable' ? 'Use' : 'Take'}</button>}
              {!taken && err && <div className="pick-hint">{err}</div>}
            </div>
          );
        })}
      </div>
      <button className="btn btn-skip" onClick={() => { store.act(skipPack(run), 'skip'); clearSel(); }}>Skip</button>
    </div>
  );
}
