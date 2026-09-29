import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const INTERACTIVE = 'button, input, select, textarea, a, [data-nodrag]';

/**
 * Drags the whole window with pointer events instead of `-webkit-app-region: drag`, because drag
 * regions swallow hover and wheel events. Disabled when `enabled` is false (locked overlay).
 */
export function useWindowDrag(enabled: boolean) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ dx: number; dy: number } | null>(null);

  const flush = useCallback(() => {
    frame.current = null;
    if (pending.current) {
      window.lyricLens.overlayDrag.move(pending.current.dx, pending.current.dy);
      pending.current = null;
    }
  }, []);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0) return;
      if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
      origin.current = { x: event.screenX, y: event.screenY };
      event.currentTarget.setPointerCapture(event.pointerId);
      window.lyricLens.overlayDrag.start();
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!origin.current) return;
      pending.current = { dx: event.screenX - origin.current.x, dy: event.screenY - origin.current.y };
      frame.current ??= requestAnimationFrame(flush);
    },
    [flush],
  );

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!origin.current) return;
      origin.current = null;
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      if (pending.current) flush();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      window.lyricLens.overlayDrag.end();
    },
    [flush],
  );

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
}
