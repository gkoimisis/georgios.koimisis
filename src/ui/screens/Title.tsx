import { config } from '../../config';
import type { RunState } from '../../engine/state';
import { t } from '../../i18n';
import { useAutoFocus } from '../hooks';

function Art() {
  return (
    <svg class="title-art" viewBox="0 0 320 120" role="presentation" aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="var(--primary)" stop-opacity="0.35" />
          <stop offset="1" stop-color="var(--primary)" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="M0,110 C60,108 90,100 130,88 C180,72 220,48 320,8 L320,120 L0,120 Z" fill="url(#g)" />
      <path d="M0,110 C60,108 90,100 130,88 C180,72 220,48 320,8" fill="none" stroke="var(--primary)" stroke-width="4" stroke-linecap="round" />
      {[40, 100, 160, 220, 280].map((x, i) => (
        <circle key={x} cx={x} cy={[109, 98, 79, 56, 26][i]} r={5 + i * 1.5} fill="var(--gold)" stroke="var(--surface)" stroke-width="2" />
      ))}
    </svg>
  );
}

export function Title({ run, onNew, onContinue }: { run: RunState | null; onNew: () => void; onContinue: () => void }) {
  const head = useAutoFocus<HTMLHeadingElement>();
  const resumable = !!run;
  const age = run ? Math.floor((run.startAgeMonths + run.month) / 12) : 0;
  return (
    <main class="column title-screen stack" id="main">
      <div class="logo">
        <h1 ref={head} tabIndex={-1}>
          {config.title}
        </h1>
      </div>
      <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 650 }}>{t('title.tagline')}</p>
      <Art />
      <p class="muted">{t('title.pitch')}</p>
      <div class="stack-sm">
        {resumable && (
          <button class="btn btn-block" onClick={onContinue}>
            {t('title.continue')}
            <span class="small" style={{ opacity: 0.85, fontWeight: 500 }}>
              · {t('title.continueDetail', { age, chapter: run.chapter })}
            </span>
          </button>
        )}
        <button class={`btn btn-block ${resumable ? 'btn-secondary' : ''}`} onClick={onNew}>
          {t('title.new')}
        </button>
      </div>
      <p class="tiny muted">🔒 {t('title.privacy')}</p>
    </main>
  );
}
