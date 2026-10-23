import { describe, expect, it } from 'vitest';
import { atChapterEnd, autoplay, bestPolicy, foilPolicy, randomPolicy } from '../src/engine/autoplay';
import { buildReportCard } from '../src/engine/report';
import { rand } from '../src/engine/rng';
import { availableChoices, currentScene, startRun, step } from '../src/engine/step';
import { netWorth } from '../src/engine/vars';
import { engine } from './helpers';

describe('rng', () => {
  it('is deterministic and uniform-ish', () => {
    expect(rand(1, 'x', 3)).toBe(rand(1, 'x', 3));
    expect(rand(1, 'x', 3)).not.toBe(rand(2, 'x', 3));
    const xs = Array.from({ length: 2000 }, (_, i) => rand(7, 't', i));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});

describe('engine', () => {
  it('starts in the chapter intro and the first decision is one tap away', () => {
    const s0 = startRun(engine, { seed: 1, backgroundId: 'on-your-own' });
    expect(s0.phase).toBe('chapterIntro');
    const s1 = step(engine, s0, { type: 'begin' });
    expect(s1.phase).toBe('scene');
    expect(s1.sceneId).toBe('ch1-e1-s1');
  });

  it('never mutates the previous state', () => {
    const s0 = step(engine, startRun(engine, { seed: 3 }), { type: 'begin' });
    const snapshot = JSON.stringify(s0);
    step(engine, s0, { type: 'choose', choiceId: 'b' });
    expect(JSON.stringify(s0)).toBe(snapshot);
  });

  it('gives full four-step feedback after every decision', () => {
    let checked = 0;
    autoplay(engine, startRun(engine, { seed: 11 }), randomPolicy(11), () => false, 5000, (s) => {
      if (s.phase !== 'feedback') return;
      const f = s.feedback!;
      expect(f.outcome.length).toBeGreaterThan(0);
      expect(f.explanation.length).toBeGreaterThan(0);
      expect(f.why.text).toMatch(/\$|%|\d/);
      expect(f.why.steps.length).toBeGreaterThan(0);
      expect(f.takeaway.length).toBeGreaterThan(0);
      checked++;
    });
    expect(checked).toBeGreaterThanOrEqual(15);
  });

  it('is reproducible: same seed and choices give the same life', () => {
    const play = () => autoplay(engine, startRun(engine, { seed: 99 }), randomPolicy(5), () => false).state;
    expect(JSON.stringify(play())).toBe(JSON.stringify(play()));
  });

  it('rejects choices that are not available', () => {
    const s = step(engine, startRun(engine, { seed: 1 }), { type: 'begin' });
    expect(() => step(engine, s, { type: 'choose', choiceId: 'z' })).toThrow();
  });

  it('hides choices whose condition fails (moving home needs a family safety net)', () => {
    const findBoss = (bg: string) => {
      let found: string[] = [];
      autoplay(engine, startRun(engine, { seed: 4, backgroundId: bg }), bestPolicy, (s) => {
        if (s.phase === 'scene' && s.sceneId === 'ch1-e4-s4') {
          found = availableChoices(engine, s, currentScene(engine, s)!).map((c) => c.id);
          return true;
        }
        return false;
      });
      return found;
    };
    expect(findBoss('safety-net')).toContain('d');
    expect(findBoss('on-your-own')).not.toContain('d');
  });

  it('an overdraft charges a fee unless the player opted out', () => {
    const base = startRun(engine, { seed: 1, backgroundId: 'on-your-own' });
    // No income, no bills, $100 of spending against $50 in checking: $50 short.
    Object.assign(base.ledger, { checking: 50, savings: 0, grossAnnualIncome: 0, rent: 0, otherNeeds: 0, subscriptions: 0, wants: 100 });
    base.phase = 'feedback';
    base.sceneId = 'ch1-e1-s1';
    base.feedback = { sceneId: 'ch1-e1-s3', choiceId: 'a', quality: 'best', outcome: '', deltas: [], notes: [], explanation: '', why: { text: '', formula: '', steps: [], illustrative: true, personal: false }, takeaway: '' };
    const charged = step(engine, base, { type: 'continue' });
    expect(charged.counters['overdrafts']).toBe(1);
    const optedOut = structuredClone(base);
    optedOut.flags.push('overdraft-opt-out');
    const declined = step(engine, optedOut, { type: 'continue' });
    expect(declined.counters['overdrafts'] ?? 0).toBe(0);
  });

  it('a delayed consequence lands later (claiming exempt leads to a tax bill)', () => {
    let s = step(engine, startRun(engine, { seed: 2 }), { type: 'begin' });
    s = step(engine, s, { type: 'choose', choiceId: 'b' });
    expect(s.scheduled.some((x) => x.event === 'w4-tax-bill')).toBe(true);
    const end = autoplay(engine, s, bestPolicy, (x) => x.month >= 12).state;
    expect(end.eventLog.some((e) => e.id === 'w4-tax-bill')).toBe(true);
  });

  it('the best path ends Chapter 1 richer than the foil path', () => {
    const start = startRun(engine, { seed: 21, backgroundId: 'on-your-own' });
    const best = autoplay(engine, start, bestPolicy, atChapterEnd(1)).state;
    const foil = autoplay(engine, start, foilPolicy, atChapterEnd(1)).state;
    expect(netWorth(best)).toBeGreaterThan(netWorth(foil));
  });
});

describe('report card', () => {
  it('compares your path with the best and foil paths and prices each decision', () => {
    const start = startRun(engine, { seed: 8, backgroundId: 'safety-net' });
    const end = autoplay(engine, start, randomPolicy(8), atChapterEnd(1)).state;
    if (end.phase === 'ending') return; // collapsed: no report card
    const rc = buildReportCard(engine, start, end);
    expect(rc.decisions.length).toBe(end.history.length);
    expect(rc.best.netWorth).toBeGreaterThan(rc.foil.netWorth);
    for (const d of rc.decisions) if (!d.bestChoiceId) expect(d.netWorthIfBest).toBe(0);
  });
});
