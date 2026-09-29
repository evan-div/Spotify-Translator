import type {
  LyricsState,
  PlaybackState,
  SpotifyConnectionState,
} from './domain';
import type { AppSettings, SettingsPatch, TranslationProviderId } from './settings';

export interface ProviderStatus {
  /** True while the app runs on simulated data. */
  demo: boolean;
  translation: {
    provider: TranslationProviderId;
    /** True when a key is available (from settings or environment). Keys never cross IPC. */
    configured: boolean;
    keySource: 'stored' | 'environment' | 'none';
  };
  lyrics: { provider: string; label: string };
  spotify: {
    clientIdSource: 'settings' | 'environment' | 'missing';
    redirectUri: string;
  };
}

export interface AppSnapshot {
  appVersion: string;
  platform: string;
  demo: boolean;
  settings: AppSettings;
  spotify: SpotifyConnectionState;
  playback: PlaybackState;
  lyrics: LyricsState;
  providers: ProviderStatus;
}

export type AppAction =
  | 'spotify.connect'
  | 'spotify.reconnect'
  | 'spotify.disconnect'
  | 'song.refresh'
  | 'overlay.show'
  | 'overlay.hide'
  | 'overlay.toggle'
  | 'overlay.toggleLock'
  | 'overlay.toggleClickThrough'
  | 'overlay.resetPosition'
  | 'settings.open'
  | 'app.quit';

export const APP_ACTIONS: readonly AppAction[] = [
  'spotify.connect',
  'spotify.reconnect',
  'spotify.disconnect',
  'song.refresh',
  'overlay.show',
  'overlay.hide',
  'overlay.toggle',
  'overlay.toggleLock',
  'overlay.toggleClickThrough',
  'overlay.resetPosition',
  'settings.open',
  'app.quit',
];

export type DemoCommand = 'toggle-pause' | 'next' | 'previous' | 'seek-forward' | 'seek-back';
export const DEMO_COMMANDS: readonly DemoCommand[] = [
  'toggle-pause',
  'next',
  'previous',
  'seek-forward',
  'seek-back',
];

export interface Notice {
  id: number;
  level: 'info' | 'warning';
  message: string;
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/** The narrow API exposed to the renderer through the preload script. */
export interface LyricLensApi {
  getSnapshot(): Promise<AppSnapshot>;
  updateSettings(patch: SettingsPatch): Promise<AppSettings>;
  perform(action: AppAction): Promise<ActionResult>;
  setTranslationApiKey(key: string): Promise<ActionResult>;
  clearTranslationApiKey(): Promise<ActionResult>;
  testTranslation(): Promise<ActionResult>;
  demoCommand(command: DemoCommand): Promise<ActionResult>;
  /** Pointer-driven window dragging (the overlay handles its own drag so hover/scroll keep working). */
  overlayDrag: {
    start(): void;
    move(dx: number, dy: number): void;
    end(): void;
  };
  onPlayback(cb: (state: PlaybackState) => void): () => void;
  onLyrics(cb: (state: LyricsState) => void): () => void;
  onSettings(cb: (settings: AppSettings) => void): () => void;
  onSpotify(cb: (state: SpotifyConnectionState) => void): () => void;
  onProviders(cb: (providers: ProviderStatus) => void): () => void;
  onNotice(cb: (notice: Notice) => void): () => void;
}
