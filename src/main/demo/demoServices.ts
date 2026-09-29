import type { DemoCommand } from '@shared/types/ipc';
import type { PlaybackState, SpotifyConnectionState, TrackLyrics, TrackQuery } from '@shared/types/domain';
import { TypedEmitter } from '@shared/utils/emitter';
import type { LyricsProvider, LyricsSearchResult } from '../lyrics/LyricsProvider';
import { type SpotifyService, type SpotifyServiceEvents } from '../spotify/SpotifyService';
import type { DetectedLanguage, TranslateOptions, TranslationProvider } from '../translation/TranslationProvider';
import { DEMO_ENTRIES, DEMO_TRANSLATIONS, type DemoEntry } from './demoData';

/* ------------------------------------------------------------------ */
/* Playback                                                           */
/* ------------------------------------------------------------------ */

const SAMPLE_INTERVAL_MS = 2000;
const SEEK_STEP_MS = 15_000;
const CONNECTED: SpotifyConnectionState = {
  status: 'connected',
  userName: 'Demo listener',
  health: 'ok',
  message: null,
  needsReconnect: false,
};

/** Simulates Spotify playback (progress, pause, seek, skipping, auto-advance) with no network. */
export class DemoSpotifyService extends TypedEmitter<SpotifyServiceEvents> implements SpotifyService {
  readonly kind = 'demo' as const;
  private index = 0;
  private playing = true;
  private progressMs = 0;
  private anchorAt = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;

  getConnection = (): SpotifyConnectionState => CONNECTED;
  getPlayback = (): PlaybackState => this.snapshot();

  start(): void {
    if (this.timer) return;
    this.emit('connection', CONNECTED);
    this.publish();
    this.timer = setInterval(() => this.publish(), SAMPLE_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async connect(): Promise<void> {
    this.start();
  }
  async disconnect(): Promise<void> {
    /* The demo has nothing to disconnect from. */
  }
  async refreshNow(): Promise<void> {
    this.publish();
  }

  command(command: DemoCommand): void {
    this.advanceClock();
    switch (command) {
      case 'toggle-pause':
        this.playing = !this.playing;
        break;
      case 'next':
        this.jumpTo(this.index + 1);
        break;
      case 'previous':
        // Like a real player: restart the track if it's been playing for a few seconds.
        if (this.progressMs > 3000) this.progressMs = 0;
        else this.jumpTo(this.index - 1);
        break;
      case 'seek-forward':
        this.progressMs = Math.min(this.entry.durationMs - 1000, this.progressMs + SEEK_STEP_MS);
        break;
      case 'seek-back':
        this.progressMs = Math.max(0, this.progressMs - SEEK_STEP_MS);
        break;
    }
    this.publish();
  }

  private get entry(): DemoEntry {
    return DEMO_ENTRIES[this.index] ?? DEMO_ENTRIES[0]!;
  }

  private jumpTo(index: number): void {
    this.index = (index + DEMO_ENTRIES.length) % DEMO_ENTRIES.length;
    this.progressMs = 0;
    this.playing = true;
  }

  private advanceClock(): void {
    const now = Date.now();
    if (this.playing) this.progressMs += now - this.anchorAt;
    this.anchorAt = now;
    if (this.progressMs >= this.entry.durationMs) this.jumpTo(this.index + 1);
  }

  private snapshot(): PlaybackState {
    const entry = this.entry;
    return {
      status: this.playing ? 'playing' : 'paused',
      mediaType: entry.mediaType,
      track: entry.track,
      progressMs: Math.round(this.progressMs),
      sampledAt: this.anchorAt,
      durationMs: entry.durationMs,
    };
  }

  private publish(): void {
    this.advanceClock();
    this.emit('playback', this.snapshot());
  }
}

/* ------------------------------------------------------------------ */
/* Lyrics                                                             */
/* ------------------------------------------------------------------ */

export class DemoLyricsProvider implements LyricsProvider {
  readonly id = 'demo';
  readonly displayName = 'Demo lyrics';
  supportsSyncedLyrics = (): boolean => true;

  async searchLyrics(track: TrackQuery): Promise<LyricsSearchResult[]> {
    const entry = DEMO_ENTRIES.find((e) => e.track?.key === track.trackKey);
    if (!entry?.track || !entry.lyrics) return [];
    return [
      {
        providerId: this.id,
        providerTrackId: entry.track.key,
        title: entry.track.title,
        artist: entry.track.artists.join(', '),
        album: entry.track.album,
        durationMs: entry.durationMs,
        hasSyncedLyrics: entry.lyrics.some((l) => l.at !== undefined),
        instrumental: false,
      },
    ];
  }

  async getLyrics(track: TrackQuery): Promise<TrackLyrics | null> {
    await sleep(350); // make the loading state visible
    const entry = DEMO_ENTRIES.find((e) => e.track?.key === track.trackKey);
    if (!entry?.track || !entry.lyrics) return null;
    const synced = entry.lyrics.every((l) => l.at !== undefined);
    return {
      trackKey: track.trackKey,
      artist: entry.track.artists.join(', '),
      title: entry.track.title,
      synced,
      lines: entry.lyrics.map((l, i, all) => ({
        text: l.text,
        ...(synced ? { startTimeMs: l.at, endTimeMs: all[i + 1]?.at ?? entry.durationMs } : {}),
      })),
      provider: this.id,
      fetchedAt: new Date().toISOString(),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Translation                                                        */
/* ------------------------------------------------------------------ */

export class DemoTranslationProvider implements TranslationProvider {
  readonly id = 'demo' as const;
  readonly displayName = 'Demo translator';
  isConfigured = (): boolean => true;

  async detectLanguage(text: string): Promise<DetectedLanguage> {
    return { code: DEMO_TRANSLATIONS.has(text) ? 'es' : 'en' };
  }
  async translateText(text: string, _options?: TranslateOptions): Promise<string> {
    return (await this.translateLines([text]))[0] ?? '';
  }
  async translateLines(lines: readonly string[]): Promise<string[]> {
    await sleep(900); // make the "Translating…" state visible
    return lines.map((line) => DEMO_TRANSLATIONS.get(line) ?? line);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
