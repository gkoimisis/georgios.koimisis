/** Fixed-rate, fully amortizing loans (car loans, student loans, mortgages). */

export function loanPayment(principal: number, annualRate: number, months: number): number {
  if (months <= 0) throw new RangeError('months must be positive');
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

export interface LoanSummary {
  payment: number;
  totalPaid: number;
  totalInterest: number;
}

export function loanSummary(principal: number, annualRate: number, months: number): LoanSummary {
  const payment = loanPayment(principal, annualRate, months);
  const totalPaid = payment * months;
  return { payment, totalPaid, totalInterest: totalPaid - principal };
}

/** Remaining balance after `paid` monthly payments. */
export function remainingBalance(principal: number, annualRate: number, months: number, paid: number): number {
  const r = annualRate / 12;
  const p = loanPayment(principal, annualRate, months);
  if (r === 0) return Math.max(0, principal - p * paid);
  const f = Math.pow(1 + r, paid);
  return Math.max(0, principal * f - p * ((f - 1) / r));
}
