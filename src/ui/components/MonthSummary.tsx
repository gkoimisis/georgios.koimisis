import type { RunState } from '../../engine/state';
import { t, tn } from '../../i18n';
import { useAutoFocus, useHotkeys } from '../hooks';
import { Notices } from './Notices';

export function MonthSummary({ run, onContinue }: { run: RunState; onContinue: () => void }) {
  const head = useAutoFocus<HTMLHeadingElement>();
  useHotkeys({ Enter: onContinue });
  const bank = run.inbox.filter((n) => n.kind !== 'event');
  const life = run.inbox.filter((n) => n.kind === 'event');
  return (
    <div class="stack">
      <h2 class="scene-title" ref={head} tabIndex={-1}>
        {tn('summary.later', run.inboxMonths)}
      </h2>
      {life.length > 0 && (
        <section class="stack-sm" aria-labelledby="life-h">
          <h3 id="life-h" class="eyebrow">
            {t('summary.events')}
          </h3>
          <Notices items={life} />
        </section>
      )}
      <section class="stack-sm" aria-labelledby="bank-h">
        <h3 id="bank-h" class="eyebrow">
          {t('summary.title')}
        </h3>
        <Notices items={bank} />
      </section>
      <div class="sticky-actions">
        <button class="btn btn-block" onClick={onContinue}>
          {t('summary.continue')}
        </button>
      </div>
    </div>
  );
}
