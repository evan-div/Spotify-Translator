import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LyricsView, PlaybackState } from '@shared/types/domain';
import { PlaybackSyncEngine, type SyncState } from '@shared/utils/sync';

/**
 * Bridges the framework-free PlaybackSyncEngine to React. The engine owns timing; React only
 * re-renders when the active line (or play state) actually changes.
 */
export function useSyncEngine(
  view: LyricsView | null,
  playback: PlaybackState,
  offsetMs: number,
): SyncState {
  const engine = useMemo(() => new PlaybackSyncEngine(), []);
  useEffect(() => () => engine.destroy(), [engine]);

  useEffect(() => {
    engine.setLines(view?.synced ? view.trackKey : null, view?.synced ? view.lines : []);
  }, [engine, view]);

  useEffect(() => engine.setOffset(offsetMs), [engine, offsetMs]);

  useEffect(() => {
    const { track, mediaType, status, progressMs, sampledAt, durationMs } = playback;
    if (!track || mediaType !== 'track' || status === 'idle') {
      engine.clear();
      return;
    }
    engine.reconcile({ trackKey: track.key, progressMs, sampledAt, playing: status === 'playing', durationMs });
  }, [engine, playback]);

  return useSyncExternalStore(engine.subscribe, engine.getState);
}
