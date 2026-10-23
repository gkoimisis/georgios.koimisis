import { describe, expect, it } from 'vitest';
import { runPlaytest } from '../src/sim/playtest';
import { engine } from './helpers';

describe('playtest bot', () => {
  it('plays 1,000 seeded runs with no dead ends, unreachable scenes or impossible states', () => {
    const r = runPlaytest(engine, { runs: 1000 });
    expect(r.failures).toEqual([]);
    expect(r.unvisitedScenes).toEqual([]);
    // Balance guardrails: collapse should be possible but uncommon.
    const collapse = (r.endings['overdraft-spiral'] ?? 0) + (r.endings['burnout'] ?? 0);
    expect(collapse).toBeGreaterThan(0);
    expect(collapse / r.runs).toBeLessThan(0.2);
  }, 60_000);

  it('hard mode also runs clean', () => {
    const r = runPlaytest(engine, { runs: 200, mode: 'hard', seedStart: 5000 });
    expect(r.failures).toEqual([]);
  }, 60_000);
});
