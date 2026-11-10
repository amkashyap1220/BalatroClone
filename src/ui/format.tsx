import React from 'react';

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a >= 1e11) return n.toExponential(2).replace('e+', 'e');
  return Math.floor(n).toLocaleString('en-US');
}

export function fmtMult(n: number): string {
  if (n >= 1e9) return n.toExponential(2).replace('e+', 'e');
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return (Math.round(n * 100) / 100).toLocaleString('en-US');
}

const TOKEN = /(×\s?[\d.]+\s?Mult|[+-−]?\d+(?:\.\d+)?\s?Mult|[+-−]?\d+\s?Chips|[+-−]?\$\d+|\b\d+ in \d+\b|\b(?:Hearts?|Diamonds?|Spades?|Clubs?)\b)/g;

/** Highlights game terms inside descriptions: chips blue, mult red, ×mult magenta, money gold. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(TOKEN);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (/^×/.test(p)) return <span key={i} className="t-xmult">{p}</span>;
        if (/Mult$/.test(p)) return <span key={i} className="t-mult">{p}</span>;
        if (/Chips$/.test(p)) return <span key={i} className="t-chips">{p}</span>;
        if (/\$/.test(p)) return <span key={i} className="t-money">{p}</span>;
        if (/ in /.test(p)) return <span key={i} className="t-chance">{p}</span>;
        if (/Heart/.test(p) || /Diamond/.test(p)) return <span key={i} className="t-red">{p}</span>;
        if (/Spade/.test(p) || /Club/.test(p)) return <span key={i} className="t-black">{p}</span>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
      })}
    </>
  );
}
