import { ProviderError, type PlaybackState, type SpotifyConnectionState } from '@shared/types/domain';
import { TypedEmitter } from '@shared/utils/emitter';
import { describeError } from '../errors';
import { createLogger } from '../logger';
import { isPermanentAuthFailure, type SpotifyAuth } from './spotifyAuth';
import type { SpotifyClient } from './spotifyClient';
import { mapCurrentlyPlaying } from './mapping';
import { DISCONNECTED, IDLE_PLAYBACK, type SpotifyService, type SpotifyServiceEvents } from './SpotifyService';

const log = createLogger('spotify');

export const POLL_INTERVALS = { playing: 2000, paused: 4000, idle: 5000 } as const;
const MAX_BACKOFF_MS = 30_000;
const TRACK_END_SLACK_MS = 350;
const OFFLINE_AFTER_FAILURES = 2;

/** How long to wait before the next poll, given what is currently playing. */
export function nextPollDelay(playback: PlaybackState, now: number): number {
  const base = POLL_INTERVALS[playback.status];
  if (playback.status !== 'playing' || playback.durationMs <= 0) return base;
  // Poll right after the track ends so the next song is picked up promptly.
  const remaining = playback.durationMs - (playback.progressMs + (now - playback.sampledAt));
  return remaining > 0 && remaining + TRACK_END_SLACK_MS < base ? remaining + TRACK_END_SLACK_MS : base;
}

/** Exponential back-off with a ceiling, for consecutive network failures. */
export function backoffDelay(failures: number): number {
  return Math.min(MAX_BACKOFF_MS, POLL_INTERVALS.playing * 2 ** Math.max(0, failures - 1));
}

export class RealSpotifyService extends TypedEmitter<SpotifyServiceEvents> implements SpotifyService {
  readonly kind = 'spotify' as const;

  private connection: SpotifyConnectionState = DISCONNECTED;
  private playback: PlaybackState = IDLE_PLAYBACK;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private inFlight: Promise<void> | null = null;
  private failures = 0;
  private userName: string | null = null;

  constructor(
    private readonly auth: SpotifyAuth,
    private readonly client: SpotifyClient,
  ) {
    super();
  }

  getConnection = (): SpotifyConnectionState => this.connection;
  getPlayback = (): PlaybackState => this.playback;

  start(): void {
    if (this.running) return;
    this.running = true;
    if (!this.auth.hasSession()) {
      this.setConnection({ ...DISCONNECTED });
      return;
    }
    this.setConnection({ ...this.connection, status: 'connected', needsReconnect: false, message: null });
    void this.loadUserName();
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  async connect(): Promise<void> {
    this.stop();
    this.setConnection({ status: 'connecting', userName: null, health: 'ok', message: null, needsReconnect: false });
    try {
      await this.auth.connect();
    } catch (error) {
      log.warn('Connect failed', error);
      const message =
        error instanceof ProviderError && error.code !== 'network'
          ? error.message
          : describeError(error, 'Spotify');
      this.setConnection({ ...DISCONNECTED, message });
      throw error;
    }
    log.info('Connected to Spotify');
    this.failures = 0;
    this.running = false;
    this.start();
  }

  async disconnect(): Promise<void> {
    this.stop();
    this.auth.clear();
    this.userName = null;
    this.setPlayback({ ...IDLE_PLAYBACK, sampledAt: Date.now() });
    this.setConnection({ ...DISCONNECTED });
    log.info('Disconnected from Spotify');
  }

  refreshNow(): Promise<void> {
    if (!this.running) return Promise.resolve();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return this.tick();
  }

  /* -------------------------------------------------------------- */

  private schedule(delayMs: number): void {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private tick(): Promise<void> {
    this.inFlight ??= this.poll().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async poll(): Promise<void> {
    if (!this.running) return;
    const startedAt = Date.now();
    let delay: number;
    try {
      const response = await this.client.getCurrentlyPlaying();
      const finishedAt = Date.now();
      // Progress was measured server-side roughly mid-request.
      const sampledAt = Math.round((startedAt + finishedAt) / 2);
      this.failures = 0;
      this.setPlayback(mapCurrentlyPlaying(response, sampledAt));
      this.markHealthy();
      delay = nextPollDelay(this.playback, finishedAt);
    } catch (error) {
      delay = this.handlePollError(error);
    }
    this.schedule(delay);
  }

  private handlePollError(error: unknown): number {
    if (isPermanentAuthFailure(error) || (error instanceof ProviderError && error.code === 'auth')) {
      log.warn('Spotify session is no longer valid');
      this.stop();
      this.setPlayback({ ...IDLE_PLAYBACK, sampledAt: Date.now() });
      this.setConnection({
        ...DISCONNECTED,
        message: 'Your Spotify session expired. Reconnect to continue.',
        needsReconnect: true,
      });
      return POLL_INTERVALS.idle;
    }
    if (error instanceof ProviderError && error.code === 'rate-limit') {
      const wait = Math.max(error.retryAfterMs ?? 10_000, 2000);
      log.warn(`Rate limited by Spotify; pausing polling for ${Math.round(wait / 1000)}s`);
      this.setConnection({ ...this.connection, health: 'rate-limited', message: 'Spotify is rate limiting requests. Retrying shortly.' });
      return wait;
    }
    this.failures += 1;
    const wait = backoffDelay(this.failures);
    if (error instanceof ProviderError && error.code === 'network') {
      log.warn(`Network error talking to Spotify (attempt ${this.failures})`);
      if (this.failures >= OFFLINE_AFTER_FAILURES) {
        this.setConnection({ ...this.connection, health: 'offline', message: "Can't reach Spotify. Retrying…" });
      }
    } else {
      log.warn(`Spotify API error (attempt ${this.failures})`, error);
      this.setConnection({ ...this.connection, health: 'api-error', message: 'Spotify returned an unexpected response. Retrying…' });
    }
    return wait;
  }

  private markHealthy(): void {
    if (this.connection.health !== 'ok' || this.connection.message) {
      this.setConnection({ ...this.connection, health: 'ok', message: null });
    }
  }

  private async loadUserName(): Promise<void> {
    try {
      this.userName = await this.client.getUserName();
      this.setConnection({ ...this.connection, userName: this.userName });
    } catch (error) {
      log.debug('Could not load Spotify profile', error);
    }
  }

  private setPlayback(next: PlaybackState): void {
    this.playback = next;
    this.emit('playback', next);
  }

  private setConnection(next: SpotifyConnectionState): void {
    this.connection = next;
    this.emit('connection', next);
  }
}
