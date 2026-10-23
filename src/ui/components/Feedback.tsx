import { useEffect, useRef, useState } from 'preact/hooks';
import type { FeedbackData, MeterDelta } from '../../engine/state';
import { t } from '../../i18n';
import { conceptOf, engine, fmt } from '../engine';
import { useAutoFocus, useHotkeys } from '../hooks';
import { Notices } from './Notices';
import { QualityBadge } from './QualityBadge';

/** Increase is good for these; for debt, a decrease is good. */
const UP_IS_GOOD: Record<MeterDelta['key'], boolean> = {
  cash: true, savings: true, emergency: true, debt: false, credit: true, wellbeing: true, relationships: true,
};

function deltaText(d: MeterDelta): string {
  const diff = d.after - d.before;
  const sign = diff >= 0 ? '+' : '−';
  const label = t(`delta.${d.key}`);
  if (d.key === 'emergency') return `${label} ${fmt.num1(d.before)} → ${fmt.num1(d.after)} mo`;
  if (d.key === 'cash' || d.key === 'savings' || d.key === 'debt') return `${label} ${sign}${fmt.usd(Math.abs(diff))}`;
  return `${label} ${sign}${Math.round(Math.abs(diff))}`;
}

function Step({ n, title, quality, children }: { n: number; title: string; quality?: string; children: preact.ComponentChildren }) {
  return (
    <section class={`card feedback-card stack-sm ${quality ? `q-${quality}` : ''}`} aria-labelledby={`fb-${n}`}>
      <h3 id={`fb-${n}`}>
        <span class="step-num" aria-hidden="true">
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function Feedback({ fb, stepwise, ruleNew, onContinue }: { fb: FeedbackData; stepwise: boolean; ruleNew: boolean; onContinue: () => void }) {
  const [shown, setShown] = useState(stepwise ? 1 : 4);
  const head = useAutoFocus<HTMLHeadingElement>();
  const lastCard = useRef<HTMLDivElement>(null);
  const scene = engine.idx.scenes.get(fb.sceneId)!.scene;
  const choice = scene.choices.find((c) => c.id === fb.choiceId)!;
  const next = () => (shown < 4 ? setShown(shown + 1) : onContinue());
  useHotkeys({ Enter: next });

  useEffect(() => {
    if (shown > 1) lastCard.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [shown]);

  const tagNote = (tag: FeedbackData['bias'], kind: 'bias' | 'pattern') => {
    if (!tag) return null;
    const c = conceptOf(tag.id);
    if (!c) return null;
    const key = kind === 'bias' ? (tag.resisted ? 'fb.biasResisted' : 'fb.biasFell') : tag.resisted ? 'fb.patternResisted' : 'fb.patternFell';
    return (
      <div class={`callout ${tag.resisted ? 'good' : ''}`}>
        <strong>
          {kind === 'bias' ? '🧠 ' : '🕵️ '}
          {t(key, { name: c.name })}
        </strong>
        {c.summary}
      </div>
    );
  };

  return (
    <div class="stack">
      <div>
        <p class="eyebrow">{scene.title}</p>
        <h2 class="scene-title" ref={head} tabIndex={-1}>
          {choice.text}
        </h2>
      </div>
      <div class="stack" aria-live="polite">
        <Step n={1} title={t('fb.whatHappened')} quality={fb.quality}>
          <QualityBadge quality={fb.quality} />
          <p>{fb.outcome}</p>
          {fb.deltas.length > 0 && (
            <ul class="deltas" aria-label="Changes">
              {fb.deltas.map((d) => {
                const good = d.after > d.before === UP_IS_GOOD[d.key];
                return (
                  <li key={d.key} class={`delta ${good ? 'up' : 'down'}`}>
                    {deltaText(d)}
                  </li>
                );
              })}
            </ul>
          )}
          {fb.notes.length > 0 && <Notices items={fb.notes} />}
          {tagNote(fb.bias, 'bias')}
          {tagNote(fb.darkPattern, 'pattern')}
        </Step>
        {shown >= 2 && (
          <div ref={shown === 2 ? lastCard : undefined}>
            <Step n={2} title={t('fb.concept')}>
              <p>{fb.explanation}</p>
              <div class="labels">
                {scene.concepts.map((id) => (
                  <span class="label" key={id}>
                    {conceptOf(id)?.name ?? id}
                  </span>
                ))}
              </div>
            </Step>
          </div>
        )}
        {shown >= 3 && (
          <div ref={shown === 3 ? lastCard : undefined}>
            <Step n={3} title={t('fb.why')}>
              <p class="why-text">{fb.why.text}</p>
              <div class="labels">
                {fb.why.personal && <span class="label">📍 {t('fb.yourNumbers')}</span>}
                {fb.why.illustrative && <span class="label">≈ {t(fb.why.personal ? 'fb.illustrativeRates' : 'fb.illustrative')}</span>}
              </div>
              <details class="math">
                <summary>{t('fb.showMath')}</summary>
                <ol>
                  {fb.why.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
                <p class="tiny muted">{t('fb.formula')}</p>
                <p class="formula">{fb.why.formula}</p>
              </details>
            </Step>
          </div>
        )}
        {shown >= 4 && (
          <div ref={shown === 4 ? lastCard : undefined} class="rule-card stack-sm">
            <p class="eyebrow" style={{ color: 'var(--gold)' }}>
              📜 {t('fb.takeaway')}
            </p>
            <p class="rule-text">{fb.takeaway}</p>
            {ruleNew && <p class="tiny muted">{t('fb.ruleCollected')}</p>}
          </div>
        )}
      </div>
      <div class="sticky-actions">
        <button class="btn btn-block" onClick={next}>
          {shown < 4 ? `${t('fb.next')} · ${t('fb.step', { n: shown + 1 })}` : t('fb.continue')}
        </button>
      </div>
    </div>
  );
}
