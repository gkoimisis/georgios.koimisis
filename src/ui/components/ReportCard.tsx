import { useMemo } from 'preact/hooks';
import { buildReportCard, summarize, type PathSummary } from '../../engine/report';
import type { RunState } from '../../engine/state';
import { config } from '../../config';
import { t } from '../../i18n';
import { characterOf, engine, fmt, sceneTitle } from '../engine';
import { useAutoFocus, useHotkeys } from '../hooks';
import { QualityBadge } from './QualityBadge';

type Row = { key: keyof PathSummary; label: string; show: (p: PathSummary) => string };

const ROWS: Row[] = [
  { key: 'netWorth', label: 'metric.netWorth', show: (p) => fmt.usd(p.netWorth) },
  { key: 'savings', label: 'metric.savings', show: (p) => fmt.usd(p.savings) },
  { key: 'emergencyMonths', label: 'metric.emergencyMonths', show: (p) => t('metric.months', { n: fmt.num1(p.emergencyMonths) }) },
  { key: 'debt', label: 'metric.debt', show: (p) => fmt.usd(p.debt) },
  { key: 'creditScore', label: 'metric.creditScore', show: (p) => (p.creditScore === null ? '—' : String(p.creditScore)) },
  { key: 'wellbeing', label: 'metric.wellbeing', show: (p) => String(Math.round(p.wellbeing)) },
  { key: 'relationships', label: 'metric.relationships', show: (p) => String(Math.round(p.relationships)) },
];

export function ReportCard({ run, chapterStart, onContinue }: { run: RunState; chapterStart: RunState | null; onContinue: () => void }) {
  const ch = engine.idx.chapters.get(run.chapter)!;
  const head = useAutoFocus<HTMLHeadingElement>();
  useHotkeys({ Enter: onContinue });
  const foilName = characterOf(config.foilCharacter)?.name ?? 'Friend';
  const rc = useMemo(
    () => (chapterStart && chapterStart.chapter === run.chapter ? buildReportCard(engine, chapterStart, run) : null),
    [run, chapterStart],
  );
  const decisions = rc?.decisions ?? [];
  const mine = run.history.filter((h) => h.chapter === run.chapter);
  const you = rc?.you ?? summarize(run);

  return (
    <div class="stack">
      <div>
        <p class="eyebrow">
          {t('intro.chapter', { n: ch.chapter })} · {ch.title}
        </p>
        <h2 class="scene-title" ref={head} tabIndex={-1}>
          {t('report.title', { n: ch.chapter })}
        </h2>
        {rc && (
          <p class="small muted">
            {t('report.mix', { best: rc.qualityCounts.best, good: rc.qualityCounts.good, risky: rc.qualityCounts.risky, costly: rc.qualityCounts.costly })}
          </p>
        )}
      </div>

      <section class="card stack-sm" aria-labelledby="recap-h">
        <h3 id="recap-h">{t('report.recap')}</h3>
        <ul class="checklist small">
          {ch.recap.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section class="card stack-sm" aria-labelledby="compare-h">
        <h3 id="compare-h">{t('report.compare')}</h3>
        <table class="compare">
          <thead>
            <tr>
              <th scope="col">
                <span class="sr-only">Measure</span>
              </th>
              <th scope="col">{t('report.you')}</th>
              {rc && <th scope="col">{t('report.best')}</th>}
              {rc && <th scope="col">{t('report.foil', { name: foilName })}</th>}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key}>
                <th scope="row">{t(r.label)}</th>
                <td class="you">{r.show(you)}</td>
                {rc && <td>{r.show(rc.best)}</td>}
                {rc && <td>{rc.foil.ended ? '💥' : r.show(rc.foil)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {rc && <p class="tiny muted">{t('report.note', { name: foilName })}</p>}
      </section>

      <section class="stack-sm" aria-labelledby="dec-h">
        <h3 id="dec-h">{t('report.decisions')}</h3>
        <ol class="decision-list">
          {mine.map((h, i) => {
            const scene = engine.idx.scenes.get(h.sceneId)!.scene;
            const choice = scene.choices.find((c) => c.id === h.choiceId);
            const d = decisions[i];
            let impact = t('report.alreadyBest');
            if (d?.bestChoiceId) {
              impact = d.altEnding
                ? t('report.altCollapsed')
                : Math.abs(d.netWorthIfBest) < 1 && Math.abs(d.wellbeingIfBest) < 1
                ? t('report.sameMoney')
                : `${t('report.ifBest', { amount: `${d.netWorthIfBest >= 0 ? '+' : '−'}${fmt.usd(Math.abs(d.netWorthIfBest))}` })}${
                    Math.abs(d.wellbeingIfBest) >= 1 ? ` · ${t('report.ifBestWellbeing', { amount: `${d.wellbeingIfBest >= 0 ? '+' : '−'}${Math.round(Math.abs(d.wellbeingIfBest))}` })}` : ''
                  }`;
            }
            return (
              <li class="decision stack-sm" key={i}>
                <div class="decision-title">
                  <span>{sceneTitle(h.sceneId)}</span>
                  <QualityBadge quality={h.quality} />
                </div>
                <p class="small">{choice?.text}</p>
                {d && <p class="tiny muted">{impact}</p>}
              </li>
            );
          })}
        </ol>
      </section>

      <section class="stack-sm" aria-labelledby="rules-h">
        <h3 id="rules-h">{t('report.rules')}</h3>
        <ul class="rules-list">
          {[...new Set(mine.map((h) => h.sceneId))].map((id) => (
            <li key={id}>{engine.idx.scenes.get(id)!.scene.takeaway}</li>
          ))}
        </ul>
      </section>

      <div class="sticky-actions">
        <button class="btn btn-block" onClick={onContinue}>
          {t('report.continue')}
        </button>
      </div>
    </div>
  );
}
