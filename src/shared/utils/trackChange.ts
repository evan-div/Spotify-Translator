import type { PlaybackState } from '../types/domain';

/**
 * The identity of "what is playing" for the purposes of loading lyrics.
 * Ads and podcast episodes get their own keys so switching between them is a change too.
 */
export function playbackIdentity(state: Pick<PlaybackState, 'mediaType' | 'track' | 'status'>): string | null {
  if (state.status === 'idle') return null;
  if (state.mediaType === 'track' && state.track) return `track:${state.track.key}`;
  if (state.mediaType === 'episode') return `episode:${state.track?.key ?? 'unknown'}`;
  return state.mediaType === 'ad' ? 'ad' : null;
}

export type TrackChange =
  | { changed: false }
  | { changed: true; from: string | null; to: string | null };

export function detectTrackChange(previous: string | null, next: PlaybackState): TrackChange {
  const to = playbackIdentity(next);
  if (previous === to) return { changed: false };
  return { changed: true, from: previous, to };
}
