/**
 * Cross-file content checks that a schema can't express: references, calc
 * inputs, placeholders, word limits, readability and concept coverage.
 */
import { CALCS, calcFormats } from '../finance/calcs';
import { buildIndex } from '../engine/contentIndex';
import { isKnownRef, placeholders } from '../engine/vars';
import type { Condition, Scene } from './schema';
import type { GameContent, Locale, SceneRef } from './types';
import { readability, wordCount } from './readability';

export const MAX_EXPLANATION_WORDS = 80;
export const READABILITY_GRADE_WARN = 10;
/** Flags the engine itself reads or that backgrounds set. */
const ENGINE_FLAGS = ['has-card', 'carries-balance', 'wants-on-card', 'hysa', 'linked-savings', 'overdraft-opt-out', 'student', 'family-safety-net'];

export interface CoverageRow {
  id: string;
  name: string;
  kind: string;
  scenes: number;
  contexts: number;
  chapters: number[];
  /** Coverage rules apply once every chapter this concept belongs to exists. */
  enforced: boolean;
}

export interface ValidationReport {
  errors: string[];
  warnings: string[];
  coverage: CoverageRow[];
  readability: { id: string; grade: number }[];
  stats: { scenes: number; chapters: number; events: number; decisionsPerChapter: Record<number, number> };
}

function conditionRefs(c: Condition | undefined, out: { vars: string[]; flags: string[] }): void {
  if (!c) return;
  if (c.var) out.vars.push(c.var);
  for (const f of [c.flag, c.notFlag, ...(c.anyFlag ?? [])]) if (f) out.flags.push(f);
  for (const x of [...(c.all ?? []), ...(c.any ?? []), ...(c.not ? [c.not] : [])]) conditionRefs(x, out);
}

function contextOf(ref: SceneRef): string {
  if (ref.origin === 'episode') return `ch${ref.chapter}-e${ref.episode}`;
  return `${ref.origin}-ch${ref.chapter}`;
}

