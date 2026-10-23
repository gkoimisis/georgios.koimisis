import { useState } from 'preact/hooks';
import { ChapterIntro } from '../components/ChapterIntro';
import { Ending } from '../components/Ending';
import { EpisodeEnd } from '../components/EpisodeEnd';
import { Feedback } from '../components/Feedback';
import { Menu } from '../components/Menu';
import { MetersBar } from '../components/MetersBar';
import { MonthSummary } from '../components/MonthSummary';
import { ReportCard } from '../components/ReportCard';
import { SceneView } from '../components/SceneView';
import type { Game as GameApi } from '../useGame';

export function Game({ game, onTitle }: { game: GameApi; onTitle: () => void }) {
  const [menu, setMenu] = useState(false);
  const run = game.save.run!;
  const go = () => game.act({ type: 'continue' });
  // A key that changes with every screen remounts the view, resetting focus and step state.
  const viewKey = `${run.phase}:${run.sceneId}:${run.month}:${run.history.length}:${run.episode}:${run.chapter}`;

  let view;
  switch (run.phase) {
    case 'chapterIntro':
      view = <ChapterIntro run={run} onBegin={() => game.act({ type: 'begin' })} />;
      break;
    case 'scene':
      view = <SceneView run={run} onChoose={(choiceId) => game.act({ type: 'choose', choiceId })} />;
      break;
    case 'feedback':
      view = <Feedback fb={run.feedback!} stepwise={game.save.settings.stepFeedback} ruleNew={game.lastRuleNew} onContinue={go} />;
      break;
    case 'summary':
      view = <MonthSummary run={run} onContinue={go} />;
      break;
    case 'episodeEnd':
      view = <EpisodeEnd run={run} onContinue={go} />;
      break;
    case 'chapterEnd':
      view = <ReportCard run={run} chapterStart={game.save.chapterStart} onContinue={go} />;
      break;
    case 'ending':
      view = <Ending run={run} canRewind={!!game.save.chapterStart} onRewind={game.rewind} onNewLife={game.newRun} />;
      break;
  }

  return (
    <>
      <a href="#main" class="skip-link">
        Skip to story
      </a>
      <MetersBar run={run} onMenu={() => setMenu(true)} />
      <main class="column" id="main" key={viewKey}>
        {view}
      </main>
      {menu && (
        <Menu
          save={game.save}
          persistent={game.persistent}
          onClose={() => setMenu(false)}
          onSettings={game.setSettings}
          exportSave={game.exportSave}
          importSave={game.importSave}
          onRestart={() => {
            setMenu(false);
            game.newRun();
          }}
          onTitle={() => {
            setMenu(false);
            onTitle();
          }}
        />
      )}
    </>
  );
}
