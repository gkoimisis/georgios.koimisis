/**
 * Named calculations that content can call from `whyItMatters.calc`.
 * Each one wraps tested functions in this folder and returns:
 *  - values: numbers the text template can show ({name}),
 *  - steps: the worked math for the "Show the math" panel.
 * Every number in "Why it matters" comes from here.
 */
import type { Locale } from '../content/types';
import { minimumPaymentRule, payrollRules } from '../content/locale';
import type { FormatKind, Formatter } from '../i18n/format';
import { compoundGrowth } from './compound';
import { fixedPaymentPayoff, minimumPaymentPayoff } from './creditCard';
import { emergencyFundMonths, feeAsApr, monthsToGoal, recurringCost, rentBurden, sinkingFundMonthly } from './budget';
import { futureCost, realValue } from './inflation';
import { apyToApr } from './rates';
import { netPay } from './tax';

export interface CalcContext {
  locale: Locale;
  fmt: Formatter;
}

export interface CalcOutput {
  values: Record<string, number>;
  steps: string[];
}

export interface CalcDef {
  description: string;
  /** Inputs are also available to text templates, shown with `fmt`. */
  inputs: Record<string, { default?: number; fmt: FormatKind }>;
  outputs: Record<string, FormatKind>;
  formula: string;
  run(i: Record<string, number>, ctx: CalcContext): CalcOutput;
}

const usd = { fmt: 'usd' } as const;
const pct = { fmt: 'pct' } as const;
const int = { fmt: 'int' } as const;

