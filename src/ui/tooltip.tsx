import React, { createContext, useCallback, useContext, useLayoutEffect, useRef, useState } from 'react';

export interface TipContent {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  body?: React.ReactNode;
  tags?: { label: string; color?: string }[];
  accent?: string;
}

interface TipState { content: TipContent; rect: DOMRect }

const Ctx = createContext<(s: TipState | null) => void>(() => {});

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
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

/** Spread onto any element to show a tooltip while hovered or focused. */
export function useTip() {
  const set = useContext(Ctx);
  return useCallback(
    (content: TipContent | null) => ({
      onMouseEnter: (e: React.MouseEvent) => content && set({ content, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }),
      onMouseLeave: () => set(null),
      onFocus: (e: React.FocusEvent) => content && set({ content, rect: (e.currentTarget as HTMLElement).getBoundingClientRect() }),
      onBlur: () => set(null),
    }),
    [set],
  );
}

export function useHideTip() {
  const set = useContext(Ctx);
  return useCallback(() => set(null), [set]);
}
