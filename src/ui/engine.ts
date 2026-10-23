import data from 'virtual:compound-content';
import { createEngine } from '../engine/step';

/** The single engine instance for the app, built from bundled content. */
export const engine = createEngine(data.content, data.locale);
export const fmt = engine.fmt;

export function characterOf(id: string) {
  return engine.content.characters.find((c) => c.id === id);
}

export function conceptOf(id: string) {
  return engine.content.concepts.find((c) => c.id === id);
}

export function sceneTitle(id: string): string {
  const sc = engine.idx.scenes.get(id)?.scene;
  return sc?.title ?? id;
}
