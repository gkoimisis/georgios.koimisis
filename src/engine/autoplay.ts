/** Headless play: policies that pick choices, and a runner that drives `step`. */
import type { Choice, QualityT, Scene } from '../content/schema';
import { rand } from './rng';
import type { RunState } from './state';
import { availableChoices, currentScene, step, type Engine } from './step';

export type Policy = (scene: Scene, choices: Choice[], s: RunState) => Choice;

const RANK: Record<QualityT, number> = { best: 3, good: 2, risky: 1, costly: 0 };

export const bestPolicy: Policy = (_sc, choices) => [...choices].sort((a, b) => RANK[b.quality] - RANK[a.quality])[0]!;
export const worstPolicy: Policy = (_sc, choices) => [...choices].sort((a, b) => RANK[a.quality] - RANK[b.quality])[0]!;
/** The foil friend takes the tempting option, or else the worst one. */
export const foilPolicy: Policy = (sc, choices, s) => choices.find((c) => c.tempting) ?? worstPolicy(sc, choices, s);

export function randomPolicy(seed: number): Policy {
  let n = 0;
  return (_sc, choices) => choices[Math.floor(rand(seed, 'policy', n++) * choices.length)]!;
}

/**
 * Replays recorded choices (matched by scene and occurrence), with optional overrides.
 * Scenes the record never saw fall back to `fallback`.
 */
export function replayPolicy(record: { sceneId: string; choiceId: string }[], fallback: Policy, override?: Map<string, string>): Policy {
  const byKey = new Map<string, string>();
  const seenRecord = new Map<string, number>();
  for (const r of record) {
    const k = (seenRecord.get(r.sceneId) ?? 0) + 1;
    seenRecord.set(r.sceneId, k);
    byKey.set(`${r.sceneId}#${k}`, r.choiceId);
  }
  const seen = new Map<string, number>();
  return (sc, choices, s) => {
    const k = (seen.get(sc.id) ?? 0) + 1;
    seen.set(sc.id, k);
    const key = `${sc.id}#${k}`;
    const want = override?.get(key) ?? byKey.get(key);
    return choices.find((c) => c.id === want) ?? fallback(sc, choices, s);
  };
}

export interface AutoplayResult {
  state: RunState;
  steps: number;
}

/** Drive the game until `stop` returns true, an ending, or `maxSteps`. */
export function autoplay(
  engine: Engine,
  start: RunState,
  policy: Policy,
  stop: (s: RunState) => boolean,
  maxSteps = 5000,
  onStep?: (s: RunState) => void,
): AutoplayResult {
  let s = start;
  let steps = 0;
  while (!stop(s) && s.phase !== 'ending') {
    if (steps++ >= maxSteps) throw new Error(`autoplay exceeded ${maxSteps} steps (phase ${s.phase}, scene ${s.sceneId})`);
    if (s.phase === 'chapterIntro') s = step(engine, s, { type: 'begin' });
    else if (s.phase === 'scene') {
      const sc = currentScene(engine, s);
      if (!sc) throw new Error(`dead end: scene ${s.sceneId} not found`);
      const choices = availableChoices(engine, s, sc);
      if (!choices.length) throw new Error(`dead end: no available choices in ${sc.id}`);
      s = step(engine, s, { type: 'choose', choiceId: policy(sc, choices, s).id });
    } else s = step(engine, s, { type: 'continue' });
    onStep?.(s);
  }
  return { state: s, steps };
}

/** Stop condition: the end of the given chapter (report card) or later. */
export const atChapterEnd = (chapter: number) => (s: RunState) =>
  (s.phase === 'chapterEnd' && s.chapter === chapter) || s.chapter > chapter;
