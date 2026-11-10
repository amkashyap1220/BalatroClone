import React from 'react';
import type { Card, CharmInstance, EditionId, RunState, Suit } from '../engine/types';
import { RANK_NAMES, SUIT_SYMBOLS, cardName, rankChips, hasRank } from '../engine/cards';
import { CHARM_MAP } from '../engine/content/charms';
import { CONSUMABLE_MAP } from '../engine/content/consumables';
import { BOSS_MAP } from '../engine/content/bosses';
import { BOON_MAP } from '../engine/content/boons';
import { PACK_MAP, TOKEN_MAP } from '../engine/content/misc';
import { EDITIONS, ENHANCEMENTS, SEALS } from '../engine/content/modifications';
import type { CharmDef, ConsumableDef, Icon } from '../engine/content/defs';
import { Rich } from './format';
import type { TipContent } from './tooltip';

export const RARITY_COLOR: Record<string, string> = {
  common: '#4f8cc9', uncommon: '#2fb36f', rare: '#e0445a', legendary: '#b46cff',
};
export const KIND_COLOR: Record<string, string> = { omen: '#9b5de5', star: '#3a86ff', hex: '#14b8a6' };

let fourColor = false;
export function setFourColor(v: boolean) { fourColor = v; }
export function suitColor(s: Suit): string {
  if (fourColor) return { S: '#1d1b2e', H: '#d7263d', D: '#1e6fd9', C: '#1f8a4c' }[s];
  return s === 'H' || s === 'D' ? '#d7263d' : '#1d1b2e';
}

const PIPS: Record<number, [number, number][]> = {
  2: [[50, 18], [50, 82]],
  3: [[50, 18], [50, 50], [50, 82]],
  4: [[30, 18], [70, 18], [30, 82], [70, 82]],
  5: [[30, 18], [70, 18], [50, 50], [30, 82], [70, 82]],
  6: [[30, 18], [70, 18], [30, 50], [70, 50], [30, 82], [70, 82]],
  7: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [30, 82], [70, 82]],
  8: [[30, 18], [70, 18], [50, 34], [30, 50], [70, 50], [50, 66], [30, 82], [70, 82]],
  9: [[30, 16], [70, 16], [30, 38], [70, 38], [50, 50], [30, 62], [70, 62], [30, 84], [70, 84]],
  10: [[30, 16], [70, 16], [50, 27], [30, 38], [70, 38], [30, 62], [70, 62], [50, 73], [30, 84], [70, 84]],
};

function FaceArt({ rank, suit }: { rank: number; suit: Suit }) {
  const col = suitColor(suit);
  const sym = SUIT_SYMBOLS[suit];
  const robe = suit === 'H' ? '#f2a541' : suit === 'D' ? '#5bc0be' : suit === 'S' ? '#7b6cf6' : '#6ab04c';
  return (
    <svg viewBox="0 0 60 84" className="face-art" aria-hidden>
      <rect x="2" y="2" width="56" height="80" rx="4" fill="none" stroke={col} strokeWidth="1.5" strokeDasharray="2 2" />
      <path d="M8 84 Q10 58 30 54 Q50 58 52 84 Z" fill={robe} stroke={col} strokeWidth="1.5" />
      <path d="M22 60 L30 74 L38 60" fill="none" stroke="#fff" strokeWidth="2" opacity="0.8" />
      <circle cx="30" cy="40" r="11" fill="#f6d7b0" stroke={col} strokeWidth="1.5" />
      <circle cx="26" cy="40" r="1.2" fill="#222" />
      <circle cx="34" cy="40" r="1.2" fill="#222" />
      <path d="M26 45 Q30 48 34 45" fill="none" stroke="#a33" strokeWidth="1.2" />
      {rank === 11 && (<>
        <path d="M17 33 Q30 20 43 33 Z" fill={col} />
        <path d="M40 30 Q50 14 46 8" fill="none" stroke="#e8c547" strokeWidth="2.5" strokeLinecap="round" />
      </>)}
      {rank === 12 && (<>
        <path d="M19 32 L22 22 L26 28 L30 18 L34 28 L38 22 L41 32 Z" fill="#e8c547" stroke={col} strokeWidth="1" />
        <circle cx="30" cy="25" r="2" fill={col} />
        <path d="M18 34 Q14 48 20 54 M42 34 Q46 48 40 54" fill="none" stroke="#6b3f1d" strokeWidth="3" />
      </>)}
      {rank === 13 && (<>
        <path d="M17 31 L17 17 L22 24 L26 14 L30 22 L34 14 L38 24 L43 17 L43 31 Z" fill="#e8c547" stroke={col} strokeWidth="1" />
        <rect x="17" y="29" width="26" height="4" fill={col} />
        <path d="M23 49 Q30 60 37 49" fill="#d9d4c7" stroke="#999" strokeWidth="0.8" />
      </>)}
      <text x="30" y="80" textAnchor="middle" fontSize="11" fill={col}>{sym}</text>
    </svg>
  );
}

