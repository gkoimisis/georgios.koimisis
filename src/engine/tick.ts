/**
 * The monthly simulation: payday, bills, saving, card and loan payments,
 * interest, overdrafts, credit score, mood drift and random life events.
 */
import { fact, minimumPaymentRule } from '../content/locale';
import type { GameContent, Locale } from '../content/types';
import type { GameEvent } from '../content/schema';
import { minimumDue } from '../finance/creditCard';
import { apyToApr } from '../finance/rates';
import { evaluate } from './conditions';
import { applyEffects, clampScore } from './effects';
import type { ContentIndex } from './contentIndex';
import { pickWeighted, rand } from './rng';
import { addCounter, clamp, hasFlag, type Notice, type RunState } from './state';
import { emergencyMonths, netMonthlyIncome, netWorth } from './vars';

/** A deliberately simple credit-score model (the UI labels it as simplified). */
function updateCredit(s: RunState, locale: Locale, missed: boolean): void {
  if (s.creditScore === null) return;
  s.creditAgeMonths++;
  if (missed) {
    s.latePayments.push(s.month);
    s.creditScore = clampScore(s.creditScore - 60, locale);
    return;
  }
  const util = s.ledger.cardLimit > 0 ? s.ledger.card / s.ledger.cardLimit : 0;
  const recentLates = s.latePayments.filter((m) => s.month - m < 24).length;
  const target = 720 + Math.min(60, s.creditAgeMonths / 2) - 300 * Math.max(0, util - 0.1) - 70 * recentLates;
  const step = clamp((target - s.creditScore) * 0.08, -12, 6);
  s.creditScore = clampScore(s.creditScore + step, locale);
}

interface MonthTotals {
  income: number;
  bills: number;
  saved: number;
  cardPaid: number;
  cardInterest: number;
  loanPaid: number;
  savingsInterest: number;
  overdraftFees: number;
  lateFees: number;
  declined: number;
}

function simulateMonth(s: RunState, locale: Locale, t: MonthTotals): void {
  const l = s.ledger;
  s.month++;

  // Payday
  const net = netMonthlyIncome(s, locale);
  l.checking += net;
  t.income += net;

  // Saving first if automated (only from money that's actually there)
  if (l.autoSave > 0) {
    const move = Math.min(l.autoSave, Math.max(0, l.checking));
    l.checking -= move;
    l.savings += move;
    t.saved += move;
  }

  // Bills and spending. Wants go on the card if that's the player's habit.
  const bills = l.rent + l.otherNeeds + l.subscriptions;
  l.checking -= bills;
  t.bills += bills;
  if (hasFlag(s, 'wants-on-card') && l.cardLimit > 0) {
    const room = Math.max(0, l.cardLimit - l.card);
    const onCard = Math.min(room, l.wants);
    l.card += onCard;
    l.checking -= l.wants - onCard;
  } else {
    l.checking -= l.wants;
  }
  t.bills += l.wants;

  // Student loan
  if (l.studentLoan > 0 && l.studentLoanPayment > 0) {
    const interest = (l.studentLoan * l.studentLoanApr) / 12;
    const pay = Math.min(l.studentLoan + interest, l.studentLoanPayment);
    l.studentLoan = Math.max(0, l.studentLoan + interest - pay);
    l.checking -= pay;
    t.loanPaid += pay;
  }

  // Credit card: pay in full unless the player carries a balance; interest on what's left.
  let missed = false;
  if (l.card > 0.005) {
    const rule = minimumPaymentRule(locale);
    const min = minimumDue(l.card, l.cardApr, rule);
    const target = hasFlag(s, 'carries-balance') ? min : l.card;
    const pay = Math.min(target, Math.max(0, l.checking));
    if (pay + 0.005 < min) {
      missed = true;
      const fee = fact(locale, 'cardLateFee');
      l.card += fee;
      t.lateFees += fee;
      addCounter(s, 'latePayments', 1);
      s.meters.stress = clamp(s.meters.stress + 6, 0, 100);
    }
    l.card -= pay;
    l.checking -= pay;
    t.cardPaid += pay;
    if (l.card > 0.005) {
      const interest = (l.card * l.cardApr) / 12;
      l.card += interest;
      t.cardInterest += interest;
      addCounter(s, 'cardInterestPaid', interest);
    } else {
      l.card = 0;
    }
  }

  // Savings interest
  if (l.savings > 0) {
    const apy = hasFlag(s, 'hysa') ? fact(locale, 'hysaApy') : fact(locale, 'bankSavingsApy');
    const interest = (l.savings * apyToApr(apy)) / 12;
    l.savings += interest;
    t.savingsInterest += interest;
  }

  // Overdraft: linked savings covers it; opting out declines spending instead of charging a fee.
  if (l.checking < 0) {
    if (hasFlag(s, 'linked-savings') && l.savings > 0) {
      const move = Math.min(-l.checking, l.savings);
      l.savings -= move;
      l.checking += move;
    }
  }
  if (l.checking < 0) {
    if (hasFlag(s, 'overdraft-opt-out')) {
      // Card swipes are declined rather than covered: that spending simply doesn't happen.
      const declined = Math.min(-l.checking, l.wants);
      l.checking += declined;
      t.declined += declined;
      s.meters.friends = clamp(s.meters.friends - 2, 0, 100);
      s.meters.stress = clamp(s.meters.stress + 3, 0, 100);
    }
    if (l.checking < 0) {
      const fee = fact(locale, 'overdraftFee');
      l.checking -= fee;
      t.overdraftFees += fee;
      addCounter(s, 'overdrafts', 1);
      addCounter(s, 'feesPaid', fee);
      s.meters.stress = clamp(s.meters.stress + 6, 0, 100);
    }
  }
  s.monthsInRed = l.checking < 0 ? s.monthsInRed + 1 : 0;

  updateCredit(s, locale, missed);

  // Mood drift: things slowly settle, but a thin cushion or no fun money wears on you.
  const m = s.meters;
  m.stress = clamp(m.stress + Math.sign(30 - m.stress) * 1.5, 0, 100);
  m.health = clamp(m.health + Math.sign(60 - m.health), 0, 100);
  m.freeTime = clamp(m.freeTime + Math.sign(55 - m.freeTime), 0, 100);
  m.friends = clamp(m.friends + Math.sign(50 - m.friends) * 0.5, 0, 100);
  if (emergencyMonths(s) < 1) m.stress = clamp(m.stress + 1.5, 0, 100);
  if (l.wants < net * 0.05) {
    m.stress = clamp(m.stress + 1, 0, 100);
    m.friends = clamp(m.friends - 1, 0, 100);
  }

  s.timeline.push({ m: s.month, nw: Math.round(netWorth(s)) });
}

