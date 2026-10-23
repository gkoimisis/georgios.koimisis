/** Inflation and real (after-inflation) values. */

/** What `amount` future dollars are worth in today's dollars. */
export function realValue(amount: number, inflationRate: number, years: number): number {
  return amount / Math.pow(1 + inflationRate, years);
}

/** What something costing `amount` today will cost in `years`. */
export function futureCost(amount: number, inflationRate: number, years: number): number {
  return amount * Math.pow(1 + inflationRate, years);
}

/** Exact real return (Fisher relation). */
export function realReturn(nominalRate: number, inflationRate: number): number {
  return (1 + nominalRate) / (1 + inflationRate) - 1;
}
