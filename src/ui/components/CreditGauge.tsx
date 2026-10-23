import { t } from '../../i18n';

/** Semicircle gauge from 300 to 850. Shows "No score yet" before any credit history. */
export function CreditGauge({ score }: { score: number | null }) {
  const r = 34;
  const cx = 40;
  const cy = 40;
  const frac = score === null ? 0 : (score - 300) / 550;
  const angle = Math.PI * (1 - frac);
  const nx = cx + r * Math.cos(angle);
  const ny = cy - r * Math.sin(angle);
  const color = score === null ? 'var(--ink-muted)' : score >= 700 ? 'var(--q-best)' : score >= 620 ? 'var(--q-risky)' : 'var(--q-costly)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg viewBox="0 0 80 46" width="80" height="46" aria-hidden="true">
        <path d={`M6,40 A${r},${r} 0 0 1 74,40`} fill="none" stroke="var(--meter-track)" stroke-width="7" stroke-linecap="round" />
        {score !== null && (
          <path d={`M6,40 A${r},${r} 0 0 1 ${nx.toFixed(1)},${ny.toFixed(1)}`} fill="none" stroke={color} stroke-width="7" stroke-linecap="round" />
        )}
      </svg>
      <div>
        <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)', color }}>{score ?? '—'}</div>
        <div class="tiny muted">{score === null ? t('meters.noScore') : t('meters.creditModel')}</div>
      </div>
    </div>
  );
}
