import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TipContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  body?: React.ReactNode;
  tags?: { label: string; color?: string }[];
  accent?: string;
}

interface TipState { content: TipContent; rect: DOMRect }

const Ctx = createContext<(s: TipState | null) => void>(() => {});

/** True when the most recent pointer was a finger or pen, so hover and focus tips stay out of the way. */
let lastTouch = false;
/** Set when a long press opened a tip, so the click that ends the press doesn't also select. */
let swallowClick = false;
const LONG_PRESS_MS = 380;

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  useEffect(() => {
    // Any new touch closes an open tip; a long press on another item opens its own.
    const onDown = (e: PointerEvent) => {
      lastTouch = e.pointerType !== 'mouse';
      swallowClick = false;
      if (lastTouch) setTip(null);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, []);
  return (
    <Ctx.Provider value={setTip}>
      {children}
      {tip && <TooltipBox tip={tip} />}
    </Ctx.Provider>
  );
}

function TooltipBox({ tip }: { tip: TipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = tip.rect;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(window.innerWidth - w - 8, left));
    let top = r.top - h - 10;
    if (top < 8) top = Math.min(window.innerHeight - h - 8, r.bottom + 10);
    setPos({ left, top });
  }, [tip]);
  const c = tip.content;
  return (
    <div ref={ref} className="tooltip" style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, borderColor: c.accent }} role="tooltip">
      <div className="tooltip-title">{c.title}</div>
      {c.subtitle && <div className="tooltip-sub">{c.subtitle}</div>}
      {c.body && <div className="tooltip-body">{c.body}</div>}
      {c.tags && c.tags.length > 0 && (
        <div className="tooltip-tags">
          {c.tags.map((t, i) => (
            <span key={i} className="tag" style={{ background: t.color }}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Spread onto any element to show a tooltip: on hover or keyboard focus with a mouse,
 * or on a long press with a finger.
 */
export function useTip() {
  const set = useContext(Ctx);
  return useCallback(
    (content: TipContent | null) => {
      let timer = 0;
      let start = { x: 0, y: 0 };
      const cancel = () => { window.clearTimeout(timer); timer = 0; };
      return {
        onPointerEnter: (e: React.PointerEvent) => { if (e.pointerType === 'mouse' && content) set({ content, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); },
        onPointerLeave: (e: React.PointerEvent) => { if (e.pointerType === 'mouse') set(null); },
        onPointerDown: (e: React.PointerEvent) => {
          if (e.pointerType === 'mouse' || !content) return;
          const el = e.currentTarget as HTMLElement;
          start = { x: e.clientX, y: e.clientY };
          cancel();
          timer = window.setTimeout(() => {
            timer = 0;
            swallowClick = true;
            set({ content, rect: el.getBoundingClientRect() });
            navigator.vibrate?.(8);
          }, LONG_PRESS_MS);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (timer && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
        },
        onPointerUp: cancel,
        onPointerCancel: cancel,
        onClickCapture: (e: React.MouseEvent) => {
          if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); }
        },
        onContextMenu: (e: React.MouseEvent) => { if (lastTouch) e.preventDefault(); },
        onFocus: (e: React.FocusEvent) => { if (!lastTouch && content) set({ content, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }); },
        onBlur: () => { if (!lastTouch) set(null); },
      };
    },
    [set],
  );
}

export function useHideTip() {
  const set = useContext(Ctx);
  return useCallback(() => set(null), [set]);
}
