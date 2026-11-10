import React, { useEffect, useState } from 'react';

// In-page confirmation dialog (native confirm() is blocked in some embeds).
type Req = { msg: string; resolve: (ok: boolean) => void };
let push: ((r: Req) => void) | null = null;

export function askConfirm(msg: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (push) push({ msg, resolve });
    else resolve(true);
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  useEffect(() => {
    push = setReq;
    return () => { push = null; };
  }, []);
  const done = (ok: boolean) => {
    if (!req) return;
    req.resolve(ok);
    setReq(null);
  };
  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); done(false); }
      if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); done(true); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });
  if (!req) return null;
  return (
    <div className="modal-back confirm-back" onClick={() => done(false)}>
      <div className="modal panel small-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Confirm">
        <p className="confirm-msg">{req.msg}</p>
        <div className="confirm-actions">
          <button className="btn" onClick={() => done(false)}>Cancel</button>
          <button className="btn btn-danger" autoFocus onClick={() => done(true)}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
