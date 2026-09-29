import type { TrackLyrics, TrackQuery } from '@shared/types/domain';

export interface LyricsSearchResult {
  providerId: string;
  providerTrackId: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  hasSyncedLyrics: boolean;
  instrumental: boolean;
}

/**
 * A source of lyrics. The rest of the app only ever sees the normalised `TrackLyrics`,
 * so providers can be swapped or chained without touching pipeline or UI code.
 */
export interface LyricsProvider {
  readonly id: string;
  readonly displayName: string;
  supportsSyncedLyrics(): boolean;
  /** Candidate matches for a track (best effort, unordered). */
  searchLyrics(track: TrackQuery, signal?: AbortSignal): Promise<LyricsSearchResult[]>;
  /** Best matching lyrics for a track, or null when the provider has none. */
  getLyrics(track: TrackQuery, signal?: AbortSignal): Promise<TrackLyrics | null>;
}
