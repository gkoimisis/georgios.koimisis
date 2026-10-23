import type { Effects } from '../content/schema';
import { BALANCE_KEYS, METER_KEYS, RECURRING_KEYS } from '../content/keys';
import { fact } from '../content/locale';
import type { Locale } from '../content/types';
import { addCounter, clamp, clearFlag, hasFlag, setFlag, type Notice, type RunState } from './state';

export function clampScore(n: number, locale: Locale): number {
  return clamp(Math.round(n), fact(locale, 'creditScoreMin'), fact(locale, 'creditScoreMax'));
}

/** Open a first credit card if the player doesn't have one (used by content via the `has-card` flag). */
export function ensureCard(s: RunState, locale: Locale, limit = 500): void {
  if (s.ledger.cardLimit <= 0) s.ledger.cardLimit = limit;
  if (s.ledger.cardApr <= 0) s.ledger.cardApr = fact(locale, 'typicalCardApr');
  if (s.creditScore === null) s.creditScore = 650;
  if (s.creditAgeMonths === 0) s.creditAgeMonths = 1;
  setFlag(s, 'has-card');
}

/**
 * Pay a one-off cost: checking (down to $0), then savings, then the card's free room.
 * Whatever is left pushes checking negative. Returns notices describing where it came from.
 */
export function payExpense(s: RunState, amount: number): Notice[] {
  const l = s.ledger;
  let left = amount;
  const notes: Notice[] = [];
  const fromChecking = Math.min(left, Math.max(0, l.checking));
  l.checking -= fromChecking;
  left -= fromChecking;
  if (left > 0 && l.savings > 0) {
    const fromSavings = Math.min(left, l.savings);
    l.savings -= fromSavings;
    left -= fromSavings;
    s.meters.stress = clamp(s.meters.stress + 1, 0, 100);
    notes.push({ icon: '🛟', title: 'Covered by savings', amount: -fromSavings, kind: 'saving' });
  }
  if (left > 0 && l.cardLimit - l.card > 0) {
    const onCard = Math.min(left, l.cardLimit - l.card);
    l.card += onCard;
    left -= onCard;
    s.meters.stress = clamp(s.meters.stress + 5, 0, 100);
    addCounter(s, 'expensesOnCard', 1);
    notes.push({ icon: '💳', title: 'Put on your credit card', amount: -onCard, kind: 'warning' });
  }
  if (left > 0) {
    l.checking -= left;
    s.meters.stress = clamp(s.meters.stress + 8, 0, 100);
    notes.push({ icon: '⚠️', title: 'Checking went negative', amount: -left, kind: 'warning' });
  }
  return notes;
}

export function applyEffects(
  s: RunState,
  e: Effects | undefined,
  locale: Locale,
  extra?: { setFlags?: string[]; clearFlags?: string[] },
): Notice[] {
  const notes: Notice[] = [];
  for (const f of extra?.clearFlags ?? []) clearFlag(s, f);
  for (const f of extra?.setFlags ?? []) setFlag(s, f);
  if (hasFlag(s, 'has-card')) ensureCard(s, locale);
  if (!e) return notes;
  const l = s.ledger;
  if (e.cardLimit !== undefined) l.cardLimit = Math.max(0, l.cardLimit + e.cardLimit);
  for (const k of BALANCE_KEYS) {
    const d = e[k];
    if (d === undefined) continue;
    if (k === 'card' || k === 'studentLoan' || k === 'savings' || k === 'retirement' || k === 'brokerage') {
      // Moving money out of savings can't go below zero; the rest comes from checking.
      const next = l[k] + d;
      if (next < 0 && k === 'savings') {
        l.checking += next;
        l.savings = 0;
      } else {
        l[k] = Math.max(0, next);
      }
    } else {
      l[k] += d;
    }
  }
  if (e.toSavings !== undefined) {
    const move = e.toSavings >= 0 ? Math.min(e.toSavings, Math.max(0, l.checking)) : -Math.min(-e.toSavings, l.savings);
    l.checking -= move;
    l.savings += move;
  }
  if (e.loseSavings) l.savings *= 1 - e.loseSavings;
  if (e.expense) notes.push(...payExpense(s, e.expense));
  for (const k of RECURRING_KEYS) {
    if (e.set?.[k] !== undefined) l[k] = Math.max(0, e.set[k]!);
    if (e.adjust?.[k] !== undefined) l[k] = Math.max(0, l[k] + e.adjust[k]!);
  }
  for (const k of METER_KEYS) {
    if (e[k] !== undefined) s.meters[k] = clamp(s.meters[k] + e[k]!, 0, 100);
  }
  if (e.wellbeing) {
    s.meters.stress = clamp(s.meters.stress - e.wellbeing, 0, 100);
    s.meters.health = clamp(s.meters.health + e.wellbeing, 0, 100);
    s.meters.freeTime = clamp(s.meters.freeTime + e.wellbeing, 0, 100);
  }
  if (e.relationships) {
    for (const k of ['friends', 'family', 'partner', 'goals'] as const) s.meters[k] = clamp(s.meters[k] + e.relationships, 0, 100);
  }
  if (e.creditScore && s.creditScore !== null) s.creditScore = clampScore(s.creditScore + e.creditScore, locale);
  for (const [k, v] of Object.entries(e.counters ?? {})) addCounter(s, k, v);
  return notes;
}
