import { describe, expect, it } from 'vitest';
import {
  aprToApy, apyToApr, bondPrice, compoundGrowth, doublingYears, emergencyFundMonths, feeAsApr, feeDrag,
  fixedPaymentPayoff, futureCost, loanPayment, loanSummary, minimumDue, minimumPaymentPayoff, monthsToGoal,
  netPay, progressiveTax, realReturn, realValue, recurringCost, remainingBalance, rentBurden, sinkingFundMonthly,
} from '../src/finance';

// Reference values were checked by hand and against an independent script.

describe('rates', () => {
  it('converts 12% APR monthly to 12.68% APY', () => {
    expect(aprToApy(0.12, 12)).toBeCloseTo(0.126825, 6);
  });
  it('round-trips APY back to APR', () => {
    expect(apyToApr(aprToApy(0.0475))).toBeCloseTo(0.0475, 10);
  });
  it('annual compounding leaves the rate unchanged', () => {
    expect(aprToApy(0.05, 1)).toBeCloseTo(0.05, 12);
  });
});

describe('compound growth', () => {
  it('grows $1,000 at 5% for 10 years (monthly) to $1,647.01', () => {
    expect(compoundGrowth({ principal: 1000, annualRate: 0.05, years: 10 }).futureValue).toBeCloseTo(1647.01, 2);
  });
  it('$100/month at 6% for 30 years reaches $100,451.50', () => {
    const r = compoundGrowth({ principal: 0, annualRate: 0.06, years: 30, monthlyContribution: 100 });
    expect(r.futureValue).toBeCloseTo(100451.5, 1);
    expect(r.totalContributed).toBe(36000);
    expect(r.growth).toBeCloseTo(64451.5, 1);
  });
  it('handles a 0% rate', () => {
    expect(compoundGrowth({ principal: 50, annualRate: 0, years: 2, monthlyContribution: 10 }).futureValue).toBe(290);
  });
  it('doubling time at 7% is about 10.24 years', () => {
    expect(doublingYears(0.07)).toBeCloseTo(10.2448, 3);
    expect(doublingYears(0)).toBe(Infinity);
  });
});

describe('loans', () => {
  it('$200,000 at 6% for 30 years costs $1,199.10/month', () => {
    expect(loanPayment(200000, 0.06, 360)).toBeCloseTo(1199.1, 2);
  });
  it('$20,000 car loan at 5% for 60 months costs $377.42/month', () => {
    const s = loanSummary(20000, 0.05, 60);
    expect(s.payment).toBeCloseTo(377.42, 2);
    expect(s.totalInterest).toBeCloseTo(2645.48, 1);
  });
  it('0% loans split evenly', () => {
    expect(loanPayment(1200, 0, 12)).toBe(100);
  });
  it('balance is zero after the last payment and full before the first', () => {
    expect(remainingBalance(20000, 0.05, 60, 0)).toBeCloseTo(20000, 6);
    expect(remainingBalance(20000, 0.05, 60, 60)).toBeCloseTo(0, 4);
  });
});

describe('credit cards', () => {
  const rule = { percentOfBalance: 0.01, plusInterest: true, floor: 25 };
  it('$1,000 at 18% paying $100/month: 11 months, $91.62 interest', () => {
    const r = fixedPaymentPayoff(1000, 0.18, 100);
    expect(r.months).toBe(11);
    expect(r.totalInterest).toBeCloseTo(91.62, 2);
  });
  it('$1,240 at 24% on minimums (1% + interest, $25 floor): 96 months, $1,366.90 interest', () => {
    const r = minimumPaymentPayoff(1240, 0.24, rule);
    expect(r.months).toBe(96);
    expect(r.totalInterest).toBeCloseTo(1366.9, 1);
    expect(r.firstPayment).toBeCloseTo(37.2, 2);
  });
  it('$5,000 at 22% on minimums takes 230 months', () => {
    expect(minimumPaymentPayoff(5000, 0.22, rule).months).toBe(230);
  });
  it('a payment below the interest never pays off', () => {
    expect(fixedPaymentPayoff(1000, 0.24, 15).neverPaysOff).toBe(true);
  });
  it('minimum due never exceeds the balance owed', () => {
    expect(minimumDue(10, 0.24, rule)).toBeCloseTo(10.2, 6);
    expect(minimumDue(0, 0.24, rule)).toBe(0);
  });
});

describe('inflation', () => {
  it('$100 in 10 years at 3% inflation is worth $74.41 today', () => {
    expect(realValue(100, 0.03, 10)).toBeCloseTo(74.41, 2);
  });
  it('futureCost is the inverse of realValue', () => {
    expect(futureCost(realValue(500, 0.025, 7), 0.025, 7)).toBeCloseTo(500, 8);
  });
  it('7% nominal with 3% inflation is a 3.88% real return', () => {
    expect(realReturn(0.07, 0.03)).toBeCloseTo(0.038835, 6);
  });
});

