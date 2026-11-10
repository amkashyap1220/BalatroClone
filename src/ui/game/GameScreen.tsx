import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GameStore } from '../store';
import type { Screen } from '../App';
import type { Card, RunState, ScoreResult, ScoreStep } from '../../engine/types';
import {
  playHand, discardCards, sortHand, reorderHand, moveCharm, sellCharm, sellConsumable, useConsumable, canUseConsumable,
  bossViolation, MAX_SELECT, BLIND_NAMES, WIN_ANTE,
} from '../../engine/run';
import { previewHand } from '../../engine/scoring';
import { findCard, getMods, isDebuffed, charmSellValue, consumableSellValue } from '../../engine/core';
import { HANDS } from '../../engine/hands';
import { CHARM_MAP } from '../../engine/content/charms';
import { CONSUMABLE_MAP } from '../../engine/content/consumables';
import { BOSS_MAP } from '../../engine/content/bosses';
import { CHALLENGE_MAP } from '../../engine/content/challenges';
import { DECK_MAP } from '../../engine/content/decks';
import { useTip, useHideTip } from '../tooltip';
import { PlayingCard, CharmCard, ConsumableArt, BossToken, cardTip, charmTip, consumableTip, bossTip } from '../components';
import { fmt, fmtMult } from '../format';
import { reg, usePopups, PopupLayer, useCountUp } from './fx';
import { BlindSelect } from './BlindSelect';
import { Cashout } from './Cashout';
import { Shop } from './Shop';
import { PackView } from './PackView';
import { EndOverlay } from './EndOverlay';
import { RunInfo } from './RunInfo';
import { DeckView } from './DeckView';
import { DeckBack } from '../screens/NewRun';

interface Anim {
  result: ScoreResult;
  next: RunState;
  played: Card[];
  heldIds: string[];
  step: number;
  chips: number;
  mult: number;
  active: string | null;
  total: number | null;
}

