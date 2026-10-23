import type { RunState } from '../../engine/state';
import { netMonthlyIncome } from '../../engine/vars';
import { t } from '../../i18n';
import { engine, fmt } from '../engine';
import { useAutoFocus, useHotkeys } from '../hooks';

export function ChapterIntro({ run, onBegin }: { run: RunState; onBegin: () => void }) {
  const ch = engine.idx.chapters.get(run.chapter)!;
  const bg = engine.content.backgrounds.find((b) => b.id === run.backgroundId);
  const first = run.month === 0;
  const head = useAutoFocus<HTMLHeadingElement>();
  useHotkeys({ Enter: onBegin });
  return (
    <div class="stack">
      <div>
        <p class="eyebrow">
          {t('intro.chapter', { n: ch.chapter })} · {t('intro.ages', { ages: ch.ages })}
        </p>
        <h2 class="scene-title" ref={head} tabIndex={-1}>
          {ch.title}
        </h2>
      </div>
      {first && bg && (
        <section class="card card-tight stack-sm" aria-labelledby="bg-title">
          <p class="eyebrow">{t('intro.background')}</p>
          <h3 id="bg-title">{bg.title}</h3>
          <p class="small">{bg.blurb}</p>
          <p class="small muted">
            {fmt.usd(netMonthlyIncome(run, engine.locale))}/mo take-home · {fmt.usd(run.ledger.savings)} saved · {fmt.usd(run.ledger.rent)} rent
            {run.ledger.card > 0 ? ` · ${fmt.usd(run.ledger.card)} on a credit card` : ''}
          </p>
        </section>
      )}
      <section class="card card-tight stack-sm" aria-labelledby="learn-title">
        <h3 id="learn-title" class="eyebrow">
          {t('intro.learn')}
        </h3>
        <ul class="checklist small">
          {ch.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>
      {ch.episodes[0]?.intro && <p>{ch.episodes[0].intro}</p>}
      <div class="sticky-actions">
        <button class="btn btn-block" onClick={onBegin}>
          {t('intro.begin')}
        </button>
      </div>
    </div>
  );
}
