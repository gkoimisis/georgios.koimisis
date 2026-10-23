import { describe, expect, it } from 'vitest';
import { validateContent } from '../src/content/validate';
import { readability } from '../src/content/readability';
import { CALCS, runCalc } from '../src/finance/calcs';
import { makeFormatter } from '../src/i18n/format';
import { loaded } from './helpers';

describe('content', () => {
  it('loads every file without schema errors', () => {
    expect(loaded.errors).toEqual([]);
  });

  it('passes the cross-reference validator', () => {
    const report = validateContent(loaded.content, loaded.locale);
    expect(report.errors).toEqual([]);
  });

  it('Chapter 1 has at least 15 decisions and a boss scene', () => {
    const report = validateContent(loaded.content, loaded.locale);
    expect(report.stats.decisionsPerChapter[1]).toBeGreaterThanOrEqual(15);
    const ch1 = loaded.content.chapters.find((c) => c.chapter === 1)!;
    expect(ch1.episodes.some((e) => e.scenes.some((s) => s.boss))).toBe(true);
  });

  it('every law/fact/statistic in the locale pack names a source', () => {
    for (const [k, f] of Object.entries(loaded.locale.facts)) {
      if (['law', 'fact', 'statistic'].includes(f.kind)) expect(f.source, k).toBeTruthy();
    }
  });
});

describe('calc registry', () => {
  const ctx = { locale: loaded.locale, fmt: makeFormatter('en-US', 'USD') };
  it('every calc returns finite outputs and math steps for typical inputs', () => {
    const sample: Record<string, number> = {
      grossAnnual: 30000, netMonthly: 2000, essentials: 1300, savings: 1500, perMonth: 100, balance: 1200, monthly: 50,
      highApy: 0.035, lowApy: 0.004, years: 5, fee: 35, amount: 20, days: 3, rate: 0.05, apr: 0.22, payment: 100,
      principal: 1000, earlyAge: 22, lateAge: 32, endAge: 65, raise: 3000, hourly: 17, hoursPerWeek: 34, goal: 900, months: 4, rent: 750,
    };
    for (const [name, def] of Object.entries(CALCS)) {
      const inputs = Object.fromEntries(Object.keys(def.inputs).filter((k) => k in sample).map((k) => [k, sample[k]!]));
      const out = runCalc(name, inputs, ctx);
      for (const k of Object.keys(def.outputs)) expect(Number.isFinite(out.values[k]), `${name}.${k}`).toBe(true);
      expect(out.steps.length, name).toBeGreaterThan(0);
      expect(out.steps.join(' '), name).not.toMatch(/NaN|undefined/);
    }
  });
  it('rejects missing inputs', () => {
    expect(() => runCalc('flatFeeApr', { fee: 35 }, ctx)).toThrow(/amount/);
  });
});

describe('readability', () => {
  it('scores plain sentences low and dense ones high', () => {
    expect(readability('Save a little every week. It adds up.').grade).toBeLessThan(5);
    expect(
      readability('Comprehensive intertemporal optimization necessitates sophisticated quantitative methodologies regarding amortization.').grade,
    ).toBeGreaterThan(14);
  });
});
