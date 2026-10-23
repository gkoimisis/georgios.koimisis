/**
 * Zod schemas for everything under /content and /locales.
 * Used at build time (Vite plugin), by scripts and by tests — never shipped to players.
 * Runtime code imports only the inferred types (`import type`).
 */
import { z } from 'zod';
import { BALANCE_KEYS, METER_KEYS, QUALITIES, RECURRING_KEYS } from './keys';

export { BALANCE_KEYS, METER_KEYS, QUALITIES, RECURRING_KEYS };

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase-kebab-case');
const text = z.string().trim().min(1);
/** camelCase names: calcs and counters. */
const name = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'expected a camelCase name');

export const Quality = z.enum(QUALITIES);

/** `player.someVar` or `locale.someFact` */
export const VarRef = z.string().regex(/^(player|locale)\.[A-Za-z0-9_.]+$/, 'expected player.<var> or locale.<fact>');

export const InputSpec = z.union([
  z.number(),
  VarRef,
  z
    .object({
      from: VarRef,
      /** Use this value if the player's number is below it (keeps examples meaningful). */
      min: z.number().optional(),
      max: z.number().optional(),
      times: z.number().optional(),
      plus: z.number().optional(),
    })
    .strict(),
]);

export interface Condition {
  flag?: string;
  notFlag?: string;
  anyFlag?: string[];
  var?: string;
  gte?: number;
  lte?: number;
  gt?: number;
  lt?: number;
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
}

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z
    .object({
      flag: id.optional(),
      notFlag: id.optional(),
      anyFlag: z.array(id).optional(),
      var: VarRef.optional(),
      gte: z.number().optional(),
      lte: z.number().optional(),
      gt: z.number().optional(),
      lt: z.number().optional(),
      all: z.array(ConditionSchema).optional(),
      any: z.array(ConditionSchema).optional(),
      not: ConditionSchema.optional(),
    })
    .strict()
    .refine((c) => Object.keys(c).length > 0, 'empty condition'),
);


function optionalNumbers<K extends string>(keys: readonly K[]) {
  return Object.fromEntries(keys.map((k) => [k, z.number().optional()])) as { [P in K]: z.ZodOptional<z.ZodNumber> };
}
function boundedNumbers<K extends string>(keys: readonly K[], min: number, max = Infinity) {
  return Object.fromEntries(keys.map((k) => [k, z.number().min(min).max(max)])) as { [P in K]: z.ZodNumber };
}
const recurringShape = optionalNumbers(RECURRING_KEYS);


export const EffectsSchema = z
  .object({
    ...optionalNumbers(BALANCE_KEYS),
    ...optionalNumbers(METER_KEYS),
    /** Spread across all wellbeing sub-meters (stress is inverted). */
    wellbeing: z.number().optional(),
    /** Spread across all relationship sub-meters. */
    relationships: z.number().optional(),
    creditScore: z.number().optional(),
    cardLimit: z.number().optional(),
    /** Move money from checking to savings (negative: savings to checking), limited to what's there. */
    toSavings: z.number().optional(),
    /** Lose this share (0-1) of savings, e.g. to a scam. */
    loseSavings: z.number().min(0).max(1).optional(),
    /** One-off cost paid from checking, then savings, then the card. */
    expense: z.number().nonnegative().optional(),
    /** Set recurring lines to these values. */
    set: z.object(recurringShape).strict().optional(),
    /** Add these deltas to recurring lines. */
    adjust: z.object(recurringShape).strict().optional(),
    counters: z.record(name, z.number()).optional(),
  })
  .strict();

export const Message = z.object({ from: id, text }).strict();

export const ScheduleItem = z
  .object({ scene: id.optional(), event: id.optional(), inMonths: z.number().int().min(0) })
  .strict()
  .refine((s) => !!s.scene !== !!s.event, 'schedule needs exactly one of scene or event');

export const TagNote = z.object({ id, resisted: z.boolean() }).strict();

export const ChoiceSchema = z
  .object({
    id: z.string().regex(/^[a-z]$/, 'choice ids are single letters a-d'),
    text,
    quality: Quality,
    /** The foil friend picks tempting choices. */
    tempting: z.boolean().optional(),
    when: ConditionSchema.optional(),
    effects: EffectsSchema.optional(),
    setFlags: z.array(id).optional(),
    clearFlags: z.array(id).optional(),
    schedule: z.array(ScheduleItem).optional(),
    goto: id.optional(),
    outcome: text,
    /** Name a behavioral bias the player fell for (resisted: false) or resisted. */
    bias: TagNote.optional(),
    /** Name a dark pattern or scam the player fell for or spotted. */
    darkPattern: TagNote.optional(),
  })
  .strict();

export const WhyItMatters = z
  .object({
    text,
    calc: name,
    inputs: z.record(z.string(), InputSpec),
    illustrative: z.boolean(),
    /** Alternative texts; the first whose `when` matches replaces `text`. */
    variants: z.array(z.object({ when: ConditionSchema, text }).strict()).optional(),
    /** Compute with the numbers from before (default: after) the choice's effects. */
    timing: z.enum(['before', 'after']).default('after'),
  })
  .strict();

export const Source = z.object({ title: text, publisher: z.string().optional(), url: z.string().url().optional() }).strict();

export const ReviewItem = z
  .object({
    question: text,
    options: z.array(text).min(2).max(4),
    answer: text,
    explain: z.string().optional(),
  })
  .strict()
  .refine((r) => r.options.includes(r.answer), 'review.answer must match one of the options exactly');

