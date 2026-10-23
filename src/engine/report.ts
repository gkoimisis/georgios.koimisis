/**
 * Chapter report card: your path vs. the best path vs. the foil friend's path,
 * plus the dollar impact of each decision (what changes if you'd picked the best option).
 */
import type { QualityT } from '../content/schema';
import { atChapterEnd, autoplay, bestPolicy, foilPolicy, replayPolicy, type Policy } from './autoplay';
import type { RunState } from './state';
import type { Engine } from './step';
import { emergencyMonths, netWorth, relationshipsLevel, totalDebt, wellbeingLevel } from './vars';

export interface PathSummary {
  netWorth: number;
  savings: number;
  emergencyMonths: number;
  debt: number;
  creditScore: number | null;
  wellbeing: number;
  relationships: number;
  ended: string | null;
}

export interface DecisionImpact {
  sceneId: string;
  choiceId: string;
  quality: QualityT;
  bestChoiceId: string | null;
  /** End-of-chapter difference if the best choice had been picked instead (positive = you'd have more). */
  netWorthIfBest: number;
  wellbeingIfBest: number;
  /** Set if the counterfactual run hit a collapse ending instead (numbers are then not comparable). */
  altEnding: string | null;
}

export interface ReportCard {
  chapter: number;
  you: PathSummary;
  best: PathSummary;
  foil: PathSummary;
  decisions: DecisionImpact[];
  concepts: string[];
  qualityCounts: Record<QualityT, number>;
}

export function summarize(s: RunState): PathSummary {
  return {
    netWorth: netWorth(s),
    savings: s.ledger.savings,
    emergencyMonths: emergencyMonths(s),
    debt: totalDebt(s),
    creditScore: s.creditScore,
    wellbeing: wellbeingLevel(s),
    relationships: relationshipsLevel(s),
    ended: s.phase === 'ending' ? s.ending : null,
  };
}

function playChapter(engine: Engine, start: RunState, policy: Policy): RunState {
  return autoplay(engine, start, policy, atChapterEnd(start.chapter)).state;
}

export function buildReportCard(engine: Engine, chapterStart: RunState, actual: RunState): ReportCard {
  const chapter = chapterStart.chapter;
  const mine = actual.history.filter((h) => h.chapter === chapter && h.month >= chapterStart.month);
  const record = mine.map((h) => ({ sceneId: h.sceneId, choiceId: h.choiceId }));
  const fallback = bestPolicy;
  const you = summarize(actual);

  const decisions: DecisionImpact[] = [];
  const occurrences = new Map<string, number>();
  for (const h of mine) {
    const k = (occurrences.get(h.sceneId) ?? 0) + 1;
    occurrences.set(h.sceneId, k);
    const scene = engine.idx.scenes.get(h.sceneId)!.scene;
    const best = bestPolicy(scene, scene.choices, actual);
    let netWorthIfBest = 0;
    let wellbeingIfBest = 0;
    let altEnding: string | null = null;
    if (best.id !== h.choiceId && best.quality !== h.quality) {
      const alt = playChapter(engine, chapterStart, replayPolicy(record, fallback, new Map([[`${h.sceneId}#${k}`, best.id]])));
      const sum = summarize(alt);
      altEnding = sum.ended;
      if (!altEnding) {
        netWorthIfBest = sum.netWorth - you.netWorth;
        wellbeingIfBest = sum.wellbeing - you.wellbeing;
      }
    }
    decisions.push({
      sceneId: h.sceneId,
      choiceId: h.choiceId,
      quality: h.quality,
      bestChoiceId: best.id === h.choiceId || best.quality === h.quality ? null : best.id,
      netWorthIfBest,
      wellbeingIfBest,
      altEnding,
    });
  }

  const qualityCounts: Record<QualityT, number> = { best: 0, good: 0, risky: 0, costly: 0 };
  for (const h of mine) qualityCounts[h.quality]++;

  return {
    chapter,
    you,
    best: summarize(playChapter(engine, chapterStart, bestPolicy)),
    foil: summarize(playChapter(engine, chapterStart, foilPolicy)),
    decisions,
    concepts: [...new Set(mine.flatMap((h) => h.concepts))],
    qualityCounts,
  };
}
