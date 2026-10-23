/**
 * The game's state machine. `step(engine, state, action)` is pure: it returns a
 * new state and never mutates its input. The UI, the playtest bot, the foil
 * friend and the report card's replays all drive the game through this.
 */
import { fact } from '../content/locale';
import type { Choice, InputSpecT, Scene } from '../content/schema';
import type { GameContent, Locale } from '../content/types';
import { calcFormats, runCalc } from '../finance/calcs';
import { makeFormatter, type Formatter } from '../i18n/format';
import { evaluate } from './conditions';
import { buildIndex, type ContentIndex } from './contentIndex';
import { applyEffects } from './effects';
import { pickWeighted, rand } from './rng';
import { newRunState, type FeedbackData, type MeterDelta, type Notice, type RunState } from './state';
import { advanceMonths } from './tick';
import { emergencyMonths, interpolate, netWorth, relationshipsLevel, resolveRef, totalDebt, wellbeingLevel } from './vars';

export interface Engine {
  content: GameContent;
  idx: ContentIndex;
  locale: Locale;
  fmt: Formatter;
}

export function createEngine(content: GameContent, locale: Locale): Engine {
  return { content, idx: buildIndex(content), locale, fmt: makeFormatter(locale.numberLocale, locale.currency) };
}

export type Action = { type: 'begin' } | { type: 'choose'; choiceId: string } | { type: 'continue' };

export interface StartOptions {
  seed: number;
  backgroundId?: string;
  mode?: 'normal' | 'hard';
}

export function startRun(engine: Engine, opts: StartOptions): RunState {
  const bgs = engine.content.backgrounds;
  const bg = (opts.backgroundId && bgs.find((b) => b.id === opts.backgroundId)) || pickWeighted(bgs, rand(opts.seed, 'background'));
  if (!bg) throw new Error('No backgrounds defined');
  const s = newRunState(opts.seed, bg, opts.mode ?? 'normal');
  if (s.ledger.cardLimit > 0) s.ledger.cardApr = fact(engine.locale, 'typicalCardApr');
  s.timeline.push({ m: 0, nw: Math.round(netWorth(s)) });
  return s;
}

export function currentScene(engine: Engine, s: RunState): Scene | null {
  return s.sceneId ? engine.idx.scenes.get(s.sceneId)?.scene ?? null : null;
}

export function availableChoices(engine: Engine, s: RunState, scene: Scene): Choice[] {
  return scene.choices.filter((c) => evaluate(c.when, s, engine.locale));
}

export function renderText(engine: Engine, s: RunState, text: string): string {
  return interpolate(text, {}, {}, s, engine.locale, engine.fmt);
}

type Snapshot = Record<MeterDelta['key'], number>;

function snapshot(s: RunState): Snapshot {
  return {
    cash: s.ledger.checking + s.ledger.savings,
    savings: s.ledger.savings,
    emergency: emergencyMonths(s),
    debt: totalDebt(s),
    credit: s.creditScore ?? 0,
    wellbeing: wellbeingLevel(s),
    relationships: relationshipsLevel(s),
  };
}

function diff(a: Snapshot, b: Snapshot): MeterDelta[] {
  const min: Snapshot = { cash: 1, savings: 1, emergency: 0.05, debt: 1, credit: 1, wellbeing: 1, relationships: 1 };
  return (Object.keys(a) as MeterDelta['key'][])
    .filter((k) => Math.abs(b[k] - a[k]) >= min[k])
    .map((k) => ({ key: k, before: a[k], after: b[k] }));
}

function resolveInput(spec: InputSpecT, s: RunState, locale: Locale): number {
  if (typeof spec === 'number') return spec;
  if (typeof spec === 'string') return resolveRef(spec, s, locale);
  let v = resolveRef(spec.from, s, locale) * (spec.times ?? 1) + (spec.plus ?? 0);
  if (spec.min !== undefined) v = Math.max(spec.min, v);
  if (spec.max !== undefined) v = Math.min(spec.max, v);
  return v;
}

