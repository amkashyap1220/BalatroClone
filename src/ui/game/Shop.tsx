import React from 'react';
import type { GameStore } from '../store';
import type { ShopItem } from '../../engine/types';
import { buyItem, reroll, rerollCost, leaveShop, shopPrice, canAfford } from '../../engine/run';
import { CHARM_MAP } from '../../engine/content/charms';
import { CONSUMABLE_MAP } from '../../engine/content/consumables';
import { useTip } from '../tooltip';
import { CharmArt, ConsumableArt, PackArt, BoonArt, PlayingCard, charmTip, consumableTip, packTip, boonTip, cardTip, RARITY_COLOR } from '../components';
import { reg } from './fx';

export function Shop({ store, openDeck }: { store: GameStore; openDeck: () => void }) {
  const run = store.run!;
  const shop = run.shop!;
  const tip = useTip();
  const rc = rerollCost(run);

  const buy = (section: 'items' | 'packs' | 'boon', i: number, useNow = false) => {
    const item = section === 'boon' ? shop.boon! : shop[section][i];
    const res = store.act(buyItem(run, section, i, useNow), item.kind === 'pack' ? 'pack' : 'buy');
    void res;
  };

  const renderItem = (it: ShopItem, section: 'items' | 'packs' | 'boon', i: number) => {
    const price = shopPrice(run, it);
    const afford = canAfford(run, price);
    let art: React.ReactNode = null;
    let tp: ReturnType<typeof tip> | Record<string, never> = {};
    let label = '';
    if (it.kind === 'charm') {
      const def = CHARM_MAP[it.id];
      art = <CharmArt def={def} edition={it.edition} />;
      tp = tip(charmTip(def, { uid: '', id: it.id, edition: it.edition ?? null, state: { ...(def.init ?? {}) }, sellBonus: 0 }, run));
      label = def.rarity;
    } else if (it.kind === 'consumable') {
      const def = CONSUMABLE_MAP[it.id];
      art = <ConsumableArt def={def} />;
      tp = tip(consumableTip(def));
      label = def.kind;
    } else if (it.kind === 'card') {
      art = <PlayingCard card={it.card!} />;
      tp = tip(cardTip(it.card!));
      label = 'card';
    } else if (it.kind === 'pack') {
      art = <PackArt id={it.id} />;
      tp = tip(packTip(it.id));
      label = 'pack';
    } else {
      art = <BoonArt id={it.id} />;
      tp = tip(boonTip(it.id));
      label = 'boon';
    }
    const consDef = it.kind === 'consumable' ? CONSUMABLE_MAP[it.id] : null;
    return (
      <div key={`${section}${i}`} className={`shop-item ${it.sold ? 'sold' : ''} kind-${it.kind}`} ref={reg(`shop-${section}-${i}`)}>
        <div className={`price-tag ${afford ? '' : 'cant'}`}>{price === 0 ? 'FREE' : `$${price}`}</div>
        <div className="shop-art" {...tp}>{art}</div>
        <div className="shop-label" style={it.kind === 'charm' ? { color: RARITY_COLOR[label] } : undefined}>{label}</div>
        {it.sold ? (
          <div className="sold-stamp">SOLD</div>
        ) : (
          <div className="shop-buttons">
            <button className="btn small btn-buy" disabled={!afford} onClick={() => buy(section, i)}>{it.kind === 'pack' ? 'Open' : 'Buy'}</button>
            {consDef && !consDef.select && <button className="btn tiny" disabled={!afford} onClick={() => buy(section, i, true)} title="Buy and use immediately">Use</button>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="shop">
      <div className="shop-header">
        <h2 className="stage-title">The Exchange</h2>
        <div className="shop-controls">
          <button className="btn btn-reroll" disabled={!canAfford(run, rc)} onClick={() => store.act(reroll(run), 'reroll')}>
            Reroll <span className="t-money">{rc === 0 ? 'FREE' : `$${rc}`}</span>
            {shop.freeRerolls > 0 && <small> ({shop.freeRerolls} free)</small>}
          </button>
          <button className="btn small" onClick={openDeck}>{shop.cardSoldThisShop ? 'View deck' : 'Deck / Pawn a card'}</button>
          <button className="btn btn-next" onClick={() => store.act(leaveShop(run), 'select')}>Next Round →</button>
        </div>
      </div>
      <div className="shop-shelf main-shelf">{shop.items.map((it, i) => renderItem(it, 'items', i))}</div>
      <div className="shop-lower">
        <div className="shop-shelf">
          <div className="shelf-label">Packs</div>
          {shop.packs.map((it, i) => renderItem(it, 'packs', i))}
        </div>
        <div className="shop-shelf boon-shelf">
          <div className="shelf-label">Boon of Ante {run.ante}</div>
          {shop.boon ? renderItem(shop.boon, 'boon', 0) : <div className="muted small">Sold out until next ante</div>}
        </div>
      </div>
    </div>
  );
}
