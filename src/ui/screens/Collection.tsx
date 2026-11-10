import React, { useMemo, useState } from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import { CHARMS } from '../../engine/content/charms';
import { OMENS, STARS, HEXES } from '../../engine/content/consumables';
import { BOSSES } from '../../engine/content/bosses';
import { DECKS } from '../../engine/content/decks';
import { BOONS } from '../../engine/content/boons';
import { ENHANCEMENTS, EDITIONS, SEALS } from '../../engine/content/modifications';
import { ACHIEVEMENT_MAP } from '../../engine/progression';
import { HANDS } from '../../engine/hands';
import { useTip } from '../tooltip';
import { BoonArt, BossToken, CharmArt, ConsumableArt, PlayingCard, RARITY_COLOR, boonTip, bossTip, charmTip, consumableTip } from '../components';
import { Rich } from '../format';
import { DeckBack } from './NewRun';
import type { Card } from '../../engine/types';

type Tab = 'charms' | 'omens' | 'stars' | 'hexes' | 'bosses' | 'decks' | 'boons' | 'cards';
const TABS: [Tab, string][] = [['charms', 'Charms'], ['omens', 'Omens'], ['stars', 'Stars'], ['hexes', 'Hexes'], ['bosses', 'Bosses'], ['decks', 'Decks'], ['boons', 'Boons'], ['cards', 'Card Mods']];

