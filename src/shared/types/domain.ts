/** Domain models shared by the main process and the renderer. No external API shapes live here. */

export interface SpotifyTrack {
  /** Spotify track ID; null for local files. */
  id: string | null;
  /** Stable app-level key: the Spotify ID, or a hash-derived key for local files. */
  key: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  durationMs: number;
  isLocal: boolean;
}

export type PlaybackStatus = 'playing' | 'paused' | 'idle';
export type MediaType = 'track' | 'episode' | 'ad' | 'unknown';

export interface PlaybackState {
  status: PlaybackStatus;
  mediaType: MediaType;
  track: SpotifyTrack | null;
  /** Playback position at `sampledAt`. */
  progressMs: number;
  /** Epoch ms (main-process clock) at which `progressMs` was true. */
  sampledAt: number;
  durationMs: number;
}

export type SpotifyConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type SpotifyHealth = 'ok' | 'offline' | 'rate-limited' | 'api-error';

export interface SpotifyConnectionState {
  status: SpotifyConnectionStatus;
  userName: string | null;
  health: SpotifyHealth;
  /** Human readable, never a stack trace. */
  message: string | null;
  /** True when the session expired and the user must reconnect. */
  needsReconnect: boolean;
}

/* ------------------------------------------------------------------ */
/* Lyrics                                                             */
/* ------------------------------------------------------------------ */

export interface LyricLine {
  text: string;
  startTimeMs?: number;
  endTimeMs?: number;
}

export interface TrackLyrics {
  trackKey: string;
  artist: string;
  title: string;
  synced: boolean;
  lines: LyricLine[];
  provider: string;
  providerTrackId?: string;
  fetchedAt: string;
}

/** What we know about a track when searching for lyrics. */
export interface TrackQuery {
  trackKey: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
}

/* ------------------------------------------------------------------ */
/* Language + translation                                             */
/* ------------------------------------------------------------------ */

export type LyricsLanguage = 'spanish' | 'english' | 'mixed' | 'other' | 'unknown';
export type LineLanguage = 'es' | 'en' | 'other' | 'unknown';

export interface LanguageAnalysis {
  language: LyricsLanguage;
  lineLanguages: LineLanguage[];
  /** Share (0..1) of classified lines that are Spanish. */
  spanishShare: number;
}

export type TargetLanguage = 'en';

export interface TranslatedLyricLine extends LyricLine {
  language: LineLanguage;
  /** null when the line needed no translation (English line, blank, vocalisation...). */
  translation: string | null;
}

export interface TrackTranslation {
  schemaVersion: number;
  cacheKey: string;
  trackKey: string;
  trackId: string | null;
  artist: string;
  title: string;
  originalLanguage: LyricsLanguage;
  targetLanguage: TargetLanguage;
  synced: boolean;
  lines: TranslatedLyricLine[];
  lyricsProvider: string;
  translationProvider: string;
  lyricsHash: string;
  translatedAt: string;
}

/* ------------------------------------------------------------------ */
/* View models the UI consumes (provider agnostic)                    */
/* ------------------------------------------------------------------ */

export type TranslationStatus =
  | 'translated'
  | 'not-needed'
  | 'pending'
  | 'failed'
  | 'not-configured'
  | 'unsupported-language';

export interface DisplayLine {
  text: string;
  translation: string | null;
  startTimeMs?: number;
  endTimeMs?: number;
}

export interface LyricsView {
  trackKey: string;
  title: string;
  artist: string;
  synced: boolean;
  language: LyricsLanguage;
  translationStatus: TranslationStatus;
  /** Short user facing explanation for non-happy paths. */
  note: string | null;
  lines: DisplayLine[];
  fromCache: boolean;
  provider: string;
}

export type UnsupportedReason = 'ad' | 'episode' | 'unknown-media';

export type LyricsState =
  | { status: 'idle' }
  | { status: 'loading-lyrics'; trackKey: string }
  | { status: 'translating'; trackKey: string; view: LyricsView }
  | { status: 'ready'; trackKey: string; view: LyricsView }
  | { status: 'not-found'; trackKey: string }
  | { status: 'unsupported'; trackKey: string; reason: UnsupportedReason }
  | { status: 'error'; trackKey: string; message: string };

/* ------------------------------------------------------------------ */
/* Errors                                                             */
/* ------------------------------------------------------------------ */

export type ProviderErrorCode =
  | 'network'
  | 'auth'
  | 'rate-limit'
  | 'not-found'
  | 'bad-response'
  | 'not-configured'
  | 'aborted'
  | 'unknown';

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryAfterMs?: number,
    options?: { cause?: unknown; status?: number },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ProviderError';
    this.status = options?.status;
  }

  /** HTTP status, when the error came from an HTTP response. */
  readonly status?: number;
}
