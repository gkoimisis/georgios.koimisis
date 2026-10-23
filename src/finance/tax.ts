/** Progressive income tax and payroll withholding. */

export interface Bracket {
  /** Lower edge of the bracket (taxable income). */
  from: number;
  rate: number;
}

export interface TaxResult {
  tax: number;
  marginalRate: number;
  averageRate: number;
}

/** Tax on `taxable` income under progressive `brackets` (sorted ascending by `from`, first from = 0). */
export function progressiveTax(taxable: number, brackets: readonly Bracket[]): TaxResult {
  const income = Math.max(0, taxable);
  let tax = 0;
  let marginalRate = brackets[0]?.rate ?? 0;
  for (let i = 0; i < brackets.length; i++) {
    const b = brackets[i]!;
    const next = brackets[i + 1]?.from ?? Infinity;
    if (income <= b.from) break;
    tax += (Math.min(income, next) - b.from) * b.rate;
    marginalRate = b.rate;
  }
  return { tax, marginalRate, averageRate: income === 0 ? 0 : tax / income };
}

export interface PayrollRules {
  standardDeduction: number;
  brackets: readonly Bracket[];
  socialSecurityRate: number;
  socialSecurityWageBase: number;
  medicareRate: number;
  /** A flat stand-in for state/local income tax. */
  stateRate: number;
}

export interface NetPayResult {
  gross: number;
  federalIncomeTax: number;
  socialSecurity: number;
  medicare: number;
  stateTax: number;
  totalWithheld: number;
  net: number;
  withheldShare: number;
  marginalRate: number;
  averageIncomeTaxRate: number;
}

/** Annual take-home pay for a single filer with wages only (simplified). */
export function netPay(grossAnnual: number, rules: PayrollRules): NetPayResult {
  const gross = Math.max(0, grossAnnual);
  const taxable = Math.max(0, gross - rules.standardDeduction);
  const fed = progressiveTax(taxable, rules.brackets);
  const socialSecurity = Math.min(gross, rules.socialSecurityWageBase) * rules.socialSecurityRate;
  const medicare = gross * rules.medicareRate;
  const stateTax = taxable * rules.stateRate;
  const totalWithheld = fed.tax + socialSecurity + medicare + stateTax;
  return {
    gross,
    federalIncomeTax: fed.tax,
    socialSecurity,
    medicare,
    stateTax,
    totalWithheld,
    net: gross - totalWithheld,
    withheldShare: gross === 0 ? 0 : totalWithheld / gross,
    marginalRate: fed.marginalRate,
    averageIncomeTaxRate: gross === 0 ? 0 : fed.tax / gross,
  };
}
