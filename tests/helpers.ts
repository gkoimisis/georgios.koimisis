import { loadAll } from '../src/content/load';
import { createEngine } from '../src/engine/step';

export const loaded = loadAll();
export const engine = createEngine(loaded.content, loaded.locale);
