import { compoundGrowth } from './compound';

/** How much an annual fee (expense ratio, advisory fee) costs over time. */
export interface FeeDragInput {
  principal: number;
  monthlyContribution: number;
  annualReturn: number;
  annualFee: number;
  years: number;
}

export interface FeeDragResult {
  withoutFee: number;
  withFee: number;
  lostToFees: number;
  /** Share of the no-fee ending balance lost to fees. */
  shareLost: number;
}

export function feeDrag({ principal, monthlyContribution, annualReturn, annualFee, years }: FeeDragInput): FeeDragResult {
  const base = { principal, years, monthlyContribution };
  const withoutFee = compoundGrowth({ ...base, annualRate: annualReturn }).futureValue;
  const withFee = compoundGrowth({ ...base, annualRate: annualReturn - annualFee }).futureValue;
  const lostToFees = withoutFee - withFee;
  return { withoutFee, withFee, lostToFees, shareLost: withoutFee === 0 ? 0 : lostToFees / withoutFee };
}
