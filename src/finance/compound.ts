/** Compound growth with optional monthly contributions. */

export interface GrowthInput {
  principal: number;
  /** Nominal annual rate, compounded monthly. */
  annualRate: number;
  years: number;
  /** Added at the end of each month. */
  monthlyContribution?: number;
}

export interface GrowthResult {
  futureValue: number;
  totalContributed: number;
  growth: number;
}

export function compoundGrowth({ principal, annualRate, years, monthlyContribution = 0 }: GrowthInput): GrowthResult {
  const n = Math.round(years * 12);
  const r = annualRate / 12;
  const factor = Math.pow(1 + r, n);
  const fromPrincipal = principal * factor;
  const fromContributions = r === 0 ? monthlyContribution * n : monthlyContribution * ((factor - 1) / r);
  const futureValue = fromPrincipal + fromContributions;
  const totalContributed = principal + monthlyContribution * n;
  return { futureValue, totalContributed, growth: futureValue - totalContributed };
}

/** Years for money to double at a fixed annual rate (exact, not the Rule of 72). */
export function doublingYears(annualRate: number): number {
  if (annualRate <= 0) return Infinity;
  return Math.log(2) / Math.log(1 + annualRate);
}