export function validateContent(content: GameContent, locale: Locale): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const read: ValidationReport['readability'] = [];

  let idx;
  try {
    idx = buildIndex(content);
  } catch (e) {
    return { errors: [(e as Error).message], warnings, coverage: [], readability: read, stats: { scenes: 0, chapters: 0, events: 0, decisionsPerChapter: {} } };
  }

  const concepts = new Map(content.concepts.map((c) => [c.id, c]));
  const characters = new Set([...content.characters.map((c) => c.id), 'you']);
  const flagsSet = new Set<string>(ENGINE_FLAGS);
  const flagsRead: { flag: string; where: string }[] = [];
  const unique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`Duplicate ${what} id: ${id}`);
      seen.add(id);
    }
  };
  unique(content.concepts.map((c) => c.id), 'concept');
  unique(content.characters.map((c) => c.id), 'character');
  unique(content.backgrounds.map((c) => c.id), 'background');
  unique(content.endings.map((c) => c.id), 'ending');
  unique(content.crises.map((c) => c.id), 'crisis');

  for (const b of content.backgrounds) b.start.flags.forEach((f) => flagsSet.add(f));

  const checkCondition = (c: Condition | undefined, where: string) => {
    const refs = { vars: [] as string[], flags: [] as string[] };
    conditionRefs(c, refs);
    for (const v of refs.vars) if (!isKnownRef(v, locale)) errors.push(`${where}: unknown variable ${v}`);
    for (const f of refs.flags) flagsRead.push({ flag: f, where });
  };
  const checkText = (text: string, where: string) => {
    for (const p of placeholders(text)) {
      if (!p.includes('.')) errors.push(`${where}: placeholder {${p}} needs a player./locale. prefix here`);
      else if (!isKnownRef(p, locale)) errors.push(`${where}: unknown placeholder {${p}}`);
    }
  };
  const checkMessages = (msgs: { from: string; text: string }[] | undefined, where: string) => {
    for (const m of msgs ?? []) {
      if (!characters.has(m.from)) errors.push(`${where}: unknown character "${m.from}"`);
      checkText(m.text, where);
    }
  };
  const checkConceptTag = (id: string, kinds: string[], where: string) => {
    const c = concepts.get(id);
    if (!c) errors.push(`${where}: unknown concept "${id}"`);
    else if (!kinds.includes(c.kind)) errors.push(`${where}: "${id}" is a ${c.kind}, expected ${kinds.join('/')}`);
  };
  const checkSchedule = (items: { scene?: string; event?: string }[] | undefined, where: string) => {
    for (const s of items ?? []) {
      if (s.scene && !idx.scenes.has(s.scene)) errors.push(`${where}: schedules unknown scene ${s.scene}`);
      if (s.event && !idx.events.has(s.event)) errors.push(`${where}: schedules unknown event ${s.event}`);
    }
  };

  // Scenes
  const conceptScenes = new Map<string, Set<string>>();
  const conceptContexts = new Map<string, Set<string>>();
  const tag = (concept: string, sceneId: string, ctx: string) => {
    if (!conceptScenes.has(concept)) conceptScenes.set(concept, new Set());
    if (!conceptContexts.has(concept)) conceptContexts.set(concept, new Set());
    conceptScenes.get(concept)!.add(sceneId);
    conceptContexts.get(concept)!.add(ctx);
  };
  const referencedScenes = new Set<string>();

  for (const [id, ref] of idx.scenes) {
    const sc: Scene = ref.scene;
    const w = `scene ${id}`;
    const ctx = contextOf(ref);
    for (const c of sc.concepts) {
      if (!concepts.has(c)) errors.push(`${w}: unknown concept "${c}"`);
      tag(c, id, ctx);
    }
    checkCondition(sc.when, w);
    checkMessages(sc.texts, w);
    checkText(sc.setup, `${w} setup`);
    checkText(sc.explanation, `${w} explanation`);

    const words = wordCount(sc.explanation);
    if (words > MAX_EXPLANATION_WORDS) errors.push(`${w}: explanation is ${words} words (max ${MAX_EXPLANATION_WORDS})`);
    const r = readability(sc.explanation);
    read.push({ id, grade: r.grade });
    if (r.grade > READABILITY_GRADE_WARN + 2) warnings.push(`${w}: explanation reads at grade ${r.grade}`);
    if ((sc.takeaway.match(/[.!?](\s|$)/g) ?? []).length > 1) warnings.push(`${w}: takeaway should be one sentence`);

    const ids = sc.choices.map((c) => c.id);
    if (new Set(ids).size !== ids.length) errors.push(`${w}: duplicate choice ids`);
    if (!sc.choices.some((c) => c.quality === 'best' || c.quality === 'good')) errors.push(`${w}: needs at least one best/good choice`);
    if (!sc.choices.some((c) => !c.when)) errors.push(`${w}: at least one choice must always be available`);
    if (!sc.choices.some((c) => c.tempting) && ref.origin !== 'crisis') warnings.push(`${w}: no tempting choice for the foil friend`);
    if (new Set(sc.review.options).size !== sc.review.options.length) errors.push(`${w}: review options must be distinct`);
    const statInputs = Object.values(sc.whyItMatters.inputs).filter(
      (v) => typeof v === 'string' && v.startsWith('locale.') && locale.facts[v.slice(7)]?.kind === 'statistic',
    );
    if (!sc.whyItMatters.illustrative && statInputs.length && sc.sources.length === 0) {
      warnings.push(`${w}: uses real statistics (${statInputs.join(', ')}) — add sources or mark illustrative`);
    }
    if (sc.needsVerification && sc.sources.length === 0) warnings.push(`${w}: needsVerification but no sources listed`);

    for (const ch of sc.choices) {
      const cw = `${w} choice ${ch.id}`;
      checkCondition(ch.when, cw);
      checkText(ch.outcome, `${cw} outcome`);
      (ch.setFlags ?? []).forEach((f) => flagsSet.add(f));
      checkSchedule(ch.schedule, cw);
      (ch.schedule ?? []).forEach((s) => s.scene && referencedScenes.add(s.scene));
      if (ch.goto) {
        const t = idx.scenes.get(ch.goto);
        referencedScenes.add(ch.goto);
        if (!t) errors.push(`${cw}: goto unknown scene ${ch.goto}`);
        else if (t.origin === 'episode' && (ref.origin !== 'episode' || t.chapter !== ref.chapter || t.episode !== ref.episode || t.index! <= ref.index!)) {
          errors.push(`${cw}: goto must target a later scene in the same episode, or an interlude`);
        }
      }
      if (ch.bias) {
        checkConceptTag(ch.bias.id, ['bias'], cw);
        tag(ch.bias.id, id, ctx);
      }
      if (ch.darkPattern) {
        checkConceptTag(ch.darkPattern.id, ['dark-pattern', 'scam'], cw);
        tag(ch.darkPattern.id, id, ctx);
      }
    }

    // Why it matters
    const why = sc.whyItMatters;
    const def = CALCS[why.calc];
    if (!def) errors.push(`${w}: unknown calc "${why.calc}"`);
    else {
      for (const [k, spec] of Object.entries(def.inputs)) {
        if (spec.default === undefined && !(k in why.inputs)) errors.push(`${w}: calc ${why.calc} needs input "${k}"`);
      }
      for (const [k, v] of Object.entries(why.inputs)) {
        if (!(k in def.inputs)) errors.push(`${w}: calc ${why.calc} has no input "${k}"`);
        const refStr = typeof v === 'string' ? v : typeof v === 'object' ? v.from : null;
        if (refStr && !isKnownRef(refStr, locale)) errors.push(`${w}: unknown input reference ${refStr}`);
      }
      const formats = calcFormats(why.calc);
      (why.variants ?? []).forEach((v, i) => checkCondition(v.when, `${w} whyItMatters variant ${i}`));
      for (const p of [why.text, ...(why.variants ?? []).map((v) => v.text)].flatMap(placeholders)) {
        if (p.includes('.')) {
          if (!isKnownRef(p, locale)) errors.push(`${w} whyItMatters: unknown placeholder {${p}}`);
        } else if (!(p in formats)) errors.push(`${w} whyItMatters: {${p}} is not an input or output of ${why.calc}`);
      }
    }
  }

  // Chapters and episodes
  const decisionsPerChapter: Record<number, number> = {};
  for (const ch of content.chapters) {
    const w = `chapter ${ch.chapter}`;
    if (ch.episodes.length < 3 || ch.episodes.length > 4) warnings.push(`${w}: has ${ch.episodes.length} episodes (target 3-4)`);
    let decisions = 0;
    for (const ep of ch.episodes) {
      // Scenes gated by mutually exclusive conditions count once: count distinct titles.
      const n = new Set(ep.scenes.map((s) => s.title ?? s.id)).size;
      decisions += n;
      if (n < 4 || n > 6) warnings.push(`${w} ${ep.id}: ${n} decisions (target 4-6)`);
      checkMessages(ep.hook.texts, `${ep.id} hook`);
    }
    decisionsPerChapter[ch.chapter] = decisions;
    if (decisions < 15 || decisions > 20) warnings.push(`${w}: ${decisions} decisions (target 15-20)`);
    if (!ch.episodes.some((ep) => ep.scenes.some((s) => s.boss))) warnings.push(`${w}: no boss decision`);
  }

  // Events, crises, endings
  for (const deck of content.decks) {
    for (const ev of deck.events) {
      const w = `event ${ev.id}`;
      checkCondition(ev.when, w);
      ev.concepts.forEach((c) => !concepts.has(c) && errors.push(`${w}: unknown concept "${c}"`));
      (ev.setFlags ?? []).forEach((f) => flagsSet.add(f));
      checkSchedule(ev.schedule, w);
      if (ev.scene) {
        referencedScenes.add(ev.scene);
        if (!deck.scenes.some((s) => s.id === ev.scene)) errors.push(`${w}: scene ${ev.scene} must be in the same deck's scenes`);
      }
    }
    if (!deck.chapters.every((c) => content.chapters.some((ch) => ch.chapter === c))) warnings.push(`deck ${deck.id}: lists a chapter that doesn't exist yet`);
  }
  for (const cr of content.crises) {
    checkCondition(cr.when, `crisis ${cr.id}`);
    referencedScenes.add(cr.scene);
    if (!content.crisisScenes.some((s) => s.id === cr.scene)) errors.push(`crisis ${cr.id}: unknown scene ${cr.scene}`);
  }
  for (const e of content.endings) checkCondition(e.when, `ending ${e.id}`);
  if (!content.endings.some((e) => e.kind === 'milestone' && !e.when)) errors.push('endings: need a milestone ending with no condition (the fallback)');
  if (!content.endings.some((e) => e.kind === 'collapse')) warnings.push('endings: no collapse ending defined');

  for (const [id, ref] of idx.scenes) {
    if (ref.origin !== 'episode' && !referencedScenes.has(id)) errors.push(`scene ${id}: unreachable (nothing schedules, gotos or triggers it)`);
  }
  for (const { flag, where } of flagsRead) if (!flagsSet.has(flag)) errors.push(`${where}: reads flag "${flag}" that nothing sets`);

  // Coverage
  const chapterSet = new Set(content.chapters.map((c) => c.chapter));
  const coverage: CoverageRow[] = content.concepts.map((c) => {
    const scenes = conceptScenes.get(c.id)?.size ?? 0;
    const contexts = conceptContexts.get(c.id)?.size ?? 0;
    const enforced = c.chapters.every((n) => chapterSet.has(n));
    return { id: c.id, name: c.name, kind: c.kind, scenes, contexts, chapters: c.chapters, enforced };
  });
  for (const row of coverage) {
    const ok = row.scenes >= 3 && row.contexts >= 2;
    if (ok) continue;
    const msg = `concept ${row.id}: ${row.scenes} scene(s) in ${row.contexts} context(s) (need 3+ scenes in 2+ contexts)`;
    if (row.enforced) errors.push(msg);
    else if (row.scenes > 0) warnings.push(`${msg} — chapters ${row.chapters.join(', ')} not all written yet`);
  }
  for (const c of content.concepts.filter((x) => x.bigFive)) {
    const scenes = [...(conceptScenes.get(c.id) ?? [])].map((s) => idx.scenes.get(s)!.chapter);
    const enforced = c.chapters.every((n) => chapterSet.has(n));
    const retested = new Set(scenes).size >= 2;
    if (!retested) (enforced ? errors : warnings).push(`Big Five concept ${c.id}: must be taught and re-tested in 2+ chapters (now: ${[...new Set(scenes)].join(', ') || 'none'})`);
  }

  return {
    errors,
    warnings,
    coverage,
    readability: read,
    stats: { scenes: idx.scenes.size, chapters: content.chapters.length, events: idx.events.size, decisionsPerChapter },
  };
}