export interface PlayingCardProps {
  card: Card;
  selected?: boolean;
  debuffed?: boolean;
  faceDown?: boolean;
  scoring?: boolean;
  dim?: boolean;
  pulse?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
  tipProps?: Record<string, unknown>;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export function PlayingCard(p: PlayingCardProps) {
  const c = p.card;
  const cls = [
    'pcard',
    p.small && 'small',
    p.selected && 'selected',
    p.debuffed && 'debuffed',
    p.faceDown && 'facedown',
    p.dim && 'dim',
    p.pulse && 'pulse',
    c.enhancement && `enh-${c.enhancement}`,
    c.edition && `ed-${c.edition}`,
    p.className,
  ].filter(Boolean).join(' ');
  const col = suitColor(c.suit);
  const mono = c.enhancement === 'monolith';
  return (
    <div
      className={cls}
      style={p.style}
      onClick={p.onClick}
      role="button"
      tabIndex={0}
      aria-label={p.faceDown ? 'Face-down card' : cardName(c)}
      aria-pressed={p.selected}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onClick?.(); } }}
      draggable={p.draggable}
      onDragStart={p.onDragStart}
      onDragOver={p.onDragOver}
      onDrop={p.onDrop}
      {...(p.faceDown ? {} : p.tipProps)}
    >
      <div className="pcard-inner">
        {p.faceDown ? (
          <div className="card-back" />
        ) : mono ? (
          <div className="mono-face"><span>◆</span></div>
        ) : (
          <>
            <div className="corner tl" style={{ color: col }}>
              <b>{RANK_NAMES[c.rank]}</b>
              <i>{SUIT_SYMBOLS[c.suit]}</i>
            </div>
            <div className="corner br" style={{ color: col }}>
              <b>{RANK_NAMES[c.rank]}</b>
              <i>{SUIT_SYMBOLS[c.suit]}</i>
            </div>
            <div className="card-center" style={{ color: col }}>
              {c.rank >= 11 && c.rank <= 13 ? (
                <FaceArt rank={c.rank} suit={c.suit} />
              ) : c.rank === 14 ? (
                <div className="ace-pip"><span>{SUIT_SYMBOLS[c.suit]}</span></div>
              ) : (
                (PIPS[c.rank] ?? []).map(([x, y], i) => (
                  <span key={i} className="pip" style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%)${y > 55 ? ' rotate(180deg)' : ''}` }}>
                    {SUIT_SYMBOLS[c.suit]}
                  </span>
                ))
              )}
            </div>
          </>
        )}
        {!p.faceDown && c.enhancement && <div className="enh-badge">{ENHANCEMENTS[c.enhancement].name}</div>}
        {!p.faceDown && c.seal && <div className={`seal seal-${c.seal}`} style={{ background: SEALS[c.seal].color }} title={SEALS[c.seal].name} />}
        {!p.faceDown && c.edition && <div className="edition-overlay" />}
        {p.debuffed && <div className="debuff-x">✕</div>}
      </div>
    </div>
  );
}

export function cardTip(c: Card, debuffed = false): TipContent {
  const lines: React.ReactNode[] = [];
  const chips = (hasRank(c) ? rankChips(c.rank) : 0) + c.bonusChips;
  lines.push(<div key="c"><Rich text={`+${chips} Chips${c.bonusMult ? `, +${c.bonusMult} Mult` : ''} when scored.`} /></div>);
  if (c.enhancement) lines.push(<div key="e"><b style={{ color: ENHANCEMENTS[c.enhancement].color }}>{ENHANCEMENTS[c.enhancement].name}:</b> <Rich text={ENHANCEMENTS[c.enhancement].desc} /></div>);
  if (c.edition) lines.push(<div key="d"><b className="t-edition">{EDITIONS[c.edition].name}:</b> <Rich text={EDITIONS[c.edition].cardDesc} /></div>);
  if (c.seal) lines.push(<div key="s"><b style={{ color: SEALS[c.seal].color }}>{SEALS[c.seal].name}:</b> <Rich text={SEALS[c.seal].desc} /></div>);
  if (debuffed) lines.push(<div key="x" className="t-debuff">Debuffed: scores nothing this round.</div>);
  return { title: cardName(c), body: <>{lines}</> };
}

function iconBg(icon: Icon) {
  const h2 = icon.hue2 ?? icon.hue + 30;
  return `linear-gradient(160deg, hsl(${icon.hue} 70% 42%), hsl(${h2} 65% 22%))`;
}

export function CharmArt({ def, edition, small }: { def: CharmDef; edition?: EditionId | null; small?: boolean }) {
  const rc = RARITY_COLOR[def.rarity];
  return (
    <div className={`charm-art rar-${def.rarity} ${edition ? `ed-${edition}` : ''} ${small ? 'small' : ''}`} style={{ background: iconBg(def.icon), borderColor: rc }}>
      <div className={`charm-pattern pat-${def.rarity}`} />
      <div className="charm-medal" style={{ boxShadow: `0 0 0 3px ${rc}, 0 6px 14px rgba(0,0,0,.45)` }}>
        <span className="glyph">{def.icon.glyph}</span>
      </div>
      <div className="charm-name">{def.name}</div>
      {edition && <div className="edition-overlay" />}
    </div>
  );
}

export function charmTip(def: CharmDef, inst?: CharmInstance | null, run?: RunState | null, extra?: React.ReactNode): TipContent {
  const tags: TipContent['tags'] = [{ label: def.rarity.toUpperCase(), color: RARITY_COLOR[def.rarity] }];
  if (inst?.edition) tags.push({ label: EDITIONS[inst.edition].name, color: '#555' });
  return {
    title: def.name,
    accent: RARITY_COLOR[def.rarity],
    body: (
      <>
        <div><Rich text={def.desc} /></div>
        {inst?.edition && <div className="t-edition-line">{EDITIONS[inst.edition].name}: <Rich text={EDITIONS[inst.edition].charmDesc} /></div>}
        {inst && run && def.status && <div className="t-status">{def.status(inst, run)}</div>}
        {extra}
      </>
    ),
    tags,
  };
}

export function CharmCard({ inst, def, disabled, onClick, selected, tipProps, pulse, className, draggable, onDragStart, onDragOver, onDrop }: {
  inst?: CharmInstance; def?: CharmDef; disabled?: boolean; onClick?: () => void; selected?: boolean; tipProps?: Record<string, unknown>; pulse?: boolean; className?: string;
  draggable?: boolean; onDragStart?: (e: React.DragEvent) => void; onDragOver?: (e: React.DragEvent) => void; onDrop?: (e: React.DragEvent) => void;
}) {
  const d = def ?? CHARM_MAP[inst!.id];
  return (
    <div className={`charm-card ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${pulse ? 'pulse' : ''} ${className ?? ''}`} onClick={onClick}
      role="button" tabIndex={0} aria-label={d.name} {...tipProps}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>
      <CharmArt def={d} edition={inst?.edition} />
      {disabled && <div className="disabled-x">DISABLED</div>}
    </div>
  );
}

export function ConsumableArt({ def, edition }: { def: ConsumableDef; edition?: EditionId | null }) {
  return (
    <div className={`cons-art kind-${def.kind} ${edition ? `ed-${edition}` : ''}`} style={{ ['--h' as string]: def.icon.hue }}>
      <div className="cons-frame" />
      {def.kind === 'star' && <div className="orbits"><i /><i /></div>}
      {def.kind === 'hex' && <div className="sigil" />}
      <div className="cons-glyph">{def.icon.glyph}</div>
      <div className="cons-name">{def.name}</div>
      <div className="cons-kind">{def.kind.toUpperCase()}</div>
      {edition && <div className="edition-overlay" />}
    </div>
  );
}

export function consumableTip(def: ConsumableDef, extra?: React.ReactNode): TipContent {
  return {
    title: def.name,
    accent: KIND_COLOR[def.kind],
    body: (<><div><Rich text={def.desc} /></div>{def.select && <div className="t-hint">Select {def.select[0] === def.select[1] ? def.select[0] : `${def.select[0]}–${def.select[1]}`} card{def.select[1] > 1 ? 's' : ''} in hand to use.</div>}{extra}</>),
    tags: [{ label: def.kind === 'omen' ? 'OMEN' : def.kind === 'star' ? 'STAR' : 'HEX', color: KIND_COLOR[def.kind] }],
  };
}

export function BossToken({ id, size = 64, spin }: { id: string; size?: number; spin?: boolean }) {
  const b = BOSS_MAP[id];
  if (!b) return null;
  const h2 = b.icon.hue2 ?? b.icon.hue + 20;
  return (
    <div className={`boss-token ${spin ? 'spin' : ''} ${b.finale ? 'finale' : ''}`} style={{ width: size, height: size, background: `radial-gradient(circle at 35% 30%, hsl(${b.icon.hue} 75% 60%), hsl(${h2} 70% 22%))`, fontSize: size * 0.42 }}>
      <span>{b.icon.glyph}</span>
    </div>
  );
}

export function bossTip(id: string): TipContent {
  const b = BOSS_MAP[id];
  return {
    title: b.name,
    accent: `hsl(${b.icon.hue} 70% 55%)`,
    body: (<><div><Rich text={b.desc} /></div><div className="t-hint">Counterplay: {b.counter}</div></>),
    tags: [{ label: b.finale ? 'FINALE' : `DIFFICULTY ${'★'.repeat(b.difficulty)}`, color: '#7a1f2b' }, { label: `×${b.scoreMult} score`, color: '#444' }],
  };
}

export function PackArt({ id }: { id: string }) {
  const p = PACK_MAP[id];
  const sym = { card: '▤', omen: '☉', star: '✦', hex: '⛧', charm: '♣', enhanced: '✧', discovery: '?' }[p.kind];
  return (
    <div className={`pack-art pk-${p.kind}`} style={{ background: `linear-gradient(150deg, ${p.colors[0]}, ${p.colors[0]}cc 55%, ${p.colors[1]})` }}>
      <div className="pack-crimp top" />
      <div className="pack-sym" style={{ color: p.colors[1] }}>{sym}</div>
      <div className="pack-name">{p.name}</div>
      <div className="pack-sub">Pick {p.picks} of {p.size}</div>
      <div className="pack-crimp bottom" />
    </div>
  );
}

export function packTip(id: string): TipContent {
  const p = PACK_MAP[id];
  return { title: p.name, accent: p.colors[0], body: <Rich text={p.desc} />, tags: [{ label: 'PACK', color: p.colors[0] }] };
}

export function BoonArt({ id }: { id: string }) {
  const b = BOON_MAP[id];
  return (
    <div className="boon-art" style={{ ['--h' as string]: b.icon.hue }}>
      <div className="boon-ribbon">BOON</div>
      <div className="boon-glyph">{b.icon.glyph}</div>
      <div className="boon-name">{b.name}</div>
    </div>
  );
}

export function boonTip(id: string): TipContent {
  const b = BOON_MAP[id];
  return { title: b.name, accent: '#e8c547', body: <Rich text={b.desc} />, tags: [{ label: 'PERMANENT UPGRADE', color: '#8a6d1d' }] };
}

export function TokenChip({ id, size = 44 }: { id: string; size?: number }) {
  const t = TOKEN_MAP[id];
  if (!t) return null;
  return (
    <div className="token-chip" style={{ width: size, height: size, fontSize: size * 0.36, background: `radial-gradient(circle at 35% 30%, hsl(${t.icon.hue} 80% 65%), hsl(${t.icon.hue} 70% 30%))` }}>
      <span>{t.icon.glyph}</span>
    </div>
  );
}

export function tokenTip(id: string): TipContent {
  const t = TOKEN_MAP[id];
  return { title: t.name, accent: `hsl(${t.icon.hue} 70% 55%)`, body: <Rich text={t.desc} />, tags: [{ label: 'SKIP REWARD', color: '#355' }] };
}

export function consumableDef(id: string) {
  return CONSUMABLE_MAP[id];
}
