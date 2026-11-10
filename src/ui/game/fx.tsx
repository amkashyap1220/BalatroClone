import React, { useCallback, useState } from 'react';

// Registry of on-screen elements by game id (card id / charm uid) so effects can find them.
const els = new Map<string, HTMLElement>();
export function reg(id: string) {
  return (el: HTMLElement | null) => {
    if (el) els.set(id, el);
    else if (els.get(id) && !els.get(id)!.isConnected) els.delete(id);
  };
}
export function elRect(id: string | null): DOMRect | null {
  if (!id) return null;
  const el = els.get(id);
  return el && el.isConnected ? el.getBoundingClientRect() : null;
}

export interface Popup { id: number; x: number; y: number; text: string; kind: string }
let pid = 0;

export function usePopups() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const spawn = useCallback((source: string | null, text: string, kind: string, fallback?: { x: number; y: number }) => {
    const r = elRect(source);
    const x = r ? r.left + r.width / 2 : fallback?.x ?? window.innerWidth / 2;
    const y = r ? r.top + 6 : fallback?.y ?? window.innerHeight / 2;
    const id = ++pid;
    setPopups((p) => [...p.slice(-14), { id, x, y, text, kind }]);
    window.setTimeout(() => setPopups((p) => p.filter((q) => q.id !== id)), 1100);
  }, []);
  return { popups, spawn };
}

export function PopupLayer({ popups }: { popups: Popup[] }) {
  return (
    <div className="popup-layer" aria-hidden>
      {popups.map((p) => (
        <div key={p.id} className={`popup popup-${p.kind}`} style={{ left: p.x, top: p.y }}>{p.text}</div>
      ))}
    </div>
  );
}

export function Confetti({ count = 80 }: { count?: number }) {
  const colors = ['#ff3d7f', '#3de1ff', '#ffd23f', '#7cff6b', '#b46cff', '#fff'];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{
          left: `${Math.random() * 100}%`, background: colors[i % colors.length], animationDelay: `${Math.random() * 1.5}s`,
          animationDuration: `${2.5 + Math.random() * 2}s`, transform: `rotate(${Math.random() * 360}deg)`,
        }} />
      ))}
    </div>
  );
}

export function useCountUp(target: number, ms = 600) {
  const [val, setVal] = useState(target);
  const ref = React.useRef({ from: target, start: 0, target });
  React.useEffect(() => {
    const st = ref.current;
    if (st.target === target) return;
    st.from = val;
    st.target = target;
    st.start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - st.start) / ms);
      const e = 1 - Math.pow(1 - t, 3);
      setVal(st.from + (target - st.from) * e);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, ms]);
  return val;
}