export function computeWhy(engine: Engine, s: RunState, scene: Scene): FeedbackData['why'] {
  const w = scene.whyItMatters;
  const inputs: Record<string, number> = {};
  let personal = false;
  for (const [k, spec] of Object.entries(w.inputs)) {
    inputs[k] = resolveInput(spec, s, engine.locale);
    const ref = typeof spec === 'string' ? spec : typeof spec === 'object' ? spec.from : '';
    if (ref.startsWith('player.')) personal = true;
  }
  const out = runCalc(w.calc, inputs, { locale: engine.locale, fmt: engine.fmt });
  const formats = calcFormats(w.calc);
  const template = w.variants?.find((v) => evaluate(v.when, s, engine.locale))?.text ?? w.text;
  return {
    text: interpolate(template, out.values, formats, s, engine.locale, engine.fmt),
    formula: out.formula,
    steps: out.steps,
    illustrative: w.illustrative,
    personal,
  };
}

function clone(s: RunState): RunState {
  return structuredClone(s);
}

/** Move the main cursor forward to the next scene whose `when` passes, or end the episode. */
function enterMain(engine: Engine, s: RunState): void {
  const ch = engine.idx.chapters.get(s.chapter);
  const ep = ch?.episodes[s.episode];
  if (!ep) {
    s.phase = 'chapterEnd';
    s.sceneId = null;
    return;
  }
  while (s.sceneIndex < ep.scenes.length) {
    const sc = ep.scenes[s.sceneIndex]!;
    if (evaluate(sc.when, s, engine.locale)) {
      s.sceneId = sc.id;
      s.inInterrupt = false;
      s.phase = 'scene';
      return;
    }
    s.sceneIndex++;
  }
  s.sceneId = null;
  s.phase = 'episodeEnd';
}

function checkCrises(engine: Engine, s: RunState): void {
  for (const c of engine.content.crises) {
    if (s.interrupts.includes(c.scene) || s.sceneId === c.scene) continue;
    const last = [...s.crisisLog].reverse().find((x) => x.id === c.id);
    if (last && s.month - last.month < c.cooldownMonths) continue;
    if (evaluate(c.when, s, engine.locale)) {
      s.crisisLog.push({ id: c.id, month: s.month });
      s.interrupts.unshift(c.scene);
      return; // one crisis at a time
    }
  }
}

function checkCollapse(engine: Engine, s: RunState): boolean {
  const end = engine.content.endings.find((e) => e.kind === 'collapse' && evaluate(e.when, s, engine.locale));
  if (!end) return false;
  s.ending = end.id;
  s.phase = 'ending';
  s.sceneId = null;
  return true;
}

/** After feedback/summary: crises, collapse, interrupts, then the main story. */
function proceed(engine: Engine, s: RunState): void {
  s.inbox = [];
  s.inboxMonths = 0;
  s.feedback = null;
  if (checkCollapse(engine, s)) return;
  checkCrises(engine, s);
  while (s.interrupts.length) {
    const id = s.interrupts.shift()!;
    const ref = engine.idx.scenes.get(id);
    if (ref && evaluate(ref.scene.when, s, engine.locale)) {
      s.sceneId = id;
      s.inInterrupt = true;
      s.phase = 'scene';
      return;
    }
  }
  enterMain(engine, s);
}

function elapse(engine: Engine, s: RunState, months: number): Notice[] {
  return advanceMonths(s, months, engine.content, engine.idx, engine.locale);
}

