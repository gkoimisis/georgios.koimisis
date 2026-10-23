import type { Locale } from './types';
import type { Bracket, MinimumPaymentRule, PayrollRules } from '../finance';

export function fact<T = number>(locale: Locale, key: string): T {
  const f = locale.facts[key];
  if (!f) throw new Error(`Unknown locale fact: ${key}`);
  return f.value as T;
}

export function isIllustrativeFact(locale: Locale, key: string): boolean {
  return locale.facts[key]?.kind === 'illustrative';
}

export function payrollRules(locale: Locale): PayrollRules {
  return {
    standardDeduction: fact(locale, 'standardDeduction'),
    brackets: fact<Bracket[]>(locale, 'taxBrackets'),
    socialSecurityRate: fact(locale, 'socialSecurityRate'),
    socialSecurityWageBase: fact(locale, 'socialSecurityWageBase'),
    medicareRate: fact(locale, 'medicareRate'),
    stateRate: fact(locale, 'stateTaxRate'),
  };
}

export function minimumPaymentRule(locale: Locale): MinimumPaymentRule {
  return { percentOfBalance: fact(locale, 'cardMinimumPercent'), plusInterest: true, floor: fact(locale, 'cardMinimumFloor') };
}
