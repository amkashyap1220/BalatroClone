import React from 'react';
import { askConfirm } from '../confirm';
import type { GameStore } from '../store';
import { resetAll } from '../../engine/save';
import { newProfile } from '../../engine/progression';

export function SettingsScreen({ store, back }: { store: GameStore; back: () => void }) {
  const s = store.settings;
  const set = (patch: Partial<typeof s>) => store.setSettings({ ...s, ...patch });
  const slider = (key: 'master' | 'music' | 'sfx', label: string) => (
    <label className="setting">
      <span>{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => set({ [key]: parseFloat(e.target.value) })} />
      <b>{Math.round(s[key] * 100)}%</b>
    </label>
  );
  const toggle = (key: 'muted' | 'crt' | 'reduceMotion' | 'fourColor' | 'confirmSell', label: string, hint?: string) => (
    <label className="setting toggle">
      <span>{label}{hint && <small>{hint}</small>}</span>
      <input type="checkbox" checked={s[key]} onChange={(e) => set({ [key]: e.target.checked })} />
    </label>
  );
  return (
    <div className="page">
      <header className="page-head">
        <button className="btn btn-back" onClick={back}>← Back</button>
        <h2>Settings</h2>
      </header>
      <div className="settings-layout">
        <section className="panel">
          <h3>Audio</h3>
          {slider('master', 'Master volume')}
          {slider('music', 'Music')}
          {slider('sfx', 'Sound effects')}
          {toggle('muted', 'Mute all')}
          <button className="btn" onClick={() => store.sfx('roundWin')}>Test sound</button>
        </section>
        <section className="panel">
          <h3>Gameplay</h3>
          <label className="setting">
            <span>Scoring speed</span>
            <div className="seg">
              {[1, 2, 4].map((v) => (<button key={v} className={`chip ${s.speed === v ? 'active' : ''}`} onClick={() => set({ speed: v })}>{v}×</button>))}
            </div>
          </label>
          {toggle('confirmSell', 'Confirm before selling')}
        </section>
        <section className="panel">
          <h3>Display & accessibility</h3>
          {toggle('crt', 'Retro scanlines', 'Subtle CRT overlay')}
          {toggle('reduceMotion', 'Reduce motion', 'Fewer animations and no screen shake')}
          {toggle('fourColor', 'Four-colour suits', 'Diamonds blue, Clubs green')}
        </section>
        <section className="panel danger">
          <h3>Data</h3>
          <p className="muted">Progress is stored in this browser.</p>
          <button className="btn btn-danger" onClick={() => {
            askConfirm('Erase all progress, unlocks and the saved run? This cannot be undone.').then((ok) => {
              if (!ok) return;
              resetAll();
              store.setProfile(newProfile());
              store.clearSaved();
              store.toast('Progress reset.');
            });
          }}>Reset all progress</button>
        </section>
      </div>
    </div>
  );
}
