import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import type { LyricsState, PlaybackState, SpotifyConnectionState } from '@shared/types/domain';
import type { AppSnapshot, Notice, ProviderStatus } from '@shared/types/ipc';
import type { LibraryState } from '@shared/types/library';
import type { AppSettings, ShortcutStatus } from '@shared/types/settings';

export interface AppState {
  ready: boolean;
  appVersion: string;
  platform: string;
  demo: boolean;
  settings: AppSettings;
  spotify: SpotifyConnectionState;
  playback: PlaybackState;
  lyrics: LyricsState;
  providers: ProviderStatus;
  shortcutStatus: ShortcutStatus;
  library: LibraryState;
  notice: Notice | null;
}

const initial: AppState = {
  ready: false,
  appVersion: '',
  platform: '',
  demo: false,
  settings: DEFAULT_SETTINGS,
  spotify: { status: 'disconnected', userName: null, health: 'ok', message: null, needsReconnect: false },
  playback: { status: 'idle', mediaType: 'unknown', track: null, progressMs: 0, sampledAt: 0, durationMs: 0 },
  lyrics: { status: 'idle' },
  providers: {
    demo: false,
    translation: { provider: 'none', configured: false, keySource: 'none' },
    lyrics: { provider: 'lrclib', label: 'LRCLIB' },
    spotify: { clientIdSource: 'missing', redirectUri: '' },
  },
  shortcutStatus: { toggleOverlay: 'active', toggleClickThrough: 'active', increaseFont: 'active', decreaseFont: 'active' },
  library: { vocabulary: [], history: [] },
  notice: null,
};

/** A tiny external store: the main process is the source of truth, this mirrors it for React. */
class AppStore {
  private state: AppState = initial;
  private listeners = new Set<() => void>();
  private unsubscribers: Array<() => void> = [];

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  get = (): AppState => this.state;

  private patch(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((l) => l());
  }

  private applySnapshot(s: AppSnapshot): void {
    this.patch({
      ready: true,
      appVersion: s.appVersion,
      platform: s.platform,
      demo: s.demo,
      settings: s.settings,
      spotify: s.spotify,
      playback: s.playback,
      lyrics: s.lyrics,
      providers: s.providers,
      shortcutStatus: s.shortcutStatus,
      library: s.library,
    });
  }

  async init(): Promise<void> {
    const api = window.lyricLens;
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [
      api.onPlayback((playback) => this.patch({ playback })),
      api.onLyrics((lyrics) => this.patch({ lyrics })),
      api.onSettings((settings) => this.patch({ settings })),
      api.onSpotify((spotify) => this.patch({ spotify })),
      api.onProviders((providers) => this.patch({ providers, demo: providers.demo })),
      api.onShortcutStatus((shortcutStatus) => this.patch({ shortcutStatus })),
      api.onLibrary((library) => this.patch({ library })),
      api.onNotice((notice) => this.patch({ notice })),
    ];
    this.applySnapshot(await api.getSnapshot());
  }

  dismissNotice(id: number): void {
    if (this.state.notice?.id === id) this.patch({ notice: null });
  }
}

export const appStore = new AppStore();