function choose(engine: Engine, s: RunState, choiceId: string): void {
  const scene = currentScene(engine, s);
  if (s.phase !== 'scene' || !scene) throw new Error(`Cannot choose in phase ${s.phase}`);
  const choice = availableChoices(engine, s, scene).find((c) => c.id === choiceId);
  if (!choice) throw new Error(`Choice ${choiceId} not available in ${scene.id}`);

  const before = snapshot(s);
  const whyBefore = scene.whyItMatters.timing === 'before' ? computeWhy(engine, s, scene) : null;
  const notes = applyEffects(s, choice.effects, engine.locale, { setFlags: choice.setFlags, clearFlags: choice.clearFlags });
  for (const item of choice.schedule ?? []) {
    if (item.inMonths === 0 && item.scene) s.interrupts.push(item.scene);
    else s.scheduled.push({ month: s.month + Math.max(1, item.inMonths), scene: item.scene, event: item.event });
  }
  const ref = engine.idx.scenes.get(scene.id)!;
  s.history.push({ sceneId: scene.id, choiceId, quality: choice.quality, month: s.month, chapter: s.chapter, concepts: scene.concepts });
  if (!s.rules.includes(scene.id)) s.rules.push(scene.id);

  // Move the main cursor now so interrupts can play before the next main scene.
  const target = choice.goto ? engine.idx.scenes.get(choice.goto) : undefined;
  if (target?.origin === 'episode' && !s.inInterrupt) s.sceneIndex = target.index!;
  else if (target) s.interrupts.unshift(target.scene.id);
  if (!target && !s.inInterrupt && ref.origin === 'episode') s.sceneIndex++;

  s.feedback = {
    sceneId: scene.id,
    choiceId,
    quality: choice.quality,
    outcome: renderText(engine, s, choice.outcome),
    deltas: diff(before, snapshot(s)),
    notes,
    explanation: renderText(engine, s, scene.explanation),
    why: whyBefore ?? computeWhy(engine, s, scene),
    takeaway: scene.takeaway,
    bias: choice.bias,
    darkPattern: choice.darkPattern,
  };
  s.phase = 'feedback';
}

export function step(engine: Engine, prev: RunState, action: Action): RunState {
  const s = clone(prev);
  switch (action.type) {
    case 'begin':
      if (s.phase !== 'chapterIntro') throw new Error(`Cannot begin in phase ${s.phase}`);
      enterMain(engine, s);
      return s;
    case 'choose':
      choose(engine, s, action.choiceId);
      return s;
    case 'continue':
      switch (s.phase) {
        case 'feedback': {
          const scene = engine.idx.scenes.get(s.feedback!.sceneId)!.scene;
          const summary = elapse(engine, s, scene.elapse);
          s.feedback = null;
          if (summary.length) {
            s.inbox = summary;
            s.inboxMonths = scene.elapse;
            s.phase = 'summary';
            s.sceneId = null;
          } else proceed(engine, s);
          return s;
        }
        case 'summary':
          proceed(engine, s);
          return s;
        case 'episodeEnd': {
          const ch = engine.idx.chapters.get(s.chapter)!;
          s.episode++;
          s.sceneIndex = 0;
          const next = ch.episodes[s.episode];
          if (!next) {
            s.phase = 'chapterEnd';
            return s;
          }
          const summary = elapse(engine, s, next.gapMonths);
          if (summary.length) {
            s.inbox = summary;
            s.inboxMonths = next.gapMonths;
            s.phase = 'summary';
          } else proceed(engine, s);
          return s;
        }
        case 'chapterEnd': {
          if (engine.idx.chapters.has(s.chapter + 1)) {
            s.chapter++;
            s.episode = 0;
            s.sceneIndex = 0;
            s.phase = 'chapterIntro';
          } else {
            const end = engine.content.endings.find((e) => e.kind === 'milestone' && evaluate(e.when, s, engine.locale));
            s.ending = end?.id ?? null;
            s.phase = 'ending';
          }
          return s;
        }
        default:
          throw new Error(`Cannot continue in phase ${s.phase}`);
      }
  }
}

/** Current episode/chapter metadata for the UI. */
export function currentEpisode(engine: Engine, s: RunState) {
  return engine.idx.chapters.get(s.chapter)?.episodes[s.episode] ?? null;
}

export function currentChapter(engine: Engine, s: RunState) {
  return engine.idx.chapters.get(s.chapter) ?? null;
}