export const CALCS: Record<string, CalcDef> = {
  takeHomePay: {
    description: 'Gross pay to take-home pay for a single filer with wages only.',
    inputs: { grossAnnual: usd },
    outputs: {
      grossMonthly: 'usd', netMonthly: 'usd', withheldMonthly: 'usd', withheldShare: 'pct',
      incomeTaxMonthly: 'usd', ficaMonthly: 'usd', stateMonthly: 'usd', marginalRate: 'pct',
    },
    formula: 'take-home = gross − federal income tax − Social Security − Medicare − state tax',
    run({ grossAnnual }, { locale, fmt }) {
      const rules = payrollRules(locale);
      const r = netPay(grossAnnual!, rules);
      const fica = r.socialSecurity + r.medicare;
      return {
        values: {
          grossMonthly: r.gross / 12, netMonthly: r.net / 12, withheldMonthly: r.totalWithheld / 12,
          withheldShare: r.withheldShare, incomeTaxMonthly: r.federalIncomeTax / 12, ficaMonthly: fica / 12,
          stateMonthly: r.stateTax / 12, marginalRate: r.marginalRate,
        },
        steps: [
          `Gross pay: ${fmt.usd(r.gross)} a year = ${fmt.usd(r.gross / 12)} a month`,
          `Taxable income: ${fmt.usd(r.gross)} − ${fmt.usd(rules.standardDeduction)} standard deduction = ${fmt.usd(Math.max(0, r.gross - rules.standardDeduction))}`,
          `Federal income tax (taxed bracket by bracket): ${fmt.usd(r.federalIncomeTax)} a year`,
          `Social Security ${fmt.pct(rules.socialSecurityRate)} + Medicare ${fmt.pct(rules.medicareRate)}: ${fmt.usd(fica)} a year`,
          `State and local (illustrative ${fmt.pct(rules.stateRate)} of taxable income): ${fmt.usd(r.stateTax)} a year`,
          `Take-home: ${fmt.usd(r.net)} a year = ${fmt.usd(r.net / 12)} a month (${fmt.pct(r.withheldShare)} withheld)`,
        ],
      };
    },
  },

  budgetSplit: {
    description: 'Split take-home pay into needs, wants and savings.',
    inputs: { netMonthly: usd, needsShare: { default: 0.5, fmt: 'pct' }, wantsShare: { default: 0.3, fmt: 'pct' }, saveShare: { default: 0.2, fmt: 'pct' } },
    outputs: { needs: 'usd', wants: 'usd', save: 'usd', saveYear: 'usd' },
    formula: 'each bucket = take-home × its share',
    run({ netMonthly, needsShare, wantsShare, saveShare }, { fmt }) {
      const n = netMonthly!;
      const v = { needs: n * needsShare!, wants: n * wantsShare!, save: n * saveShare!, saveYear: n * saveShare! * 12 };
      return {
        values: v,
        steps: [
          `Needs: ${fmt.usd(n)} × ${fmt.pct(needsShare!)} = ${fmt.usd(v.needs)}`,
          `Wants: ${fmt.usd(n)} × ${fmt.pct(wantsShare!)} = ${fmt.usd(v.wants)}`,
          `Savings: ${fmt.usd(n)} × ${fmt.pct(saveShare!)} = ${fmt.usd(v.save)} a month, ${fmt.usd(v.saveYear)} a year`,
        ],
      };
    },
  },

  emergencyFund: {
    description: 'How far savings go and how long until the goal.',
    inputs: { essentials: usd, savings: usd, perMonth: usd, goalMonths: { default: 3, fmt: 'int' } },
    outputs: { goal: 'usd', monthsCovered: 'num1', gap: 'usd', monthsToGoal: 'months' },
    formula: 'months covered = savings ÷ essential monthly costs',
    run({ essentials, savings, perMonth, goalMonths }, { fmt }) {
      const goal = essentials! * goalMonths!;
      const covered = emergencyFundMonths(savings!, essentials!);
      const gap = Math.max(0, goal - savings!);
      const toGoal = monthsToGoal(savings!, goal, perMonth!);
      return {
        values: { goal, monthsCovered: covered, gap, monthsToGoal: toGoal },
        steps: [
          `Goal: ${fmt.usd(essentials!)} essentials × ${goalMonths} months = ${fmt.usd(goal)}`,
          `Covered now: ${fmt.usd(savings!)} ÷ ${fmt.usd(essentials!)} = ${fmt.num1(covered)} months`,
          `Gap: ${fmt.usd(gap)}; at ${fmt.usd(perMonth!)} a month that takes ${toGoal === Infinity ? 'forever' : `${toGoal} months`}`,
        ],
      };
    },
  },

  savingsApy: {
    description: 'Same savings in a high-yield vs. a typical savings account.',
    inputs: { balance: usd, monthly: usd, highApy: pct, lowApy: pct, years: int },
    outputs: { high: 'usd', low: 'usd', difference: 'usd' },
    formula: 'balance grows by (1 + APY) each year; deposits added monthly',
    run({ balance, monthly, highApy, lowApy, years }, { fmt }) {
      const grow = (apy: number) =>
        compoundGrowth({ principal: balance!, monthlyContribution: monthly!, years: years!, annualRate: apyToApr(apy) }).futureValue;
      const high = grow(highApy!);
      const low = grow(lowApy!);
      return {
        values: { high, low, difference: high - low },
        steps: [
          `Start ${fmt.usd(balance!)}, add ${fmt.usd(monthly!)} a month for ${years} years`,
          `At ${fmt.pct(highApy!)} APY: ${fmt.usd(high)}`,
          `At ${fmt.pct(lowApy!)} APY: ${fmt.usd(low)}`,
          `Difference: ${fmt.usd(high - low)} for moving the same money`,
        ],
      };
    },
  },

  flatFeeApr: {
    description: 'Turn a flat fee on a short-term shortfall into an APR, like regulators do.',
    inputs: { fee: usd, amount: usd, days: int, timesPerYear: { default: 1, fmt: 'int' } },
    outputs: { apr: 'pct', feeShare: 'pct', yearly: 'usd' },
    formula: 'APR = (fee ÷ amount) × (365 ÷ days)',
    run({ fee, amount, days, timesPerYear }, { fmt }) {
      const apr = feeAsApr(fee!, amount!, days!);
      return {
        values: { apr, feeShare: fee! / amount!, yearly: fee! * timesPerYear! },
        steps: [
          `Fee as a share of the money: ${fmt.usd(fee!)} ÷ ${fmt.usd(amount!)} = ${fmt.pct(fee! / amount!)}`,
          `Stretched to a year: × (365 ÷ ${days} days) = ${fmt.pct(apr)} APR`,
          `${timesPerYear} times a year: ${fmt.usd(fee! * timesPerYear!)}`,
        ],
      };
    },
  },

  recurringCost: {
    description: 'What a monthly charge costs over time, and what it could grow to if saved.',
    inputs: { monthly: usd, years: int, rate: pct },
    outputs: { perYear: 'usd', total: 'usd', ifSaved: 'usd' },
    formula: 'yearly cost = monthly × 12; if saved, grows with compound interest',
    run({ monthly, years, rate }, { fmt }) {
      const r = recurringCost(monthly!, years!, rate!);
      return {
        values: { ...r },
        steps: [
          `${fmt.usd(monthly!)} × 12 = ${fmt.usd(r.perYear)} a year`,
          `Over ${years} years: ${fmt.usd(r.total)}`,
          `Saved monthly at ${fmt.pct(rate!)} instead: ${fmt.usd(r.ifSaved)}`,
        ],
      };
    },
  },

  minimumPaymentPayoff: {
    description: 'Paying only the card minimum.',
    inputs: { balance: usd, apr: pct },
    outputs: { months: 'months', years: 'years', interest: 'usd', totalPaid: 'usd', firstPayment: 'usd' },
    formula: 'each month: interest = balance × APR ÷ 12; minimum = 1% of balance + interest (min $25)',
    run({ balance, apr }, { locale, fmt }) {
      const rule = minimumPaymentRule(locale);
      const r = minimumPaymentPayoff(balance!, apr!, rule);
      return {
        values: { months: r.months, years: r.months / 12, interest: r.totalInterest, totalPaid: r.totalPaid, firstPayment: r.firstPayment },
        steps: [
          `Monthly rate: ${fmt.pct(apr!)} ÷ 12 = ${fmt.pct(apr! / 12)}`,
          `First minimum: ${fmt.pct(rule.percentOfBalance)} of ${fmt.usd(balance!)} + ${fmt.usd(balance! * apr! / 12)} interest = ${fmt.usd(r.firstPayment)}`,
          `Repeat until the balance hits $0 (illustrative issuer formula): ${r.months} months`,
          `Total paid ${fmt.usd(r.totalPaid)}, of which ${fmt.usd(r.totalInterest)} is interest`,
        ],
      };
    },
  },

  payoffComparison: {
    description: 'Minimum payments vs. a fixed monthly payment.',
    inputs: { balance: usd, apr: pct, payment: usd },
    outputs: { minMonths: 'months', minInterest: 'usd', fixedMonths: 'months', fixedInterest: 'usd', saved: 'usd' },
    formula: 'each month: interest = balance × APR ÷ 12, then subtract the payment',
    run({ balance, apr, payment }, { locale, fmt }) {
      const min = minimumPaymentPayoff(balance!, apr!, minimumPaymentRule(locale));
      const fixed = fixedPaymentPayoff(balance!, apr!, payment!);
      return {
        values: {
          minMonths: min.months, minInterest: min.totalInterest, fixedMonths: fixed.months,
          fixedInterest: fixed.totalInterest, saved: min.totalInterest - fixed.totalInterest,
        },
        steps: [
          `Balance ${fmt.usd(balance!)} at ${fmt.pct(apr!)} APR`,
          `Minimums only: ${min.months} months, ${fmt.usd(min.totalInterest)} interest`,
          `${fmt.usd(payment!)} every month: ${fixed.months} months, ${fmt.usd(fixed.totalInterest)} interest`,
          `Interest saved: ${fmt.usd(min.totalInterest - fixed.totalInterest)}`,
        ],
      };
    },
  },

  compoundGrowth: {
    description: 'Growth of a lump sum plus monthly deposits.',
    inputs: { principal: { default: 0, fmt: 'usd' }, monthly: usd, rate: pct, years: int },
    outputs: { futureValue: 'usd', contributed: 'usd', growth: 'usd' },
    formula: 'FV = P(1 + r)ⁿ + PMT × ((1 + r)ⁿ − 1) ÷ r, with r = rate ÷ 12, n = months',
    run({ principal, monthly, rate, years }, { fmt }) {
      const r = compoundGrowth({ principal: principal!, monthlyContribution: monthly!, annualRate: rate!, years: years! });
      return {
        values: { futureValue: r.futureValue, contributed: r.totalContributed, growth: r.growth },
        steps: [
          `r = ${fmt.pct(rate!)} ÷ 12, n = ${years} × 12 = ${Math.round(years! * 12)} months`,
          `You put in ${fmt.usd(r.totalContributed)}`,
          `It grows to ${fmt.usd(r.futureValue)}; ${fmt.usd(r.growth)} of that is growth`,
        ],
      };
    },
  },

  startEarly: {
    description: 'Same monthly saving, started at two different ages.',
    inputs: { monthly: usd, rate: pct, earlyAge: int, lateAge: int, endAge: int },
    outputs: { early: 'usd', late: 'usd', difference: 'usd', earlyContributed: 'usd', lateContributed: 'usd' },
    formula: 'FV = PMT × ((1 + r)ⁿ − 1) ÷ r for each start age',
    run({ monthly, rate, earlyAge, lateAge, endAge }, { fmt }) {
      const g = (start: number) => compoundGrowth({ principal: 0, monthlyContribution: monthly!, annualRate: rate!, years: endAge! - start });
      const a = g(earlyAge!);
      const b = g(lateAge!);
      return {
        values: {
          early: a.futureValue, late: b.futureValue, difference: a.futureValue - b.futureValue,
          earlyContributed: a.totalContributed, lateContributed: b.totalContributed,
        },
        steps: [
          `${fmt.usd(monthly!)} a month at ${fmt.pct(rate!)} (illustrative), until age ${endAge}`,
          `Start at ${earlyAge}: put in ${fmt.usd(a.totalContributed)}, end with ${fmt.usd(a.futureValue)}`,
          `Start at ${lateAge}: put in ${fmt.usd(b.totalContributed)}, end with ${fmt.usd(b.futureValue)}`,
          `Head start is worth ${fmt.usd(a.futureValue - b.futureValue)}`,
        ],
      };
    },
  },

  raiseAfterTax: {
    description: 'How much of a raise you keep, using marginal rates.',
    inputs: { grossAnnual: usd, raise: usd },
    outputs: { marginalRate: 'pct', extraTaxYear: 'usd', extraNetYear: 'usd', extraNetMonthly: 'usd', keepShare: 'pct', averageBefore: 'pct', averageAfter: 'pct' },
    formula: 'only the dollars above a bracket line are taxed at the higher rate',
    run({ grossAnnual, raise }, { locale, fmt }) {
      const rules = payrollRules(locale);
      const before = netPay(grossAnnual!, rules);
      const after = netPay(grossAnnual! + raise!, rules);
      const extraNet = after.net - before.net;
      return {
        values: {
          marginalRate: after.marginalRate, extraTaxYear: raise! - extraNet, extraNetYear: extraNet, extraNetMonthly: extraNet / 12,
          keepShare: raise! === 0 ? 1 : extraNet / raise!, averageBefore: before.averageIncomeTaxRate, averageAfter: after.averageIncomeTaxRate,
        },
        steps: [
          `Take-home before: ${fmt.usd(before.net)} a year`,
          `Take-home after a ${fmt.usd(raise!)} raise: ${fmt.usd(after.net)} a year`,
          `You keep ${fmt.usd(extraNet)} (${fmt.pct(extraNet / raise!)}) of the raise`,
          `Federal average income-tax rate: ${fmt.pct(before.averageIncomeTaxRate)} → ${fmt.pct(after.averageIncomeTaxRate)}; top bracket now ${fmt.pct(after.marginalRate)}`,
        ],
      };
    },
  },

  hourlyToAnnual: {
    description: 'Hourly wage to yearly and monthly gross pay.',
    inputs: { hourly: usd, hoursPerWeek: int, weeks: { default: 52, fmt: 'int' } },
    outputs: { annual: 'usd', monthly: 'usd' },
    formula: 'yearly = hourly × hours per week × weeks',
    run({ hourly, hoursPerWeek, weeks }, { fmt }) {
      const annual = hourly! * hoursPerWeek! * weeks!;
      return {
        values: { annual, monthly: annual / 12 },
        steps: [`${fmt.usd(hourly!)} × ${hoursPerWeek} hours × ${weeks} weeks = ${fmt.usd(annual)} a year`, `÷ 12 = ${fmt.usd(annual / 12)} a month`],
      };
    },
  },

  shareOfCushion: {
    description: 'A loss measured against savings and monthly essentials.',
    inputs: { amount: usd, savings: usd, essentials: usd },
    outputs: { shareOfSavings: 'pct', monthsOfEssentials: 'num1' },
    formula: 'share = loss ÷ savings; months = loss ÷ essential monthly costs',
    run({ amount, savings, essentials }, { fmt }) {
      const share = savings! > 0 ? amount! / savings! : Infinity;
      const months = amount! / essentials!;
      return {
        values: { shareOfSavings: share, monthsOfEssentials: months },
        steps: [
          `${fmt.usd(amount!)} ÷ ${fmt.usd(savings!)} savings = ${fmt.pct(share)}`,
          `${fmt.usd(amount!)} ÷ ${fmt.usd(essentials!)} essentials a month = ${fmt.num1(months)} months`,
        ],
      };
    },
  },

  sinkingFund: {
    description: 'Save for a known future cost a little at a time.',
    inputs: { goal: usd, months: int },
    outputs: { perMonth: 'usd', perWeek: 'usd' },
    formula: 'per month = goal ÷ months until you need it',
    run({ goal, months }, { fmt }) {
      const perMonth = sinkingFundMonthly(goal!, months!);
      return {
        values: { perMonth, perWeek: (perMonth * 12) / 52 },
        steps: [`${fmt.usd(goal!)} ÷ ${months} months = ${fmt.usd(perMonth)} a month`, `About ${fmt.usd((perMonth * 12) / 52)} a week`],
      };
    },
  },

  rentBurden: {
    description: 'Rent as a share of take-home pay.',
    inputs: { rent: usd, netMonthly: usd },
    outputs: { share: 'pct', leftover: 'usd' },
    formula: 'rent share = rent ÷ take-home pay',
    run({ rent, netMonthly }, { fmt }) {
      const r = rentBurden(rent!, netMonthly!);
      return {
        values: r,
        steps: [`${fmt.usd(rent!)} ÷ ${fmt.usd(netMonthly!)} take-home = ${fmt.pct(r.share)}`, `Left for everything else: ${fmt.usd(r.leftover)} a month`],
      };
    },
  },

  inflationErosion: {
    description: 'What cash loses to inflation.',
    inputs: { amount: usd, rate: pct, years: int },
    outputs: { realValue: 'usd', lost: 'usd', futureCost: 'usd' },
    formula: "today's value = amount ÷ (1 + inflation)ʸᵉᵃʳˢ",
    run({ amount, rate, years }, { fmt }) {
      const rv = realValue(amount!, rate!, years!);
      const fc = futureCost(amount!, rate!, years!);
      return {
        values: { realValue: rv, lost: amount! - rv, futureCost: fc },
        steps: [
          `${fmt.usd(amount!)} ÷ (1 + ${fmt.pct(rate!)})^${years} = ${fmt.usd(rv)} in today's money`,
          `Something that costs ${fmt.usd(amount!)} today will cost ${fmt.usd(fc)}`,
        ],
      };
    },
  },
};

/** Formats for every name a template may use with this calc: its inputs and outputs. */
export function calcFormats(name: string): Record<string, FormatKind> {
  const def = CALCS[name];
  if (!def) throw new Error(`Unknown calc: ${name}`);
  return { ...Object.fromEntries(Object.entries(def.inputs).map(([k, v]) => [k, v.fmt])), ...def.outputs };
}

/** Runs a calc. `values` holds the inputs as well as the outputs, so text can echo them. */
export function runCalc(name: string, inputs: Record<string, number>, ctx: CalcContext): CalcOutput & { formula: string } {
  const def = CALCS[name];
  if (!def) throw new Error(`Unknown calc: ${name}`);
  const full: Record<string, number> = {};
  for (const [k, spec] of Object.entries(def.inputs)) {
    const v = inputs[k] ?? spec.default;
    if (v === undefined || !Number.isFinite(v)) throw new Error(`Calc ${name}: missing or invalid input ${k}`);
    full[k] = v;
  }
  const out = def.run(full, ctx);
  return { values: { ...full, ...out.values }, steps: out.steps, formula: def.formula };
}

