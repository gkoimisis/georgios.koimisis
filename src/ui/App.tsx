import { useEffect, useState } from 'preact/hooks';
import { config } from '../config';
import { Game } from './screens/Game';
import { Title } from './screens/Title';
import { useGame } from './useGame';

function useSystemDark(): boolean {
  const q = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
  const [dark, setDark] = useState(q?.matches ?? false);
  useEffect(() => {
    if (!q) return;
    const on = () => setDark(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return dark;
}

export function App() {
  const game = useGame();
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const s = game.save.settings;
  const systemDark = useSystemDark();

  useEffect(() => {
    const root = document.documentElement;
    if (s.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = s.theme;
    root.dataset.scheme = s.theme === 'dark' || (s.theme === 'system' && systemDark) ? 'dark' : 'light';
    if (s.highContrast) root.dataset.contrast = 'high';
    else delete root.dataset.contrast;
    if (s.reduceMotion) root.dataset.motion = 'reduce';
    else delete root.dataset.motion;
    root.style.setProperty('--text-scale', String(s.textScale));
    document.title = config.title;
  }, [s, systemDark]);

  if (screen === 'title' || !game.save.run) {
    return (
      <div class="app">
        <Title
          run={game.save.run}
          onContinue={() => setScreen('game')}
          onNew={() => {
            game.newRun();
            setScreen('game');
          }}
        />
      </div>
    );
  }
  return (
    <div class="app">
      <Game game={game} onTitle={() => setScreen('title')} />
    </div>
  );
}
