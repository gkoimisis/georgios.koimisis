export type FormatKind = 'usd' | 'pct' | 'int' | 'num1' | 'years' | 'months';

export interface Formatter {
  usd(n: number): string;
  /** Short form for tight spaces: $1.2K */
  usdCompact(n: number): string;
  pct(n: number): string;
  int(n: number): string;
  num1(n: number): string;
  format(n: number, kind: FormatKind): string;
}

export function makeFormatter(numberLocale: string, currency: string): Formatter {
  const money0 = new Intl.NumberFormat(numberLocale, { style: 'currency', currency, maximumFractionDigits: 0, minimumFractionDigits: 0 });
  const money2 = new Intl.NumberFormat(numberLocale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const int = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 });
  const one = new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 1 });

  const compact = new Intl.NumberFormat(numberLocale, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 });

  const inf = (n: number) => (n === Infinity ? '∞' : n === -Infinity ? '-∞' : null);
  const f: Formatter = {
    usd: (n) => {
      const i = inf(n);
      if (i) return i;
      const r = Math.round(n * 100) / 100;
      return Math.abs(r) >= 100 || Number.isInteger(r) ? money0.format(Math.round(r)) : money2.format(r);
    },
    usdCompact: (n) => inf(n) ?? (Math.abs(n) < 1000 ? money0.format(Math.round(n)) : compact.format(n)),
    pct: (n) => {
      const i = inf(n);
      if (i) return i;
      const p = n * 100;
      if (Math.abs(p) >= 100) return `${int.format(p)}%`;
      return `${Number.isInteger(Math.round(p * 100) / 100) ? int.format(p) : one.format(Math.round(p * 10) / 10)}%`;
    },
    int: (n) => inf(n) ?? int.format(Math.round(n)),
    num1: (n) => inf(n) ?? one.format(n),
    format(n, kind) {
      switch (kind) {
        case 'usd': return f.usd(n);
        case 'pct': return f.pct(n);
        case 'int': return f.int(n);
        case 'num1': return f.num1(n);
        case 'years': return inf(n) ?? one.format(Math.round(n * 10) / 10);
        case 'months': return f.int(Math.ceil(n));
      }
    },
  };
  return f;
}