describe('fees', () => {
  it('a 1% fee on $10,000 over 30 years at 7% costs about $20,939', () => {
    const r = feeDrag({ principal: 10000, monthlyContribution: 0, annualReturn: 0.07, annualFee: 0.01, years: 30 });
    expect(r.withoutFee).toBeCloseTo(81164.97, 1);
    expect(r.withFee).toBeCloseTo(60225.75, 1);
    expect(r.lostToFees).toBeCloseTo(20939.22, 1);
    expect(r.shareLost).toBeCloseTo(0.258, 3);
  });
});

describe('bonds', () => {
  it('prices at par when coupon equals yield', () => {
    expect(bondPrice({ face: 1000, couponRate: 0.05, marketYield: 0.05, years: 10 })).toBeCloseTo(1000, 6);
  });
  it('falls when rates rise and rises when rates fall', () => {
    expect(bondPrice({ face: 1000, couponRate: 0.05, marketYield: 0.06, years: 10 })).toBeCloseTo(925.61, 2);
    expect(bondPrice({ face: 1000, couponRate: 0.05, marketYield: 0.04, years: 10 })).toBeCloseTo(1081.76, 2);
  });
});

describe('tax', () => {
  const brackets = [{ from: 0, rate: 0.1 }, { from: 10000, rate: 0.2 }, { from: 40000, rate: 0.3 }];
  it('taxes only the dollars inside each bracket', () => {
    const r = progressiveTax(15000, brackets);
    expect(r.tax).toBeCloseTo(2000, 6);
    expect(r.marginalRate).toBe(0.2);
    expect(r.averageRate).toBeCloseTo(0.13333, 4);
  });
  it('a raise into a higher bracket never lowers after-tax income', () => {
    const before = 39999 - progressiveTax(39999, brackets).tax;
    const after = 41000 - progressiveTax(41000, brackets).tax;
    expect(after).toBeGreaterThan(before);
  });
  it('zero income owes zero', () => {
    expect(progressiveTax(0, brackets)).toEqual({ tax: 0, marginalRate: 0.1, averageRate: 0 });
  });
  it('net pay subtracts income tax, payroll tax and state tax', () => {
    const rules = { standardDeduction: 5000, brackets, socialSecurityRate: 0.062, socialSecurityWageBase: 100000, medicareRate: 0.0145, stateRate: 0.03 };
    const r = netPay(30000, rules);
    // taxable 25,000 -> 1,000 + 3,000 = 4,000 federal; SS 1,860; Medicare 435; state 750
    expect(r.federalIncomeTax).toBeCloseTo(4000, 6);
    expect(r.socialSecurity).toBeCloseTo(1860, 6);
    expect(r.medicare).toBeCloseTo(435, 6);
    expect(r.stateTax).toBeCloseTo(750, 6);
    expect(r.net).toBeCloseTo(22955, 6);
    expect(r.withheldShare).toBeCloseTo(0.23483, 4);
  });
  it('caps Social Security at the wage base', () => {
    const rules = { standardDeduction: 0, brackets, socialSecurityRate: 0.062, socialSecurityWageBase: 100000, medicareRate: 0.0145, stateRate: 0 };
    expect(netPay(150000, rules).socialSecurity).toBeCloseTo(6200, 6);
  });
});

describe('budget', () => {
  it('counts emergency-fund months', () => {
    expect(emergencyFundMonths(4500, 1500)).toBe(3);
    expect(emergencyFundMonths(-100, 1500)).toBe(0);
  });
  it('counts months to a goal, rounding up', () => {
    expect(monthsToGoal(500, 3000, 200)).toBe(13);
    expect(monthsToGoal(5000, 3000, 200)).toBe(0);
    expect(monthsToGoal(0, 3000, 0)).toBe(Infinity);
  });
  it('a $35 fee on a $20 overdraft repaid in 3 days is a 21,292% APR', () => {
    expect(feeAsApr(35, 20, 3)).toBeCloseTo(212.9167, 3);
  });
  it('a $15/month subscription is $180/year and $900 over 5 years', () => {
    const r = recurringCost(15, 5, 0);
    expect(r.perYear).toBe(180);
    expect(r.total).toBe(900);
    expect(r.ifSaved).toBe(900);
  });
  it('a $900 trip in 6 months needs $150 a month', () => {
    expect(sinkingFundMonthly(900, 6)).toBe(150);
  });
  it('$750 rent on $2,000 take-home is 37.5%, leaving $1,250', () => {
    expect(rentBurden(750, 2000)).toEqual({ share: 0.375, leftover: 1250 });
  });
});
