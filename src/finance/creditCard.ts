/** Credit-card payoff simulations, month by month. */

export interface MinimumPaymentRule {
  /** Share of the balance paid each month (e.g. 0.01 = 1%). */
  percentOfBalance: number;
  /** If true, that month's interest is added on top of the percentage. */
  plusInterest: boolean;
  /** The minimum never drops below this (unless the balance is smaller). */
  floor: number;
}

export interface PayoffResult {
  months: number;
  totalInterest: number;
  totalPaid: number;
  /** True if the payment never covers the interest. */
  neverPaysOff: boolean;
  firstPayment: number;
}

const MAX_MONTHS = 1200;

function simulate(balance: number, apr: number, paymentFor: (bal: number, interest: number) => number): PayoffResult {
  const r = apr / 12;
  let bal = balance;
  let months = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  let firstPayment = 0;
  while (bal > 0.005 && months < MAX_MONTHS) {
    const interest = bal * r;
    const due = bal + interest;
    const pay = Math.min(due, paymentFor(bal, interest));
    if (months === 0) firstPayment = pay;
    if (pay <= interest && pay < due) {
      return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity, neverPaysOff: true, firstPayment };
    }
    bal = due - pay;
    totalInterest += interest;
    totalPaid += pay;
    months++;
  }
  return { months, totalInterest, totalPaid, neverPaysOff: bal > 0.005, firstPayment };
}

export function minimumPaymentPayoff(balance: number, apr: number, rule: MinimumPaymentRule): PayoffResult {
  return simulate(balance, apr, (bal, interest) =>
    Math.max(rule.floor, bal * rule.percentOfBalance + (rule.plusInterest ? interest : 0)),
  );
}

export function fixedPaymentPayoff(balance: number, apr: number, payment: number): PayoffResult {
  return simulate(balance, apr, () => payment);
}

/** Minimum payment due this month under `rule`. */
export function minimumDue(balance: number, apr: number, rule: MinimumPaymentRule): number {
  if (balance <= 0) return 0;
  const interest = balance * (apr / 12);
  return Math.min(balance + interest, Math.max(rule.floor, balance * rule.percentOfBalance + (rule.plusInterest ? interest : 0)));
}
