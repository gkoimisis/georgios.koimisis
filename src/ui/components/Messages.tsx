import type { Message } from '../../content/schema';
import { characterOf } from '../engine';

/** Character texts, styled like a phone's message thread. */
export function Messages({ texts, render }: { texts: Message[]; render: (s: string) => string }) {
  if (!texts.length) return null;
  return (
    <div class="phone" role="log" aria-label="Messages">
      {texts.map((m, i) => {
        const c = characterOf(m.from);
        const name = c?.name ?? m.from;
        const grouped = i > 0 && texts[i - 1]!.from === m.from;
        return (
          <div class="msg" key={i} style={{ animationDelay: `${i * 0.25}s` }}>
            <span class="msg-avatar" style={{ background: c?.color ?? '#777', visibility: grouped ? 'hidden' : 'visible' }} aria-hidden="true">
              {c?.avatar ?? '?'}
            </span>
            <div class="msg-body">
              {!grouped && <div class="msg-name">{name}</div>}
              <p class="bubble">
                <span class="sr-only">{name}: </span>
                {render(m.text)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
