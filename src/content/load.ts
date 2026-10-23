/**
 * Node-only content loader: reads /content and /locales, parses YAML and
 * validates every file against the zod schemas. Used by the Vite plugin,
 * scripts and tests — never bundled into the app.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'yaml';
import { z } from 'zod';
import {
  BackgroundSchema, ChapterSchema, CharacterSchema, ConceptSchema, CrisesFileSchema, EndingSchema, EventDeckSchema, LocaleSchema,
} from './schema';
import type { GameContent, Locale } from './types';

export interface LoadResult {
  content: GameContent;
  locale: Locale;
  /** Schema and YAML errors, prefixed with the file path. */
  errors: string[];
  files: string[];
}

function formatZod(file: string, err: z.ZodError): string[] {
  return err.issues.map((i) => `${file}: ${i.path.join('.') || '(root)'}: ${i.message}`);
}

export function loadAll(root = process.cwd(), localeId = 'us'): LoadResult {
  const errors: string[] = [];
  const files: string[] = [];

  function read<T>(path: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>, fallback: T): T {
    const rel = relative(root, path);
    files.push(path);
    let raw: unknown;
    try {
      raw = parse(readFileSync(path, 'utf8'), { prettyErrors: true });
    } catch (e) {
      errors.push(`${rel}: YAML error: ${(e as Error).message}`);
      return fallback;
    }
    const r = schema.safeParse(raw);
    if (!r.success) {
      errors.push(...formatZod(rel, r.error));
      return fallback;
    }
    return r.data;
  }

  const dir = (p: string) =>
    existsSync(join(root, p))
      ? readdirSync(join(root, p)).filter((f) => f.endsWith('.yaml') || f.endsWith('.yml')).sort().map((f) => join(root, p, f))
      : [];

  const chapters = dir('content/chapters')
    .map((f) => read(f, ChapterSchema, null as never))
    .filter(Boolean)
    .sort((a, b) => a.chapter - b.chapter);
  const decks = dir('content/events').map((f) => read(f, EventDeckSchema, null as never)).filter(Boolean);
  const c = (name: string) => join(root, 'content', name);
  const crises = read(c('crises.yaml'), CrisesFileSchema, { crises: [], scenes: [] });
  const endings = read(c('endings.yaml'), z.object({ endings: z.array(EndingSchema) }).strict(), { endings: [] }).endings;
  const characters = read(c('characters.yaml'), z.object({ characters: z.array(CharacterSchema) }).strict(), { characters: [] }).characters;
  const backgrounds = read(c('backgrounds.yaml'), z.object({ backgrounds: z.array(BackgroundSchema).min(1) }).strict(), { backgrounds: [] }).backgrounds;
  const concepts = read(c('concepts.yaml'), z.object({ concepts: z.array(ConceptSchema) }).strict(), { concepts: [] }).concepts;
  const locale = read(join(root, 'locales', `${localeId}.yaml`), LocaleSchema, {
    id: localeId, name: localeId, currency: 'USD', numberLocale: 'en-US', facts: {},
  });

  return {
    content: { chapters, decks, crises: crises.crises, crisisScenes: crises.scenes, endings, characters, backgrounds, concepts },
    locale,
    errors,
    files,
  };
}
