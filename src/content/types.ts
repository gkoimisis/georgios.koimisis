import type {
  Background, Chapter, Character, Concept, Crisis, Ending, EventDeck, Fact, Scene,
} from './schema';

/** All validated game content, as bundled into the app. */
export interface GameContent {
  chapters: Chapter[];
  decks: EventDeck[];
  crises: Crisis[];
  crisisScenes: Scene[];
  endings: Ending[];
  characters: Character[];
  backgrounds: Background[];
  concepts: Concept[];
}

export interface Locale {
  id: string;
  name: string;
  currency: string;
  numberLocale: string;
  facts: Record<string, Fact>;
}

export type SceneOrigin = 'episode' | 'interlude' | 'deck' | 'crisis';

export interface SceneRef {
  scene: Scene;
  chapter: number;
  origin: SceneOrigin;
  episode: number | null;
  index: number | null;
}
