import React, { useEffect, useState } from 'react';
import { useGameStore } from './store';
import { TooltipProvider } from './tooltip';
import { MainMenu } from './screens/MainMenu';
import { NewRunScreen } from './screens/NewRun';
import { ChallengesScreen } from './screens/Challenges';
import { CollectionScreen } from './screens/Collection';
import { StatsScreen } from './screens/Stats';
import { SettingsScreen } from './screens/Settings';
import { GameScreen } from './game/GameScreen';
import { audio } from '../audio/audio';

export type Screen = 'menu' | 'newRun' | 'challenges' | 'collection' | 'stats' | 'settings' | 'game';

export function App() {
  const store = useGameStore();
  const [screen, setScreen] = useState<Screen>('menu');
  const [settingsBack, setSettingsBack] = useState<Screen>('menu');

  // Unlock audio on first interaction (browsers require a gesture).
  useEffect(() => {
    const unlock = () => { audio.ensure(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    audio.intensity = store.run?.round?.blindType === 'boss' ? 1 : 0;
  }, [store.run?.round?.blindType]);

  // Debug/testing hook (only with ?debug in the URL).
  useEffect(() => {
    if (typeof location !== 'undefined' && location.search.includes('debug')) {
      (window as unknown as Record<string, unknown>).__rf = { get run() { return store.run; }, set: (r: unknown) => store.commit(r as never), store };
    }
  });

  const go = (s: Screen) => {
    store.sfx('select');
    if (s === 'settings') setSettingsBack(screen);
    setScreen(s);
  };

  return (
    <TooltipProvider>
      <div className="app-root">
        <div className="felt-bg" aria-hidden />
        {screen === 'menu' && <MainMenu store={store} go={go} />}
        {screen === 'newRun' && <NewRunScreen store={store} go={go} />}
        {screen === 'challenges' && <ChallengesScreen store={store} go={go} />}
        {screen === 'collection' && <CollectionScreen store={store} go={go} />}
        {screen === 'stats' && <StatsScreen store={store} go={go} />}
        {screen === 'settings' && <SettingsScreen store={store} back={() => go(settingsBack)} />}
        {screen === 'game' && store.run && <GameScreen store={store} go={go} />}
        {screen === 'game' && !store.run && <MainMenu store={store} go={go} />}
        <div className="toasts" aria-live="polite">
          {store.toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
          ))}
        </div>
        <div className="crt-overlay" aria-hidden />
      </div>
    </TooltipProvider>
  );
}
