import type { Condition } from '../content/schema';
import type { Locale } from '../content/types';
import { hasFlag, type RunState } from './state';
import { resolveRef } from './vars';

export function evaluate(c: Condition | undefined, s: RunState, locale: Locale): boolean {
  if (!c) return true;
  if (c.flag !== undefined && !hasFlag(s, c.flag)) return false;
  if (c.notFlag !== undefined && hasFlag(s, c.notFlag)) return false;
  if (c.anyFlag && !c.anyFlag.some((f) => hasFlag(s, f))) return false;
  if (c.var !== undefined) {
    const v = resolveRef(c.var, s, locale);
    if (c.gte !== undefined && !(v >= c.gte)) return false;
    if (c.lte !== undefined && !(v <= c.lte)) return false;
    if (c.gt !== undefined && !(v > c.gt)) return false;
    if (c.lt !== undefined && !(v < c.lt)) return false;
  }
  if (c.all && !c.all.every((x) => evaluate(x, s, locale))) return false;
  if (c.any && !c.any.some((x) => evaluate(x, s, locale))) return false;
  if (c.not && evaluate(c.not, s, locale)) return false;
  return true;
}
