import type { GameEvent, Scene } from '../content/schema';
import type { GameContent, SceneRef } from '../content/types';

export interface ContentIndex {
  scenes: Map<string, SceneRef>;
  events: Map<string, GameEvent>;
  chapters: Map<number, GameContent['chapters'][number]>;
}

export function buildIndex(content: GameContent): ContentIndex {
  const scenes = new Map<string, SceneRef>();
  const add = (scene: Scene, ref: Omit<SceneRef, 'scene'>) => {
    if (scenes.has(scene.id)) throw new Error(`Duplicate scene id: ${scene.id}`);
    scenes.set(scene.id, { scene, ...ref });
  };
  const chapters = new Map<number, GameContent['chapters'][number]>();
  for (const ch of content.chapters) {
    chapters.set(ch.chapter, ch);
    ch.episodes.forEach((ep, e) => ep.scenes.forEach((sc, i) => add(sc, { chapter: ch.chapter, origin: 'episode', episode: e, index: i })));
    for (const sc of ch.interludes) add(sc, { chapter: ch.chapter, origin: 'interlude', episode: null, index: null });
  }
  const events = new Map<string, GameEvent>();
  for (const deck of content.decks) {
    for (const sc of deck.scenes) add(sc, { chapter: deck.chapters[0]!, origin: 'deck', episode: null, index: null });
    for (const ev of deck.events) {
      if (events.has(ev.id)) throw new Error(`Duplicate event id: ${ev.id}`);
      events.set(ev.id, ev);
    }
  }
  for (const sc of content.crisisScenes) add(sc, { chapter: 0, origin: 'crisis', episode: null, index: null });
  return { scenes, events, chapters };
}