export const SceneSchema = z
  .object({
    id,
    concepts: z.array(id).min(1),
    difficulty: z.number().int().min(1).max(3),
    title: z.string().optional(),
    when: ConditionSchema.optional(),
    /** A big "boss" decision at the chapter's climax. */
    boss: z.boolean().optional(),
    texts: z.array(Message).optional(),
    setup: text,
    choices: z.array(ChoiceSchema).min(2).max(4),
    explanation: text,
    whyItMatters: WhyItMatters,
    takeaway: text,
    review: ReviewItem,
    sources: z.array(Source).default([]),
    needsVerification: z.boolean().default(false),
    /** Months that pass after this decision. */
    elapse: z.number().int().min(0).max(36).default(0),
  })
  .strict();

export const EpisodeSchema = z
  .object({
    id,
    title: text,
    intro: z.string().optional(),
    /** Months that pass before this episode starts. */
    gapMonths: z.number().int().min(0).default(0),
    scenes: z.array(SceneSchema).min(1),
    hook: z.object({ texts: z.array(Message).optional(), text }).strict(),
    teaser: text,
  })
  .strict();

export const ChapterSchema = z
  .object({
    chapter: z.number().int().min(1),
    id,
    title: text,
    ages: text,
    objectives: z.array(text).min(2),
    recap: z.array(text).min(2),
    episodes: z.array(EpisodeSchema).min(1),
    /** Scenes reached only via goto, schedule, events or crises. */
    interludes: z.array(SceneSchema).default([]),
  })
  .strict();

export const EventSchema = z
  .object({
    id,
    title: text,
    body: text,
    icon: z.string().default('🔔'),
    weight: z.number().positive(),
    /** false = only fires when a choice schedules it, never at random. */
    drawable: z.boolean().default(true),
    when: ConditionSchema.optional(),
    once: z.boolean().default(false),
    cooldownMonths: z.number().int().min(0).default(0),
    effects: EffectsSchema.optional(),
    setFlags: z.array(id).optional(),
    clearFlags: z.array(id).optional(),
    concepts: z.array(id).default([]),
    schedule: z.array(ScheduleItem).optional(),
    /** A decision scene (from this deck's `scenes`) to play right after. */
    scene: id.optional(),
  })
  .strict();

export const EventDeckSchema = z
  .object({
    id,
    chapters: z.array(z.number().int().min(1)).min(1),
    /** Probability per simulated month that this deck draws an event. */
    monthlyChance: z.number().min(0).max(1),
    events: z.array(EventSchema).min(1),
    scenes: z.array(SceneSchema).default([]),
  })
  .strict();

export const CrisisSchema = z
  .object({ id, when: ConditionSchema, scene: id, cooldownMonths: z.number().int().min(0).default(12) })
  .strict();

export const CrisesFileSchema = z.object({ crises: z.array(CrisisSchema), scenes: z.array(SceneSchema) }).strict();

export const EndingSchema = z
  .object({
    id,
    kind: z.enum(['collapse', 'milestone']),
    title: text,
    text,
    lesson: z.string().optional(),
    when: ConditionSchema.optional(),
  })
  .strict();

export const CharacterSchema = z
  .object({ id, name: text, role: text, avatar: text, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), bio: text })
  .strict();

const StartSchema = z
  .object({
    ageMonths: z.number().int().min(12 * 16),
    checking: z.number(),
    savings: z.number().min(0),
    card: z.number().min(0).default(0),
    cardLimit: z.number().min(0).default(0),
    studentLoan: z.number().min(0).default(0),
    studentLoanApr: z.number().min(0).default(0),
    studentLoanPayment: z.number().min(0).default(0),
    creditScore: z.number().int().min(300).max(850).nullable().default(null),
    ...boundedNumbers(RECURRING_KEYS, 0),
    ...boundedNumbers(METER_KEYS, 0, 100),
    flags: z.array(id).default([]),
  })
  .strict();

export const BackgroundSchema = z
  .object({ id, title: text, blurb: text, weight: z.number().positive(), start: StartSchema, epilogueNote: text })
  .strict();

export const ConceptSchema = z
  .object({
    id,
    name: text,
    kind: z.enum(['concept', 'bias', 'dark-pattern', 'scam']),
    /** Chapters where this concept is meant to be taught; coverage is enforced once all exist. */
    chapters: z.array(z.number().int().min(1)).min(1),
    bigFive: z.boolean().default(false),
    summary: text,
  })
  .strict();

export const FactSchema = z
  .object({
    value: z.unknown(),
    /** law/fact/statistic need a source; illustrative values are labeled in the UI. */
    kind: z.enum(['law', 'fact', 'statistic', 'illustrative', 'convention']),
    label: text,
    source: z.string().optional(),
    note: z.string().optional(),
    lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  })
  .strict()
  .refine((f) => f.kind === 'illustrative' || f.kind === 'convention' || !!f.source, 'law, fact and statistic entries need a source');

export const LocaleSchema = z
  .object({
    id,
    name: text,
    currency: z.string().length(3),
    numberLocale: text,
    facts: z.record(z.string(), FactSchema),
  })
  .strict();

export type Effects = z.infer<typeof EffectsSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type Episode = z.infer<typeof EpisodeSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type GameEvent = z.infer<typeof EventSchema>;
export type EventDeck = z.infer<typeof EventDeckSchema>;
export type Crisis = z.infer<typeof CrisisSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Background = z.infer<typeof BackgroundSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Fact = z.infer<typeof FactSchema>;
export type LocaleFile = z.infer<typeof LocaleSchema>;
export type InputSpecT = z.infer<typeof InputSpec>;
export type QualityT = z.infer<typeof Quality>;
export type Message = z.infer<typeof Message>;
export type ReviewItemT = z.infer<typeof ReviewItem>;
