/** App state: the save file, persisted after every change, plus game actions. */
import { useCallback, useState } from 'preact/hooks';
import { randomSeed } from '../engine/rng';
import { step, startRun, type Action } from '../engine/step';
import { emptySave, exportCode, importCode, loadSave, storageAvailable, writeSave, type SaveFile, type Settings } from '../save/storage';
import { engine } from './engine';

export interface Game {
  save: SaveFile;
  /** True if this browser can persist saves. */
  persistent: boolean;
  /** Whether the last decision added a new Money Rule to the collection. */
  lastRuleNew: boolean;
  act(action: Action): void;
  newRun(): void;
  rewind(): void;
  setSettings(patch: Partial<Settings>): void;
  exportSave(): string;
  importSave(code: string): boolean;
}

export function useGame(): Game {
  const [save, setSave] = useState<SaveFile>(() => loadSave());
  const [persistent] = useState(() => storageAvailable());
  const [lastRuleNew, setLastRuleNew] = useState(false);

  const update = useCallback((fn: (s: SaveFile) => SaveFile) => {
    setSave((prev) => {
      const next = fn(prev);
      writeSave(next);
      return next;
    });
  }, []);

  const act = useCallback(
    (action: Action) =>
      update((sv) => {
        if (!sv.run) return sv;
        let run;
        try {
          run = step(engine, sv.run, action);
        } catch (e) {
          console.error(e);
          return sv;
        }
        let { chapterStart, profile } = sv;
        if (run.phase === 'chapterIntro' && sv.run.phase !== 'chapterIntro') chapterStart = run;
        if (action.type === 'choose' && run.feedback) {
          const id = run.feedback.sceneId;
          const isNew = !profile.rules.includes(id);
          setLastRuleNew(isNew);
          if (isNew) profile = { ...profile, rules: [...profile.rules, id] };
        }
        return { ...sv, run, chapterStart, profile };
      }),
    [update],
  );

  const newRun = useCallback(
    () =>
      update((sv) => {
        const run = startRun(engine, { seed: randomSeed() });
        return { ...sv, run, chapterStart: run, profile: { ...sv.profile, runsStarted: sv.profile.runsStarted + 1 } };
      }),
    [update],
  );

  const rewind = useCallback(
    () => update((sv) => (sv.chapterStart ? { ...sv, run: structuredClone(sv.chapterStart) } : sv)),
    [update],
  );

  const setSettings = useCallback((patch: Partial<Settings>) => update((sv) => ({ ...sv, settings: { ...sv.settings, ...patch } })), [update]);

  const exportSave = useCallback(() => exportCode(save), [save]);

  const importSave = useCallback(
    (code: string) => {
      const loaded = importCode(code);
      if (!loaded) return false;
      update(() => ({ ...emptySave(), ...loaded }));
      return true;
    },
    [update],
  );

  return { save, persistent, lastRuleNew, act, newRun, rewind, setSettings, exportSave, importSave };
}