export function GameScreen({ store, go }: { store: GameStore; go: (s: Screen) => void }) {
  const run = store.run!;
  const tip = useTip();
  const hideTip = useHideTip();
  const { popups, spawn } = usePopups();
  const [selected, setSelected] = useState<string[]>([]);
  const [selCharm, setSelCharm] = useState<string | null>(null);
  const [selCons, setSelCons] = useState<string | null>(null);
  const [anim, setAnim] = useState<Anim | null>(null);
  const [modal, setModal] = useState<null | 'info' | 'deck' | 'menu'>(null);
  const [shake, setShake] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const dragRef = useRef<{ kind: 'card' | 'charm'; id: string } | null>(null);
  const speed = store.settings.speed;
  const mods = useMemo(() => getMods(run), [run]);
  const round = run.round;
  const busy = !!anim;

  // Reset selection whenever the hand changes.
  const handKey = round?.hand.join(',') ?? run.pack?.hand.join(',') ?? '';
  useEffect(() => {
    setSelected((s) => s.filter((id) => (round?.hand ?? run.pack?.hand ?? []).includes(id)));
  }, [handKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!run.charms.some((c) => c.uid === selCharm)) setSelCharm(null);
    if (!run.consumables.some((c) => c.uid === selCons)) setSelCons(null);
  }, [run, selCharm, selCons]);

  // Round start banner + boss sting
  const roundId = round ? `${run.ante}-${run.blindIndex}` : null;
  useEffect(() => {
    if (!roundId || run.phase !== 'playing') return;
    const name = round!.bossId ? BOSS_MAP[round!.bossId].name : BLIND_NAMES[round!.blindType];
    setBanner(name);
    store.sfx(round!.bossId ? 'boss' : 'deal');
    const t = window.setTimeout(() => setBanner(null), 1400);
    return () => window.clearTimeout(t);
  }, [roundId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────── Scoring animation driver ─────────
  useEffect(() => {
    if (!anim) return;
    const steps = anim.result.steps;
    if (anim.step >= steps.length) {
      const t = window.setTimeout(() => {
        const next = anim.next;
        setAnim(null);
        store.commit(next, anim.result);
        if (next.phase === 'cashout') store.sfx('roundWin');
        if (next.phase === 'victory') store.sfx('victory');
        if (next.phase === 'gameOver') {
          store.sfx('defeat');
          if (!store.settings.reduceMotion) { setShake(true); window.setTimeout(() => setShake(false), 600); }
        }
      }, 700 / speed);
      return () => window.clearTimeout(t);
    }
    const s: ScoreStep = steps[anim.step];
    const delay = (s.kind === 'base' ? 450 : s.kind === 'final' ? 500 : s.kind === 'info' ? 380 : 300) / speed;
    const t = window.setTimeout(() => {
      // Apply this step
      const idx = anim.step;
      if (s.kind === 'final') {
        store.sfx('final');
        setAnim((a) => a && { ...a, step: idx + 1, chips: s.chipsAfter, mult: s.multAfter, active: null, total: anim.result.total });
        return;
      }
      if (s.chips) { spawn(s.source, `+${fmt(s.chips)}`, 'chips'); store.sfx('chips', idx % 10); }
      else if (s.mult) { spawn(s.source, `+${fmtMult(s.mult)}`, 'mult'); store.sfx('mult', idx % 10); }
      else if (s.xmult) { spawn(s.source, `×${fmtMult(s.xmult)}`, 'xmult'); store.sfx('xmult'); }
      else if (s.money) { spawn(s.source, `${s.money > 0 ? '+' : '-'}$${Math.abs(s.money)}`, 'money'); store.sfx('money'); }
      else if (s.kind === 'info' && s.source) {
        spawn(s.source, s.text, s.text.includes('Shatter') || s.text.includes('Destroy') ? 'bad' : 'info');
        if (s.text.includes('Shatter') || s.text.includes('Destroy')) store.sfx('shatter');
      } else if (s.kind === 'info') spawn(null, s.text, 'bad');
      setAnim((a) => a && { ...a, step: idx + 1, chips: s.chipsAfter, mult: s.multAfter, active: s.source });
    }, delay);
    return () => window.clearTimeout(t);
  }, [anim, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────── Actions ─────────
  const toggleCard = useCallback((id: string) => {
    if (busy) return;
    setSelCharm(null);
    setSelected((s) => {
      if (s.includes(id)) { store.sfx('deselect'); return s.filter((x) => x !== id); }
      if (s.length >= MAX_SELECT) { store.sfx('error'); return s; }
      store.sfx('select');
      return [...s, id];
    });
  }, [busy, store]);

  const doPlay = () => {
    if (busy || !round || !selected.length) return;
    const res = playHand(run, selected);
    if (res.error) { store.toast(res.error, 'error'); store.sfx('error'); return; }
    hideTip();
    store.sfx('play');
    const played = round.hand.filter((id) => selected.includes(id)).map((id) => findCard(res.run, id) ?? findCard(run, id)!);
    setAnim({
      result: res.score!, next: res.run, played, heldIds: round.hand.filter((id) => !selected.includes(id)),
      step: 0, chips: 0, mult: 0, active: null, total: null,
    });
    setSelected([]);
  };

  const doDiscard = () => {
    if (busy || !round || !selected.length) return;
    const r = store.act(discardCards(run, selected), 'deal');
    if (!r.error) setSelected([]);
  };

  const doSort = (by: 'rank' | 'suit') => { if (!busy) store.act(sortHand(run, by), 'deal'); };

  const doSellCharm = (uid: string) => {
    const c = run.charms.find((x) => x.uid === uid)!;
    if (store.settings.confirmSell && !confirm(`Sell ${CHARM_MAP[c.id].name} for $${charmSellValue(run, c, mods)}?`)) return;
    const r = store.act(sellCharm(run, uid), 'sell');
    if (!r.error) setSelCharm(null);
  };

  const doUseCons = (uid: string) => {
    const err = canUseConsumable(run, uid, selected);
    if (err) { store.toast(err, 'error'); store.sfx('error'); return; }
    const before = run.deck.length;
    const r = store.act(useConsumable(run, uid, selected), 'use');
    if (!r.error) {
      setSelCons(null);
      if (r.run.deck.length < before) store.sfx('shatter');
    }
  };

  const doSellCons = (uid: string) => {
    const r = store.act(sellConsumable(run, uid), 'sell');
    if (!r.error) setSelCons(null);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || modal) return;
      if (run.phase !== 'playing' || busy) return;
      const k = e.key.toLowerCase();
      if (k === 'p') doPlay();
      else if (k === 'd') doDiscard();
      else if (k === 'r') doSort('rank');
      else if (k === 's') doSort('suit');
      else if (k === 'escape') setSelected([]);
      else if (/^[1-9]$/.test(k) && round) {
        const id = round.hand[parseInt(k, 10) - 1];
        if (id) toggleCard(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ───────── Derived display values ─────────
  const handIds = anim ? anim.heldIds : round?.hand ?? [];
  const selCards = selected.map((id) => findCard(run, id)).filter((c): c is Card => !!c);
  const preview = !anim && round && selCards.length ? previewHand(run, selCards) : null;
  const violation = !anim && preview ? bossViolation(run, selected) : null;
  const dispChips = anim ? anim.chips : preview ? preview.chips : 0;
  const dispMult = anim ? anim.mult : preview ? preview.mult : 0;
  const handLabel = anim ? HANDS[anim.result.hand].name : preview ? HANDS[preview.type].name : '';
  const handLevel = anim ? run.handLevels[anim.result.hand] : preview ? run.handLevels[preview.type] : null;
  const scoreShown = useCountUp(anim?.total != null ? (round?.score ?? 0) + anim.total : round?.score ?? 0, 500);
  const moneyShown = useCountUp(run.money, 400);
  const scoringSet = new Set(anim?.result.scoringIds ?? []);
  const blindName = round ? (round.bossId ? BOSS_MAP[round.bossId].name : BLIND_NAMES[round.blindType]) : run.phase === 'shop' ? 'Shop' : 'Choose a blind';
  const ch = run.challengeId ? CHALLENGE_MAP[run.challengeId] : null;
  const winAnte = ch?.winAnte ?? WIN_ANTE;

  // Hand fan layout
  const n = handIds.length;
  const fanStyle = (i: number): React.CSSProperties => {
    const mid = (n - 1) / 2;
    const off = i - mid;
    const rot = n > 1 ? off * Math.min(3, 24 / n) : 0;
    const lift = Math.min(18, Math.abs(off) * Math.abs(off) * (n > 8 ? 0.9 : 1.6));
    return { ['--rot' as string]: `${rot}deg`, ['--lift' as string]: `${lift}px`, ['--i' as string]: i, zIndex: i + 1 };
  };

  const onDragStartCard = (id: string) => (e: React.DragEvent) => { dragRef.current = { kind: 'card', id }; e.dataTransfer.effectAllowed = 'move'; };
  const onDropCard = (targetId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    if (!d || d.kind !== 'card' || !round || d.id === targetId) return;
    const ids = round.hand.filter((x) => x !== d.id);
    ids.splice(ids.indexOf(targetId), 0, d.id);
    store.act(reorderHand(run, ids));
    dragRef.current = null;
  };
  const onDropCharm = (targetIdx: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const d = dragRef.current;
    if (!d || d.kind !== 'charm') return;
    const from = run.charms.findIndex((c) => c.uid === d.id);
    store.act(moveCharm(run, from, targetIdx), 'select');
    dragRef.current = null;
  };

  const inRoundView = run.phase === 'playing' || (anim && anim.next);
  const packHand = run.phase === 'pack' && run.pack && run.pack.hand.length > 0;

  return (
    <div className={`game ${shake ? 'shake' : ''} ${round?.bossId && !round.bossDisabled ? 'boss-round' : ''}`}>
      {/* ───────── Sidebar ───────── */}
      <aside className="sidebar">
        <div className={`blind-panel ${round?.bossId ? 'boss' : ''}`} {...(round?.bossId ? tip(bossTip(round.bossId)) : {})}>
          <div className="blind-name">{blindName}</div>
          {round ? (
            <div className="blind-body">
              {round.bossId ? <BossToken id={round.bossId} size={52} /> : <div className={`blind-chip chip-${round.blindType}`}>{round.blindType === 'small' ? 'S' : 'B'}</div>}
              <div>
                <div className="muted small">Score at least</div>
                <div className="target">{fmt(round.target)}</div>
                {round.bossDisabled && <div className="t-hint small">Boss effect disabled</div>}
              </div>
            </div>
          ) : (
            <div className="blind-body muted small">Ante {run.ante} · {['Small', 'Big', 'Boss'][run.blindIndex]} blind next</div>
          )}
        </div>
        <div className="round-score">
          <span className="label">Round score</span>
          <span className="value">{fmt(scoreShown)}</span>
        </div>
        <div className={`hand-score ${violation ? 'warn' : ''}`}>
          <div className="hand-name">{handLabel || ' '}{handLevel ? <small> lvl.{handLevel}</small> : null}</div>
          <div className="cm-row">
            <div className="chips-box">{fmt(dispChips)}</div>
            <span className="x">×</span>
            <div className="mult-box">{fmtMult(dispMult)}</div>
          </div>
          {anim?.total != null && <div className="hand-total">{fmt(anim.total)}</div>}
          {violation && <div className="violation">{violation} (scores nothing)</div>}
        </div>
        <div className="stat-grid">
          <div className="stat hands"><span>Hands</span><b>{round?.handsLeft ?? mods.hands}</b></div>
          <div className="stat discards"><span>Discards</span><b>{round?.discardsLeft ?? mods.discards}</b></div>
          <div className="stat money"><span>Money</span><b>${Math.round(moneyShown)}</b></div>
          <div className="stat ante"><span>Ante</span><b>{run.ante}<small>/{winAnte}</small></b></div>
        </div>
        <div className="side-buttons">
          <button className="btn small" onClick={() => setModal('info')}>Run Info</button>
          <button className="btn small" onClick={() => setModal('menu')}>Options</button>
        </div>
        <div className="side-foot muted small">
          {DECK_MAP[run.deckId]?.name}{ch ? ` · ${ch.name}` : ''}{run.heat ? ` · Heat ${run.heat}` : ''}{run.endless ? ' · Endless' : ''}
        </div>
      </aside>

      {/* ───────── Table ───────── */}
      <main className="table">
        <div className="top-row">
          <div className="charm-row" onDragOver={(e) => e.preventDefault()}>
            <div className="row-label">Charms {run.charms.length}/{mods.charmSlots}</div>
            <div className="charm-slots">
              {run.charms.map((c, i) => {
                const def = CHARM_MAP[c.id];
                const disabled = round?.disabledCharm === c.uid;
                return (
                  <div key={c.uid} className="charm-wrap" ref={reg(c.uid)}>
                    <CharmCard inst={c} disabled={disabled} selected={selCharm === c.uid}
                      pulse={anim?.active === c.uid}
                      onClick={() => { if (!busy) { setSelCharm(selCharm === c.uid ? null : c.uid); setSelCons(null); store.sfx('select'); } }}
                      tipProps={tip(charmTip(def, c, run, <div className="t-hint">Sells for ${charmSellValue(run, c, mods)}</div>))}
                      draggable={!busy} onDragStart={(e) => { dragRef.current = { kind: 'charm', id: c.uid }; e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={(e) => e.preventDefault()} onDrop={onDropCharm(i)} />
                    {selCharm === c.uid && !busy && (
                      <div className="item-actions">
                        <button className="btn tiny" disabled={i === 0} onClick={() => store.act(moveCharm(run, i, i - 1))} aria-label="Move left">◀</button>
                        <button className="btn tiny sell" onClick={() => doSellCharm(c.uid)}>Sell ${charmSellValue(run, c, mods)}</button>
                        <button className="btn tiny" disabled={i === run.charms.length - 1} onClick={() => store.act(moveCharm(run, i, i + 1))} aria-label="Move right">▶</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: Math.max(0, mods.charmSlots - run.charms.length) }, (_, i) => <div key={`e${i}`} className="slot-empty" />)}
            </div>
          </div>
          <div className="cons-row">
            <div className="row-label">Consumables {run.consumables.filter((c) => c.edition !== 'void').length}/{mods.consumableSlots}</div>
            <div className="cons-slots">
              {run.consumables.map((c) => {
                const def = CONSUMABLE_MAP[c.id];
                return (
                  <div key={c.uid} className={`cons-wrap ${selCons === c.uid ? 'selected' : ''}`}>
                    <div role="button" tabIndex={0} className="cons-card" onClick={() => { if (!busy) { setSelCons(selCons === c.uid ? null : c.uid); setSelCharm(null); store.sfx('select'); } }}
                      {...tip(consumableTip(def))}>
                      <ConsumableArt def={def} edition={c.edition} />
                    </div>
                    {selCons === c.uid && !busy && (
                      <div className="item-actions">
                        <button className="btn tiny use" disabled={!!canUseConsumable(run, c.uid, selected)} onClick={() => doUseCons(c.uid)}
                          title={canUseConsumable(run, c.uid, selected) ?? 'Use'}>Use</button>
                        <button className="btn tiny sell" onClick={() => doSellCons(c.uid)}>${consumableSellValue(run, c, mods)}</button>
                      </div>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: Math.max(0, mods.consumableSlots - run.consumables.filter((c) => c.edition !== 'void').length) }, (_, i) => <div key={`e${i}`} className="slot-empty small" />)}
            </div>
          </div>
        </div>

        {/* Center stage */}
        <div className="stage">
          {run.phase === 'blindSelect' && !anim && <BlindSelect store={store} />}
          {(run.phase === 'cashout') && !anim && <Cashout store={store} />}
          {run.phase === 'shop' && !anim && <Shop store={store} openDeck={() => setModal('deck')} />}
          {run.phase === 'pack' && !anim && <PackView store={store} selected={selected} clearSel={() => setSelected([])} />}
          {inRoundView && (
            <div className="play-area">
              {anim ? (
                <div className="played-row">
                  {anim.played.map((c, i) => (
                    <div key={c.id} ref={reg(c.id)} className={`played-slot ${scoringSet.has(c.id) ? 'scoring' : 'kicker'}`} style={{ ['--i' as string]: i } as React.CSSProperties}>
                      <PlayingCard card={c} pulse={anim.active === c.id} debuffed={isDebuffed(run, c)} />
                    </div>
                  ))}
                </div>
              ) : (
                round && round.bossId && !round.bossDisabled && (
                  <div className="boss-reminder" {...tip(bossTip(round.bossId))}>
                    <BossToken id={round.bossId} size={40} /> <span>{BOSS_MAP[round.bossId].desc}</span>
                  </div>
                )
              )}
              {banner && <div className="round-banner"><span>{banner}</span></div>}
            </div>
          )}
        </div>

        {/* Hand */}
        {(inRoundView || packHand) && (
          <div className="hand-zone">
            <div className="hand" style={{ ['--n' as string]: Math.max(1, (packHand ? run.pack!.hand : handIds).length) } as React.CSSProperties}>
              {(packHand ? run.pack!.hand : handIds).map((id, i) => {
                const c = findCard(anim ? anim.next : run, id) ?? findCard(run, id);
                if (!c) return null;
                const deb = isDebuffed(run, c, mods);
                const fd = round?.faceDown.includes(id) ?? false;
                return (
                  <div key={id} ref={reg(id)} className="hand-slot" style={fanStyle(i)}>
                    <PlayingCard card={c} selected={selected.includes(id)} debuffed={deb} faceDown={fd}
                      pulse={anim?.active === id}
                      className="deal-in"
                      onClick={() => toggleCard(id)}
                      tipProps={tip(cardTip(c, deb))}
                      draggable={!busy && !packHand} onDragStart={onDragStartCard(id)} onDragOver={(e) => e.preventDefault()} onDrop={onDropCard(id)} />
                  </div>
                );
              })}
            </div>
            <button className="deck-pile" onClick={() => setModal('deck')} aria-label="View deck">
              <DeckBack colors={DECK_MAP[run.deckId]?.colors ?? ['#333', '#999']} pattern={DECK_MAP[run.deckId]?.pattern ?? 'lattice'} />
              <span className="deck-count">{round ? round.drawPile.length : run.deck.length}/{run.deck.length}</span>
            </button>
          </div>
        )}

        {run.phase === 'playing' && (
          <div className="actions">
            <button className="btn btn-play-hand" disabled={busy || !selected.length} onClick={doPlay}>Play Hand <kbd>P</kbd></button>
            <div className="sort-group">
              <span className="muted small">Sort</span>
              <button className="btn small" disabled={busy} onClick={() => doSort('rank')}>Rank</button>
              <button className="btn small" disabled={busy} onClick={() => doSort('suit')}>Suit</button>
            </div>
            <button className="btn btn-discard" disabled={busy || !selected.length || !round || round.discardsLeft <= 0} onClick={doDiscard}>Discard <kbd>D</kbd></button>
          </div>
        )}
      </main>

      <PopupLayer popups={popups} />
      {(run.phase === 'gameOver' || run.phase === 'victory') && !anim && <EndOverlay store={store} go={go} />}
      {modal === 'info' && <RunInfo run={run} onClose={() => setModal(null)} />}
      {modal === 'deck' && <DeckView store={store} onClose={() => setModal(null)} />}
      {modal === 'menu' && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal panel small-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Options">
            <h3>Options</h3>
            <button className="btn btn-big" onClick={() => setModal(null)}>Resume</button>
            <button className="btn" onClick={() => { setModal(null); go('settings'); }}>Settings</button>
            <button className="btn" onClick={() => { store.quitToMenu(); go('menu'); }}>Save & Main Menu</button>
            <button className="btn btn-danger" onClick={() => {
              if (!confirm('Abandon this run? It will count as a loss.')) return;
              store.abandonRun();
              go('menu');
            }}>Abandon Run</button>
            <p className="muted small">Seed: <b>{run.seed}</b></p>
          </div>
        </div>
      )}
    </div>
  );
}
