/**
 * Playtest bot: plays many seeded runs and checks for dead ends, unreachable
 * scenes, NaN or runaway numbers and impossible states. Reports the ending
 * distribution and how often each concept came up, for balancing.
 */
import { autoplay, bestPolicy, foilPolicy, randomPolicy, worstPolicy, type Policy } from '../engine/autoplay';
import type { RunState } from '../engine/state';
import { startRun, type Engine } from '../engine/step';
import { emergencyMonths, netWorth, wellbeingLevel } from '../engine/vars';

export interface PlaytestOptions {
  runs: number;
  seedStart?: number;
  mode?: 'normal' | 'hard';
}

export interface Failure {
  seed: number;
  policy: string;
  message: string;
}

export interface Distribution {
  min: number;
  p10: number;
  median: number;
  p90: number;
  max: number;
}

export interface PlaytestReport {
  runs: number;
  failures: Failure[];
  endings: Record<string, number>;
  endingsByPolicy: Record<string, Record<string, number>>;
  unvisitedScenes: string[];
  sceneVisits: Record<string, number>;
  conceptExposure: Record<string, number>;
  crises: Record<string, number>;
  events: Record<string, number>;
  decisionsPerRun: Distribution;
  netWorth: Distribution;
  emergencyMonths: Distribution;
  wellbeing: Distribution;
}

const MAX_ABS_MONEY = 1e7;

function dist(xs: number[]): Distribution {
  const a = [...xs].sort((x, y) => x - y);
  const q = (p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))] ?? 0;
  return { min: a[0] ?? 0, p10: q(0.1), median: q(0.5), p90: q(0.9), max: a[a.length - 1] ?? 0 };
}

/** Returns a description of the first impossible thing about `s`, or null. */
export function checkInvariants(s: RunState, prevMonth: number): string | null {
  for (const [k, v] of Object.entries(s.ledger)) {
    if (!Number.isFinite(v)) return `ledger.${k} is ${v}`;
    if (Math.abs(v) > MAX_ABS_MONEY) return `ledger.${k} ran away: ${v}`;
  }
  for (const k of ['savings', 'card', 'studentLoan', 'retirement', 'brokerage', 'cardLimit', 'rent', 'otherNeeds', 'wants', 'subscriptions', 'autoSave', 'grossAnnualIncome'] as const) {
    if (s.ledger[k] < -0.005) return `ledger.${k} is negative: ${s.ledger[k]}`;
  }
  for (const [k, v] of Object.entries(s.meters)) {
    if (!Number.isFinite(v) || v < 0 || v > 100) return `meters.${k} out of range: ${v}`;
  }
  if (s.creditScore !== null && (s.creditScore < 300 || s.creditScore > 850 || !Number.isFinite(s.creditScore))) return `creditScore out of range: ${s.creditScore}`;
  if (s.month < prevMonth) return `time went backwards: ${prevMonth} -> ${s.month}`;
  if (s.feedback) {
    const texts = [s.feedback.outcome, s.feedback.why.text, s.feedback.explanation];
    for (const t of texts) if (/NaN|undefined|Infinity|\{[A-Za-z.]+\}/.test(t)) return `bad text in ${s.feedback.sceneId}: "${t.slice(0, 120)}"`;
  }
  return null;
}

const POLICIES: { name: string; make: (seed: number) => Policy; share: number }[] = [
  { name: 'random', make: randomPolicy, share: 7 },
  { name: 'best', make: () => bestPolicy, share: 1 },
  { name: 'foil', make: () => foilPolicy, share: 1 },
  { name: 'worst', make: () => worstPolicy, share: 1 },
];

export function runPlaytest(engine: Engine, opts: PlaytestOptions): PlaytestReport {
  const seedStart = opts.seedStart ?? 1;
  const failures: Failure[] = [];
  const endings: Record<string, number> = {};
  const endingsByPolicy: Record<string, Record<string, number>> = {};
  const sceneVisits: Record<string, number> = Object.fromEntries([...engine.idx.scenes.keys()].map((k) => [k, 0]));
  const conceptExposure: Record<string, number> = {};
  const crises: Record<string, number> = {};
  const events: Record<string, number> = {};
  const decisions: number[] = [];
  const nw: number[] = [];
  const em: number[] = [];
  const wb: number[] = [];
  const totalShare = POLICIES.reduce((s, p) => s + p.share, 0);

  for (let i = 0; i < opts.runs; i++) {
    const seed = seedStart + i;
    let slot = i % totalShare;
    const pol = POLICIES.find((p) => (slot -= p.share) < 0)!;
    let prevMonth = 0;
    let s: RunState;
    try {
      s = startRun(engine, { seed, mode: opts.mode });
      s = autoplay(engine, s, pol.make(seed), () => false, 5000, (st) => {
        const bad = checkInvariants(st, prevMonth);
        if (bad) throw new Error(bad);
        prevMonth = st.month;
      }).state;
    } catch (e) {
      failures.push({ seed, policy: pol.name, message: (e as Error).message });
      continue;
    }
    const end = s.ending ?? '(no ending)';
    endings[end] = (endings[end] ?? 0) + 1;
    endingsByPolicy[pol.name] ??= {};
    endingsByPolicy[pol.name]![end] = (endingsByPolicy[pol.name]![end] ?? 0) + 1;
    for (const h of s.history) {
      sceneVisits[h.sceneId] = (sceneVisits[h.sceneId] ?? 0) + 1;
      for (const c of h.concepts) conceptExposure[c] = (conceptExposure[c] ?? 0) + 1;
    }
    for (const c of s.crisisLog) crises[c.id] = (crises[c.id] ?? 0) + 1;
    for (const e of s.eventLog) events[e.id] = (events[e.id] ?? 0) + 1;
    decisions.push(s.history.length);
    nw.push(netWorth(s));
    em.push(emergencyMonths(s));
    wb.push(wellbeingLevel(s));
  }

  return {
    runs: opts.runs,
    failures,
    endings,
    endingsByPolicy,
    unvisitedScenes: Object.entries(sceneVisits).filter(([, n]) => n === 0).map(([k]) => k),
    sceneVisits,
    conceptExposure,
    crises,
    events,
    decisionsPerRun: dist(decisions),
    netWorth: dist(nw),
    emergencyMonths: dist(em),
    wellbeing: dist(wb),
  };
}
