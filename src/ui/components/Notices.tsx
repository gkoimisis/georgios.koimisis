import type { Notice } from '../../engine/state';
import { fmt } from '../engine';

/** Bank-style notification list. */
export function Notices({ items }: { items: Notice[] }) {
  return (
    <ul class="notices">
      {items.map((n, i) => (
        <li class={`notice ${n.kind}`} key={i} style={{ animationDelay: `${Math.min(i, 8) * 0.06}s` }}>
          <span class="notice-icon" aria-hidden="true">
            {n.icon}
          </span>
          <div class="notice-main">
            <div class="notice-title">{n.title}</div>
            {n.body && <div class="notice-body">{n.body}</div>}
          </div>
          {n.amount !== undefined && Math.abs(n.amount) >= 0.5 && (
            <span class={`notice-amount ${n.amount >= 0 ? 'pos' : 'neg'}`}>
              {n.amount >= 0 ? '+' : '−'}
              {fmt.usd(Math.abs(n.amount))}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
