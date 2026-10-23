/** Interest-rate conversions. Rates are decimals (0.05 = 5%). */

/** Effective annual yield of a nominal APR compounded `periodsPerYear` times. */
export function aprToApy(apr: number, periodsPerYear = 12): number {
  if (periodsPerYear <= 0) throw new RangeError('periodsPerYear must be positive');
  return Math.pow(1 + apr / periodsPerYear, periodsPerYear) - 1;
}

/** Nominal APR that produces `apy` when compounded `periodsPerYear` times. */
export function apyToApr(apy: number, periodsPerYear = 12): number {
  if (periodsPerYear <= 0) throw new RangeError('periodsPerYear must be positive');
  return periodsPerYear * (Math.pow(1 + apy, 1 / periodsPerYear) - 1);
}

/** Monthly rate equivalent to an annual effective rate. */
export function monthlyFromAnnualEffective(annual: number): number {
  return Math.pow(1 + annual, 1 / 12) - 1;
}
