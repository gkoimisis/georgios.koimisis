import type { RunState } from '../../engine/state';
import { availableChoices, currentEpisode, currentScene, renderText } from '../../engine/step';
import { t } from '../../i18n';
import { engine } from '../engine';
import { useAutoFocus, useHotkeys } from '../hooks';
import { Messages } from './Messages';

export function SceneView({ run, onChoose }: { run: RunState; onChoose: (id: string) => void }) {
  const scene = currentScene(engine, run)!;
  const choices = availableChoices(engine, run, scene);
  const ep = currentEpisode(engine, run);
  const head = useAutoFocus<HTMLHeadingElement>();
  const render = (s: string) => renderText(engine, run, s);
  useHotkeys(Object.fromEntries(choices.map((c, i) => [String(i + 1), () => onChoose(c.id)])));

  return (
    <article class="stack" aria-labelledby="scene-title">
      <div class="scene-head">
        <p class="eyebrow">
          {run.inInterrupt ? t('scene.interrupt') : ep ? t('scene.episode', { n: run.episode + 1, title: ep.title }) : ''}
        </p>
        {scene.boss && <span class="tag">⚡ {t('scene.boss')}</span>}
      </div>
      <h2 id="scene-title" class="scene-title" ref={head} tabIndex={-1}>
        {scene.title ?? ''}
      </h2>
      {scene.texts && <Messages texts={scene.texts} render={render} />}
      <p class="setup">{render(scene.setup)}</p>
      <section aria-labelledby="choose-label" class="stack-sm">
        <h3 id="choose-label" class="eyebrow">
          {t('scene.choose')}
        </h3>
        <ul class="choices">
          {choices.map((c, i) => (
            <li key={c.id}>
              <button class="choice" onClick={() => onChoose(c.id)}>
                <span class="choice-key" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{render(c.text)}</span>
              </button>
            </li>
          ))}
        </ul>
        <p class="tiny muted hide-touch">{t('scene.keyHint', { n: choices.length })}</p>
      </section>
    </article>
  );
}
