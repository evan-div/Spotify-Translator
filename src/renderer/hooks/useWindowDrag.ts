import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

const INTERACTIVE = 'button, input, select, textarea, a, [data-nodrag]';
/** Pointer travel (px) before a press becomes a drag; below this it stays a click (e.g. tapping a word). */
const DRAG_THRESHOLD_PX = 4;

/**
 * Drags the whole window with pointer events instead of `-webkit-app-region: drag`, because drag
 * regions swallow hover, click and wheel events. Disabled when `enabled` is false (locked overlay).
 */
export function useWindowDrag(enabled: boolean) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
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
      dragging.current = false;
    },
    [enabled],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const start = origin.current;
      if (!start) return;
      const dx = event.screenX - start.x;
      const dy = event.screenY - start.y;
      if (!dragging.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        window.lyricLens.overlayDrag.start();
      }
      pending.current = { dx, dy };
      frame.current ??= requestAnimationFrame(flush);
    },
    [flush],
  );

  const end = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!origin.current) return;
      const wasDragging = dragging.current;
      origin.current = null;
      dragging.current = false;
      if (!wasDragging) return;
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