export function CollectionScreen({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const [tab, setTab] = useState<Tab>('charms');
  const [q, setQ] = useState('');
  const [rarity, setRarity] = useState<string>('all');
  const [showAll, setShowAll] = useState(false);
  const tip = useTip();
  const seen = useMemo(() => new Set(store.profile.discovered), [store.profile.discovered]);
  const ach = new Set(store.profile.achievements);
  const match = (name: string, desc: string) => !q || (name + ' ' + desc).toLowerCase().includes(q.toLowerCase());
  const known = (id: string) => showAll || seen.has(id);

  const counts: Record<Tab, [number, number]> = {
    charms: [CHARMS.filter((c) => seen.has(c.id)).length, CHARMS.length],
    omens: [OMENS.filter((c) => seen.has(c.id)).length, OMENS.length],
    stars: [STARS.filter((c) => seen.has(c.id)).length, STARS.length],
    hexes: [HEXES.filter((c) => seen.has(c.id)).length, HEXES.length],
    bosses: [BOSSES.filter((c) => seen.has(c.id)).length, BOSSES.length],
    decks: [DECKS.filter((c) => seen.has(c.id)).length, DECKS.length],
    boons: [BOONS.filter((c) => seen.has(c.id)).length, BOONS.length],
    cards: [0, 0],
  };

  const Unknown = ({ label }: { label?: string }) => <div className="unknown-card"><span>?</span>{label && <small>{label}</small>}</div>;

  let body: React.ReactNode = null;
  if (tab === 'charms') {
    const list = CHARMS.filter((c) => (rarity === 'all' || c.rarity === rarity) && (known(c.id) ? match(c.name, c.desc + ' ' + c.tags.join(' ')) : !q));
    body = (
      <div className="coll-grid">
        {list.map((c) => {
          const locked = c.unlock && !ach.has(c.unlock);
          return known(c.id) ? (
            <div key={c.id} className="coll-item" tabIndex={0} {...tip(charmTip(c, null, null, locked ? <div className="t-hint">🔒 Unlock: {ACHIEVEMENT_MAP[c.unlock!]?.desc}</div> : undefined))}>
              <CharmArt def={c} />
            </div>
          ) : (
            <div key={c.id} className="coll-item" tabIndex={0} {...tip({ title: 'Undiscovered charm', accent: RARITY_COLOR[c.rarity], body: locked ? `🔒 ${ACHIEVEMENT_MAP[c.unlock!]?.desc}` : 'Find it in the shop or a pack.', tags: [{ label: c.rarity.toUpperCase(), color: RARITY_COLOR[c.rarity] }] })}>
              <Unknown label={locked ? '🔒' : undefined} />
            </div>
          );
        })}
      </div>
    );
  } else if (tab === 'omens' || tab === 'stars' || tab === 'hexes') {
    const src = tab === 'omens' ? OMENS : tab === 'stars' ? STARS : HEXES;
    body = (
      <div className="coll-grid">
        {src.filter((c) => (known(c.id) ? match(c.name, c.desc) : !q)).map((c) => (
          <div key={c.id} className="coll-item" tabIndex={0} {...tip(known(c.id) ? consumableTip(c, c.hand ? <div className="t-hint">Upgrades {HANDS[c.hand].name}</div> : undefined) : { title: 'Undiscovered', body: 'Not yet found.' })}>
            {known(c.id) ? <ConsumableArt def={c} /> : <Unknown />}
          </div>
        ))}
      </div>
    );
  } else if (tab === 'bosses') {
    body = (
      <div className="boss-list">
        {BOSSES.filter((b) => (known(b.id) ? match(b.name, b.desc) : !q)).map((b) => (
          <div key={b.id} className="boss-row panel" tabIndex={0} {...(known(b.id) ? tip(bossTip(b.id)) : {})}>
            {known(b.id) ? <BossToken id={b.id} size={56} /> : <div className="boss-token unknown" style={{ width: 56, height: 56 }}>?</div>}
            <div>
              <h4>{known(b.id) ? b.name : 'Unknown Warden'} {b.finale && <span className="tag" style={{ background: '#7a1f2b' }}>FINALE</span>}</h4>
              <p className="muted">{known(b.id) ? <Rich text={b.desc} /> : `Appears from Ante ${b.minAnte}.`}</p>
            </div>
          </div>
        ))}
      </div>
    );
  } else if (tab === 'decks') {
    body = (
      <div className="boss-list">
        {DECKS.filter((d) => match(d.name, d.desc)).map((d) => (
          <div key={d.id} className="boss-row panel">
            <div style={{ width: 56 }}><DeckBack colors={d.colors} pattern={d.pattern} locked={!!d.unlock && !ach.has(d.unlock)} /></div>
            <div>
              <h4>{d.name} {store.profile.deckWins[d.id] !== undefined && <span className="t-money">★ won</span>}</h4>
              <p className="muted">{d.desc}</p>
              {d.unlock && !ach.has(d.unlock) && <p className="t-hint">🔒 {ACHIEVEMENT_MAP[d.unlock]?.desc}</p>}
            </div>
          </div>
        ))}
      </div>
    );
  } else if (tab === 'boons') {
    body = (
      <div className="coll-grid">
        {BOONS.filter((b) => (known(b.id) ? match(b.name, b.desc) : !q)).map((b) => (
          <div key={b.id} className="coll-item" tabIndex={0} {...tip(known(b.id) ? boonTip(b.id) : { title: 'Undiscovered boon', body: 'Boons appear in the shop once per ante.' })}>
            {known(b.id) ? <BoonArt id={b.id} /> : <Unknown />}
          </div>
        ))}
      </div>
    );
  } else {
    const base: Card = { id: 'x', rank: 13, suit: 'S', enhancement: null, edition: null, seal: null, bonusChips: 0, bonusMult: 0 };
    body = (
      <div className="mods-ref">
        <h3>Enhancements</h3>
        <div className="mods-row">{Object.values(ENHANCEMENTS).filter((e) => match(e.name, e.desc)).map((e) => (
          <div key={e.id} className="mod-cell"><PlayingCard card={{ ...base, id: e.id, enhancement: e.id }} small /><b style={{ color: e.color }}>{e.name}</b><span><Rich text={e.desc} /></span></div>
        ))}</div>
        <h3>Editions</h3>
        <div className="mods-row">{Object.values(EDITIONS).filter((e) => match(e.name, e.cardDesc)).map((e) => (
          <div key={e.id} className="mod-cell"><PlayingCard card={{ ...base, id: e.id, edition: e.id }} small /><b className="t-edition">{e.name}</b><span>Card: <Rich text={e.cardDesc} />{e.forCharms && <><br />Charm: <Rich text={e.charmDesc} /></>}</span></div>
        ))}</div>
        <h3>Seals</h3>
        <div className="mods-row">{Object.values(SEALS).filter((e) => match(e.name, e.desc)).map((e) => (
          <div key={e.id} className="mod-cell"><PlayingCard card={{ ...base, id: e.id, seal: e.id }} small /><b style={{ color: e.color }}>{e.name}</b><span><Rich text={e.desc} /></span></div>
        ))}</div>
        <h3>Poker hands</h3>
        <table className="hand-table"><thead><tr><th>Hand</th><th>Base</th><th>Per level</th><th>Description</th></tr></thead><tbody>
          {Object.entries(HANDS).map(([k, h]) => (<tr key={k}><td>{h.name}</td><td><span className="t-chips">{h.chips}</span> × <span className="t-mult">{h.mult}</span></td><td>+{h.lvlChips} / +{h.lvlMult}</td><td className="muted">{h.desc}</td></tr>))}
        </tbody></table>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <button className="btn btn-back" onClick={() => go('menu')}>← Back</button>
        <h2>Collection</h2>
        <input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search collection" />
      </header>
      <div className="tabs" role="tablist">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {label}{t !== 'cards' && <small>{counts[t][0]}/{counts[t][1]}</small>}
          </button>
        ))}
      </div>
      {tab === 'charms' && (
        <div className="filter-row">
          {['all', 'common', 'uncommon', 'rare', 'legendary'].map((r) => (
            <button key={r} className={`chip ${rarity === r ? 'active' : ''}`} style={r !== 'all' ? { borderColor: RARITY_COLOR[r] } : undefined} onClick={() => setRarity(r)}>{r}</button>
          ))}
          <label className="toggle-inline"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Reveal undiscovered</label>
        </div>
      )}
      {tab !== 'charms' && tab !== 'cards' && (
        <div className="filter-row"><label className="toggle-inline"><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Reveal undiscovered</label></div>
      )}
      {body}
    </div>
  );
}
