import type { PlaybackState, SpotifyConnectionState } from '@shared/types/domain';

export interface SpotifyServiceEvents extends Record<string, unknown> {
  playback: PlaybackState;
  connection: SpotifyConnectionState;
}

/**
 * Source of "what is playing". The real implementation talks to the Spotify Web API; the demo
 * implementation (src/main/demo) simulates playback. The rest of the app depends only on this.
 */
export interface SpotifyService {
  readonly kind: 'spotify' | 'demo';
  getConnection(): SpotifyConnectionState;
  getPlayback(): PlaybackState;
  /** Begin (or resume) polling; a no-op while disconnected. */
  start(): void;
  stop(): void;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Poll immediately instead of waiting for the next interval. */
  refreshNow(): Promise<void>;
  on<K extends keyof SpotifyServiceEvents>(event: K, listener: (payload: SpotifyServiceEvents[K]) => void): () => void;
}

export const IDLE_PLAYBACK: PlaybackState = {
  status: 'idle',
  mediaType: 'unknown',
  track: null,
  progressMs: 0,
  sampledAt: 0,
  durationMs: 0,
};

export const DISCONNECTED: SpotifyConnectionState = {
  status: 'disconnected',
  userName: null,
  health: 'ok',
  message: null,
  needsReconnect: false,
};
