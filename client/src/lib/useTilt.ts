// 3D tilt: cards lean toward the mouse and a soft light follows the pointer.
// One delegated listener for the whole app, so new cards need no wiring:
// any element matching TILT_SELECTOR (or with the `tilt` class) takes part.
// Off for touch, and off when Reduce motion is on (app setting or OS).
import { useEffect } from 'react';

export const TILT_SELECTOR = '.tilt, .lesson-card, .tile, .video-card, .badge-tile.earned, .level-card, .exam-card, .road-card';
const MAX_DEG = 7;

export function useTilt(enabled: boolean) {
  useEffect(() => {
    const osReduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!enabled || osReduce?.matches) return;
    let active: HTMLElement | null = null;
    let frame = 0;

    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.remove('is-tilting');
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element | null)?.closest?.(TILT_SELECTOR) as HTMLElement | null;
      if (el !== active) {
        reset(active);
        active = el;
      }
      if (!el) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width; // 0..1
        const y = (e.clientY - r.top) / r.height;
        // Big panels lean less than small cards.
        const scale = Math.min(1, 320 / Math.max(r.width, 1));
        el.classList.add('is-tilting');
        el.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX_DEG * scale).toFixed(2)}deg`);
        el.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX_DEG * scale).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });
    };
    const onLeave = () => {
      reset(active);
      active = null;
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      onLeave();
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
    };
  }, [enabled]);
}
