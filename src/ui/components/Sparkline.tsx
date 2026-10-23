import { t } from '../../i18n';
import { fmt } from '../engine';

/** Net worth over time. The label carries the information for screen readers. */
export function Sparkline({ points }: { points: { m: number; nw: number }[] }) {
  if (points.length < 2) return null;
  const w = 200;
  const h = 40;
  const xs = points.map((p) => p.m);
  const ys = points.map((p) => p.nw);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) || 1;
  const minY = Math.min(0, ...ys);
  const maxY = Math.max(1, ...ys);
  const x = (v: number) => ((v - minX) / (maxX - minX || 1)) * (w - 4) + 2;
  const y = (v: number) => h - 2 - ((v - minY) / (maxY - minY || 1)) * (h - 4);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p.nw).toFixed(1)}`).join(' ');
  const last = points[points.length - 1]!;
  const label = t('meters.timeline', { from: fmt.usd(points[0]!.nw), to: fmt.usd(last.nw) });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {minY < 0 && <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="var(--line)" stroke-dasharray="3 3" />}
      <path d={d} fill="none" stroke="var(--primary)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      <circle cx={x(last.m)} cy={y(last.nw)} r="3" fill="var(--accent)" />
    </svg>
  );
}
