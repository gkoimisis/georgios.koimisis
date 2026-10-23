import { useEffect, useRef } from 'preact/hooks';

/** Move focus to the returned element when the view mounts, so screen readers announce it. */
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: false });
    window.scrollTo({ top: 0 });
  }, []);
  return ref;
}

function isTyping(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable;
}

/** Keyboard shortcuts that ignore typing and don't steal Enter from focused buttons/links. */
export function useHotkeys(map: Record<string, () => void>, enabled = true) {
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      if (document.querySelector('[data-sheet-open]')) return;
      if (e.key === 'Enter') {
        const a = document.activeElement;
        if (a && (a.tagName === 'BUTTON' || a.tagName === 'A' || a.tagName === 'SUMMARY')) return;
      }
      const fn = latest.current[e.key];
      if (fn) {
        e.preventDefault();
        fn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
