import en from './en.json';

type Strings = Record<string, string>;
const tables: Record<string, Strings> = { en };
let active: Strings = en;

export function setLanguage(lang: string): void {
  active = tables[lang] ?? en;
}

/** Look up an interface string and fill `{name}` placeholders. Missing keys show the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const s = active[key] ?? en[key as keyof typeof en] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}

/** Plural helper: uses `key.one` / `key.other`. */
export function tn(key: string, n: number, vars?: Record<string, string | number>): string {
  return t(`${key}.${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}
