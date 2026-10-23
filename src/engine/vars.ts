/**
 * Player variables that content can read: `player.<name>` in conditions,
 * calc inputs and `{player.<name>}` placeholders in text.
 */
import { netPay } from '../finance/tax';
import { payrollRules } from '../content/locale';
import type { Locale } from '../content/types';
import type { FormatKind, Formatter } from '../i18n/format';
import type { RunState } from './state';

export function netMonthlyIncome(s: RunState, locale: Locale): number {
  return netPay(s.ledger.grossAnnualIncome, payrollRules(locale)).net / 12;
}

/** Essential monthly costs: rent, other needs, required loan payments. */
export function essentials(s: RunState): number {
  return s.ledger.rent + s.ledger.otherNeeds + (s.ledger.studentLoan > 0 ? s.ledger.studentLoanPayment : 0);
}

export function totalDebt(s: RunState): number {
  return s.ledger.card + s.ledger.studentLoan;
}

export function netWorth(s: RunState): number {
  const l = s.ledger;
  return l.checking + l.savings + l.retirement + l.brokerage - totalDebt(s);
}

export function emergencyMonths(s: RunState): number {
  const e = essentials(s);
  return e > 0 ? Math.max(0, s.ledger.savings) / e : 0;
}

export function wellbeingLevel(s: RunState): number {
  const m = s.meters;
  return (100 - m.stress + m.health + m.freeTime) / 3;
}

export function relationshipsLevel(s: RunState): number {
  const m = s.meters;
  return (m.friends + m.family + m.partner + m.goals) / 4;
}

interface VarDef {
  get(s: RunState, locale: Locale): number;
  fmt: FormatKind;
}

const l = (k: keyof RunState['ledger'], fmt: FormatKind = 'usd'): VarDef => ({ get: (s) => s.ledger[k], fmt });
const m = (k: keyof RunState['meters']): VarDef => ({ get: (s) => s.meters[k], fmt: 'int' });

export const PLAYER_VARS: Record<string, VarDef> = {
  checking: l('checking'),
  savings: l('savings'),
  card: l('card'),
  cardLimit: l('cardLimit'),
  cardApr: l('cardApr', 'pct'),
  studentLoan: l('studentLoan'),
  grossAnnualIncome: l('grossAnnualIncome'),
  rent: l('rent'),
  otherNeeds: l('otherNeeds'),
  wants: l('wants'),
  subscriptions: l('subscriptions'),
  autoSave: l('autoSave'),
  cash: { get: (s) => s.ledger.checking + s.ledger.savings, fmt: 'usd' },
  grossMonthlyIncome: { get: (s) => s.ledger.grossAnnualIncome / 12, fmt: 'usd' },
  netMonthlyIncome: { get: netMonthlyIncome, fmt: 'usd' },
  essentials: { get: essentials, fmt: 'usd' },
  monthlySpend: { get: (s) => essentials(s) + s.ledger.wants + s.ledger.subscriptions, fmt: 'usd' },
  surplus: {
    get: (s, loc) => netMonthlyIncome(s, loc) - essentials(s) - s.ledger.wants - s.ledger.subscriptions - s.ledger.autoSave,
    fmt: 'usd',
  },
  totalDebt: { get: totalDebt, fmt: 'usd' },
  netWorth: { get: netWorth, fmt: 'usd' },
  emergencyMonths: { get: emergencyMonths, fmt: 'num1' },
  creditScore: { get: (s) => s.creditScore ?? 0, fmt: 'int' },
  ageYears: { get: (s) => Math.floor((s.startAgeMonths + s.month) / 12), fmt: 'int' },
  month: { get: (s) => s.month, fmt: 'int' },
  stress: m('stress'),
  health: m('health'),
  freeTime: m('freeTime'),
  friends: m('friends'),
  family: m('family'),
  partner: m('partner'),
  goals: m('goals'),
  wellbeing: { get: wellbeingLevel, fmt: 'int' },
  relationships: { get: relationshipsLevel, fmt: 'int' },
  monthsInRed: { get: (s) => s.monthsInRed, fmt: 'int' },
  overdrafts: { get: (s) => s.counters['overdrafts'] ?? 0, fmt: 'int' },
  feesPaid: { get: (s) => s.counters['feesPaid'] ?? 0, fmt: 'usd' },
};

export function isKnownRef(ref: string, locale: Locale): boolean {
  const [ns, ...rest] = ref.split('.');
  const key = rest.join('.');
  if (ns === 'player') return key in PLAYER_VARS || key.startsWith('counters.');
  if (ns === 'locale') return typeof locale.facts[key]?.value === 'number';
  return false;
}

export function resolveRef(ref: string, s: RunState, locale: Locale): number {
  const [ns, ...rest] = ref.split('.');
  const key = rest.join('.');
  if (ns === 'player') {
    if (key.startsWith('counters.')) return s.counters[key.slice(9)] ?? 0;
    const v = PLAYER_VARS[key];
    if (!v) throw new Error(`Unknown player var: ${key}`);
    return v.get(s, locale);
  }
  if (ns === 'locale') {
    const f = locale.facts[key];
    if (!f || typeof f.value !== 'number') throw new Error(`Unknown numeric locale fact: ${key}`);
    return f.value;
  }
  throw new Error(`Bad reference: ${ref}`);
}

export function refFormat(ref: string, locale: Locale): FormatKind {
  const [ns, ...rest] = ref.split('.');
  const key = rest.join('.');
  if (ns === 'player') return PLAYER_VARS[key]?.fmt ?? 'int';
  const v = locale.facts[key]?.value;
  return typeof v === 'number' && Math.abs(v) < 1 ? 'pct' : 'usd';
}

const TOKEN = /\{([A-Za-z0-9_.]+)\}/g;

export function placeholders(text: string): string[] {
  return [...text.matchAll(TOKEN)].map((m) => m[1]!);
}

/** Replace `{name}` with formatted values; dotted names read player/locale vars. */
export function interpolate(
  text: string,
  values: Record<string, number>,
  formats: Record<string, FormatKind>,
  s: RunState,
  locale: Locale,
  fmt: Formatter,
): string {
  return text.replace(TOKEN, (_, name: string) => {
    if (name.includes('.')) return fmt.format(resolveRef(name, s, locale), refFormat(name, locale));
    const v = values[name];
    return v === undefined ? `{${name}}` : fmt.format(v, formats[name] ?? 'int');
  });
}
