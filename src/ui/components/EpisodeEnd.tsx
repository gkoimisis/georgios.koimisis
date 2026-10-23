import type { RunState } from '../../engine/state';
import { renderText } from '../../engine/step';
import { t } from '../../i18n';
import { engine } from '../engine';
import { useAutoFocus, useHotkeys } from '../hooks';
import { Messages } from './Messages';

export function EpisodeEnd({ run, onContinue }: { run: RunState; onContinue: () => void }) {
  const ch = engine.idx.chapters.get(run.chapter)!;
  const ep = ch.episodes[run.episode]!;
  const last = run.episode === ch.episodes.length - 1;
  const head = useAutoFocus<HTMLHeadingElement>();
  useHotkeys({ Enter: onContinue });
  return (
    <div class="stack">
      <div>
        <p class="eyebrow">✅ {t('episode.complete')}</p>
        <h2 class="scene-title" ref={head} tabIndex={-1}>
          {ep.title}
        </h2>
      </div>
      {ep.hook.texts && <Messages texts={ep.hook.texts} render={(s) => renderText(engine, run, s)} />}
      <p>{ep.hook.text}</p>
      <section class="card card-tight stack-sm">
        <p class="eyebrow">{t('episode.next')}</p>
        <p style={{ fontWeight: 650 }}>{ep.teaser}</p>
      </section>
      <p class="small muted">{t('episode.pause')}</p>
      <div class="sticky-actions">
        <button class="btn btn-block" onClick={onContinue}>
          {last ? t('report.title', { n: ch.chapter }) : t('episode.continue')}
        </button>
      </div>
    </div>
  );
}
