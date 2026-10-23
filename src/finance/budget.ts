import { compoundGrowth } from './compound';

/** How many months of essential expenses `savings` covers. */
export function emergencyFundMonths(savings: number, monthlyExpenses: number): number {
  if (monthlyExpenses <= 0) return savings > 0 ? Infinity : 0;
  return Math.max(0, savings) / monthlyExpenses;
}

/** Months of saving `perMonth` to close the gap to `target`. */
export function monthsToGoal(current: number, target: number, perMonth: number): number {
  const gap = target - current;
  if (gap <= 0) return 0;
  if (perMonth <= 0) return Infinity;
  return Math.ceil(gap / perMonth);
}

/**
 * Annualized cost of a flat fee charged to borrow `amount` for `days` days,
 * expressed like an APR (simple, not compounded). This is how regulators compare
 * overdraft and payday fees with loan rates.
 */
export function feeAsApr(fee: number, amount: number, days: number): number {
  if (amount <= 0 || days <= 0) return Infinity;
  return (fee / amount) * (365 / days);
}

export interface RecurringCostResult {
  perYear: number;
  total: number;
  /** What the same money would grow to if saved/invested instead. */
  ifSaved: number;
}

export function recurringCost(monthly: number, years: number, annualRate: number): RecurringCostResult {
  const n = Math.round(years * 12);
  return {
    perYear: monthly * 12,
    total: monthly * n,
    ifSaved: compoundGrowth({ principal: 0, annualRate, years, monthlyContribution: monthly }).futureValue,
  };
}

/** Monthly amount to set aside to have `goal` saved in `months` months. */
export function sinkingFundMonthly(goal: number, months: number): number {
  if (months <= 0) throw new RangeError('months must be positive');
  return Math.max(0, goal) / months;
}

/** Share of take-home pay that goes to rent, and what's left after it. */
export function rentBurden(rent: number, netMonthly: number): { share: number; leftover: number } {
  return { share: netMonthly > 0 ? rent / netMonthly : Infinity, leftover: netMonthly - rent };
}
