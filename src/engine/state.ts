import type { Background, QualityT, Scene } from '../content/schema';

export const RUN_VERSION = 1;

export interface Ledger {
  checking: number;
  savings: number;
  card: number;
  cardLimit: number;
  cardApr: number;
  studentLoan: number;
  studentLoanApr: number;
  studentLoanPayment: number;
  retirement: number;
  brokerage: number;
  // recurring monthly lines (income is yearly gross)
  grossAnnualIncome: number;
  rent: number;
  otherNeeds: number;
  wants: number;
  subscriptions: number;
  autoSave: number;
}

export interface Meters {
  stress: number;
  health: number;
  freeTime: number;
  friends: number;
  family: number;
  partner: number;
  goals: number;
}

export type Phase = 'chapterIntro' | 'scene' | 'feedback' | 'summary' | 'episodeEnd' | 'chapterEnd' | 'ending';

export type NoticeKind = 'income' | 'expense' | 'saving' | 'event' | 'warning' | 'info';

export interface Notice {
  icon: string;
  title: string;
  body?: string;
  amount?: number;
  kind: NoticeKind;
}

export interface DecisionRecord {
  sceneId: string;
  choiceId: string;
  quality: QualityT;
  month: number;
  chapter: number;
  concepts: string[];
}

export interface MeterDelta {
  key: 'cash' | 'savings' | 'emergency' | 'debt' | 'credit' | 'wellbeing' | 'relationships';
  before: number;
  after: number;
}

export interface FeedbackData {
  sceneId: string;
  choiceId: string;
  quality: QualityT;
  outcome: string;
  deltas: MeterDelta[];
  /** Where one-off costs were paid from (savings, card, overdraft). */
  notes: Notice[];
  explanation: string;
  /** personal = at least one input came from the player's own numbers. */
  why: { text: string; formula: string; steps: string[]; illustrative: boolean; personal: boolean };
  takeaway: string;
  bias?: { id: string; resisted: boolean };
  darkPattern?: { id: string; resisted: boolean };
}

export interface RunState {
  v: number;
  seed: number;
  mode: 'normal' | 'hard';
  backgroundId: string;
  /** Months since the run started. */
  month: number;
  startAgeMonths: number;
  // main story cursor
  chapter: number;
  episode: number;
  sceneIndex: number;
  /** Scene currently on screen (main flow or an interrupt). */
  sceneId: string | null;
  /** True when sceneId came from the interrupt queue rather than the main cursor. */
  inInterrupt: boolean;
  phase: Phase;
  ledger: Ledger;
  creditScore: number | null;
  /** Months since the first credit account opened (0 = none). */
  creditAgeMonths: number;
  /** Months in which a payment was missed. */
  latePayments: number[];
  meters: Meters;
  flags: string[];
  counters: Record<string, number>;
  interrupts: string[];
  scheduled: { month: number; scene?: string; event?: string }[];
  eventLog: { id: string; month: number }[];
  crisisLog: { id: string; month: number }[];
  history: DecisionRecord[];
  /** Scene ids whose Money Rule the player collected this run. */
  rules: string[];
  timeline: { m: number; nw: number }[];
  inbox: Notice[];
  /** How many months the current summary covers. */
  inboxMonths: number;
  feedback: FeedbackData | null;
  pendingGoto: string | null;
  monthsInRed: number;
  ending: string | null;
}

export function sceneOf(s: { sceneId: string | null }, scenes: Map<string, { scene: Scene }>): Scene | null {
  return s.sceneId ? scenes.get(s.sceneId)?.scene ?? null : null;
}

export function newRunState(seed: number, background: Background, mode: 'normal' | 'hard' = 'normal'): RunState {
  const s = background.start;
  const ledger: Ledger = {
    checking: s.checking,
    savings: s.savings,
    card: s.card,
    cardLimit: s.cardLimit,
    cardApr: 0,
    studentLoan: s.studentLoan,
    studentLoanApr: s.studentLoanApr,
    studentLoanPayment: s.studentLoanPayment,
    retirement: 0,
    brokerage: 0,
    grossAnnualIncome: s.grossAnnualIncome,
    rent: s.rent,
    otherNeeds: s.otherNeeds,
    wants: s.wants,
    subscriptions: s.subscriptions,
    autoSave: s.autoSave,
  };
  const hasCredit = s.cardLimit > 0 || s.studentLoan > 0;
  return {
    v: RUN_VERSION,
    seed,
    mode,
    backgroundId: background.id,
    month: 0,
    startAgeMonths: s.ageMonths,
    chapter: 1,
    episode: 0,
    sceneIndex: 0,
    sceneId: null,
    inInterrupt: false,
    phase: 'chapterIntro',
    ledger,
    creditScore: s.creditScore,
    creditAgeMonths: hasCredit ? 6 : 0,
    latePayments: [],
    meters: {
      stress: s.stress, health: s.health, freeTime: s.freeTime,
      friends: s.friends, family: s.family, partner: s.partner, goals: s.goals,
    },
    flags: [...s.flags],
    counters: {},
    interrupts: [],
    scheduled: [],
    eventLog: [],
    crisisLog: [],
    history: [],
    rules: [],
    timeline: [],
    inbox: [],
    inboxMonths: 0,
    feedback: null,
    pendingGoto: null,
    monthsInRed: 0,
    ending: null,
  };
}

export function hasFlag(s: RunState, f: string): boolean {
  return s.flags.includes(f);
}

export function setFlag(s: RunState, f: string): void {
  if (!s.flags.includes(f)) s.flags.push(f);
}

export function clearFlag(s: RunState, f: string): void {
  s.flags = s.flags.filter((x) => x !== f);
}

export function addCounter(s: RunState, key: string, by: number): void {
  s.counters[key] = (s.counters[key] ?? 0) + by;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