function isEligible(s: RunState, e: GameEvent, locale: Locale): boolean {
  if (!e.drawable || !evaluate(e.when, s, locale)) return false;
  const past = s.eventLog.filter((x) => x.id === e.id);
  if (e.once && past.length > 0) return false;
  const last = past[past.length - 1];
  return !(last && e.cooldownMonths > 0 && s.month - last.month < e.cooldownMonths);
}

export function fireEvent(s: RunState, ev: GameEvent, locale: Locale): Notice[] {
  s.eventLog.push({ id: ev.id, month: s.month });
  const notes: Notice[] = [{ icon: ev.icon, title: ev.title, body: ev.body, kind: 'event' }];
  notes.push(...applyEffects(s, ev.effects, locale, { setFlags: ev.setFlags, clearFlags: ev.clearFlags }));
  for (const item of ev.schedule ?? []) s.scheduled.push({ month: s.month + Math.max(1, item.inMonths), scene: item.scene, event: item.event });
  if (ev.scene) s.interrupts.push(ev.scene);
  return notes;
}

function drawEvents(s: RunState, content: GameContent, idx: ContentIndex, locale: Locale): Notice[] {
  const notes: Notice[] = [];
  const hard = s.mode === 'hard' ? 1.25 : 1;
  for (const deck of content.decks) {
    if (!deck.chapters.includes(s.chapter)) continue;
    if (rand(s.seed, `deck:${deck.id}`, s.month) >= deck.monthlyChance * hard) continue;
    // Pick from the whole deck first, then check eligibility: the same month draws the same
    // candidate no matter what the player chose, so "What if?" replays stay comparable.
    const ev = pickWeighted(deck.events.filter((e) => e.drawable), rand(s.seed, `pick:${deck.id}`, s.month));
    if (ev && isEligible(s, ev, locale)) notes.push(...fireEvent(s, ev, locale));
  }
  // Scheduled consequences that come due this month
  const due = s.scheduled.filter((x) => x.month <= s.month);
  s.scheduled = s.scheduled.filter((x) => x.month > s.month);
  for (const d of due) {
    if (d.scene) s.interrupts.push(d.scene);
    if (d.event) {
      const ev = idx.events.get(d.event);
      if (ev) notes.push(...fireEvent(s, ev, locale));
    }
  }
  return notes;
}

/** Simulate `months` months and return a bank-style summary of what happened. */
export function advanceMonths(s: RunState, months: number, content: GameContent, idx: ContentIndex, locale: Locale): Notice[] {
  if (months <= 0) return [];
  const t: MonthTotals = {
    income: 0, bills: 0, saved: 0, cardPaid: 0, cardInterest: 0, loanPaid: 0,
    savingsInterest: 0, overdraftFees: 0, lateFees: 0, declined: 0,
  };
  const events: Notice[] = [];
  for (let i = 0; i < months; i++) {
    simulateMonth(s, locale, t);
    events.push(...drawEvents(s, content, idx, locale));
  }
  const n = months === 1 ? '' : ` × ${months}`;
  const notes: Notice[] = [{ icon: '💵', title: `Paychecks${n}`, amount: t.income, kind: 'income' }];
  notes.push({ icon: '🏠', title: 'Rent, bills and spending', amount: -t.bills, kind: 'expense' });
  if (t.saved > 0) notes.push({ icon: '🐖', title: 'Moved to savings', amount: t.saved, kind: 'saving' });
  if (t.loanPaid > 0) notes.push({ icon: '🎓', title: 'Student loan payments', amount: -t.loanPaid, kind: 'expense' });
  if (t.cardPaid > 0) notes.push({ icon: '💳', title: 'Card payments', amount: -t.cardPaid, kind: 'expense' });
  if (t.cardInterest > 0.5) notes.push({ icon: '📈', title: 'Card interest charged', amount: -t.cardInterest, kind: 'warning' });
  if (t.savingsInterest > 0.5) notes.push({ icon: '🌱', title: 'Savings interest earned', amount: t.savingsInterest, kind: 'saving' });
  if (t.overdraftFees > 0) notes.push({ icon: '🚫', title: 'Overdraft fees', amount: -t.overdraftFees, kind: 'warning' });
  if (t.lateFees > 0) notes.push({ icon: '⏰', title: 'Late fees (missed card payment)', amount: -t.lateFees, kind: 'warning' });
  if (t.declined > 0) notes.push({ icon: '🙅', title: 'Card declined (overdraft opt-out)', body: 'No fee, but a few plans fell through.', kind: 'info' });
  return [...notes, ...events];
}
