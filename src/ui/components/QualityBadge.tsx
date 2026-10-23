import type { QualityT } from '../../content/schema';
import { t } from '../../i18n';

const ICON: Record<QualityT, string> = { best: '★', good: '✓', risky: '⚠', costly: '✕' };

export function QualityBadge({ quality }: { quality: QualityT }) {
  return (
    <span class={`quality ${quality}`}>
      <span aria-hidden="true">{ICON[quality]}</span>
      {t(`quality.${quality}`)}
    </span>
  );
}
