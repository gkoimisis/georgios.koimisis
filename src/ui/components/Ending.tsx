import type { RunState } from '../../engine/state';
import { summarize } from '../../engine/report';
import { t } from '../../i18n';
import { engine, fmt } from '../engine';
import { useAutoFocus } from '../hooks';

export function Ending({ run, canRewind, onRewind, onNewLife }: { run: RunState; canRewind: boolean; onRewind: () => void; onNewLife: () => void }) {
  const end = engine.content.endings.find((e) => e.id === run.ending);
  const head = useAutoFocus<HTMLHeadingElement>();
  const collapse = end?.kind === 'collapse';
  const sum = summarize(run);
  return (
    <div class="stack">
      <h2 class="scene-title" ref={head} tabIndex={-1}>
        {collapse ? '💥 ' : '🌱 '}
        {end?.title ?? t('end.title')}
      </h2>
      <p>{end?.text}</p>
      {end?.lesson && (
        <div class="callout">
          <strong>{t('ending.lesson')}</strong>
          {end.lesson}
        </div>
      )}
      {collapse && <p class="small muted">{t('ending.collapseNote')}</p>}
      {!collapse && (
        <section class="card card-tight">
          <div class="details" style={{ padding: 0 }}>
            <dl>
              <dt>{t('metric.netWorth')}</dt>
              <dd>{fmt.usd(sum.netWorth)}</dd>
              <dt>{t('metric.emergencyMonths')}</dt>
              <dd>{t('metric.months', { n: fmt.num1(sum.emergencyMonths) })}</dd>
              <dt>{t('metric.wellbeing')}</dt>
              <dd>{Math.round(sum.wellbeing)}</dd>
            </dl>
          </div>
        </section>
      )}
      <div class="stack-sm">
        {collapse && canRewind && (
          <button class="btn btn-block" onClick={onRewind}>
            ⏪ {t('ending.rewind')}
          </button>
        )}
        <button class={`btn btn-block ${collapse && canRewind ? 'btn-secondary' : ''}`} onClick={onNewLife}>
          {t('ending.newLife')}
        </button>
      </div>
    </div>
  );
}
