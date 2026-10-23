import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import type { SaveFile, Settings } from '../../save/storage';
import { engine } from '../engine';

type Tab = 'rules' | 'settings' | 'save';

export interface MenuProps {
  save: SaveFile;
  persistent: boolean;
  onClose: () => void;
  onSettings: (p: Partial<Settings>) => void;
  exportSave: () => string;
  importSave: (code: string) => boolean;
  onRestart: () => void;
  onTitle: () => void;
}

/** Bottom sheet with Money Rules, Settings and save codes. Traps focus while open. */
export function Menu(p: MenuProps) {
  const [tab, setTab] = useState<Tab>('rules');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const sheet = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    opener.current = document.activeElement;
    sheet.current?.querySelector<HTMLElement>('h2')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onClose();
      if (e.key !== 'Tab' || !sheet.current) return;
      const els = sheet.current.querySelectorAll<HTMLElement>('button, textarea, select, input, summary, [href]');
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      (opener.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  const s = p.save.settings;
  const rules = p.save.profile.rules.map((id) => engine.idx.scenes.get(id)?.scene).filter((x) => !!x);

  const copy = async () => {
    const text = p.exportSave();
    try {
      await navigator.clipboard.writeText(text);
      setMsg(t('save.copied'));
    } catch {
      setCode(text);
      setMsg('');
    }
  };

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && p.onClose()} data-sheet-open>
      <div class="sheet stack" role="dialog" aria-modal="true" aria-labelledby="menu-title" ref={sheet}>
        <div class="sheet-head">
          <h2 id="menu-title" tabIndex={-1}>
            {t('menu.title')}
          </h2>
          <button class="icon-btn" onClick={p.onClose} aria-label={t('menu.close')}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <div class="tabs" role="tablist">
          {(['rules', 'settings', 'save'] as Tab[]).map((k) => (
            <button key={k} role="tab" class="tab" aria-selected={tab === k} aria-controls={`panel-${k}`} id={`tab-${k}`} onClick={() => setTab(k)}>
              {t(`menu.${k}`)}
            </button>
          ))}
        </div>

        {tab === 'rules' && (
          <section id="panel-rules" role="tabpanel" aria-labelledby="tab-rules" class="stack-sm">
            <p class="small muted">{t('rules.count', { n: rules.length })}</p>
            {rules.length === 0 ? (
              <p>{t('rules.empty')}</p>
            ) : (
              <ul class="rules-list">
                {rules.map((sc) => (
                  <li key={sc.id}>{sc.takeaway}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === 'settings' && (
          <section id="panel-settings" role="tabpanel" aria-labelledby="tab-settings" class="stack-sm">
            <div class="field-row">
              <label for="set-theme">{t('settings.theme')}</label>
              <select id="set-theme" value={s.theme} onChange={(e) => p.onSettings({ theme: (e.target as HTMLSelectElement).value as Settings['theme'] })}>
                <option value="system">{t('settings.theme.system')}</option>
                <option value="light">{t('settings.theme.light')}</option>
                <option value="dark">{t('settings.theme.dark')}</option>
              </select>
            </div>
            <div class="field-row">
              <label for="set-contrast">{t('settings.contrast')}</label>
              <input id="set-contrast" type="checkbox" checked={s.highContrast} onChange={(e) => p.onSettings({ highContrast: (e.target as HTMLInputElement).checked })} />
            </div>
            <div class="field-row">
              <label for="set-text">
                {t('settings.textSize')} ({Math.round(s.textScale * 100)}%)
              </label>
              <input
                id="set-text"
                type="range"
                min="0.9"
                max="1.5"
                step="0.1"
                value={s.textScale}
                onInput={(e) => p.onSettings({ textScale: Number((e.target as HTMLInputElement).value) })}
              />
            </div>
            <div class="field-row">
              <label for="set-motion">{t('settings.motion')}</label>
              <input id="set-motion" type="checkbox" checked={s.reduceMotion} onChange={(e) => p.onSettings({ reduceMotion: (e.target as HTMLInputElement).checked })} />
            </div>
            <div class="field-row">
              <label for="set-step">{t('settings.stepFeedback')}</label>
              <input id="set-step" type="checkbox" checked={s.stepFeedback} onChange={(e) => p.onSettings({ stepFeedback: (e.target as HTMLInputElement).checked })} />
            </div>
          </section>
        )}

        {tab === 'save' && (
          <section id="panel-save" role="tabpanel" aria-labelledby="tab-save" class="stack-sm">
            {!p.persistent && <p class="callout small">{t('save.storageOff')}</p>}
            <p class="small">{t('save.exportHelp')}</p>
            <button class="btn btn-secondary" onClick={copy}>
              📋 {t('save.copy')} {t('save.exportLabel').toLowerCase()}
            </button>
            <div class="field">
              <label for="save-code">{t('save.importLabel')}</label>
              <textarea id="save-code" value={code} onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} spellcheck={false} />
            </div>
            <button
              class="btn"
              disabled={!code.trim()}
              onClick={() => {
                const ok = p.importSave(code);
                setMsg(ok ? t('save.loaded') : t('save.invalid'));
                if (ok) setCode('');
              }}
            >
              {t('save.import')}
            </button>
          </section>
        )}
        <p role="status" class="small">
          {msg}
        </p>

        <div class="btn-row">
          <button class="btn btn-secondary" onClick={p.onTitle}>
            {t('menu.title_screen')}
          </button>
          <button
            class="btn btn-ghost"
            onClick={() => {
              if (window.confirm(t('restart.confirm'))) p.onRestart();
            }}
          >
            {t('menu.restart')}
          </button>
        </div>
      </div>
    </div>
  );
}
