import type {
  LyricsState,
  PlaybackState,
  SpotifyConnectionState,
} from '@shared/types/domain';
import type { ActionResult, AppSnapshot, DemoCommand, ProviderStatus } from '@shared/types/ipc';
import { TypedEmitter } from '@shared/utils/emitter';
import { detectTrackChange, playbackIdentity } from '@shared/utils/trackChange';
import type { EnvConfig } from '../config/env';
import { describeError } from '../errors';
import { createLogger } from '../logger';
import { LyricsPipeline } from '../pipeline/lyricsPipeline';
import { IDLE_PLAYBACK } from '../spotify/SpotifyService';
import type { SecretStore } from '../storage/secrets';
import type { SettingsStore } from '../storage/settingsStore';
import { resolveTranslationConfig, translationKeySecretName } from '../translation/providerFactory';
import type { ServiceBundle } from './services';
import { spotifyClientId } from './services';

const log = createLogger('app');

export interface ControllerEvents extends Record<string, unknown> {
  playback: PlaybackState;
  lyrics: LyricsState;
  connection: SpotifyConnectionState;
  providers: ProviderStatus;
}

export interface ControllerDeps {
  settings: SettingsStore;
  secrets: SecretStore;
  env: EnvConfig;
  redirectUri: string;
  createLiveBundle: () => ServiceBundle;
  createDemoBundle: () => ServiceBundle;
}

const RETRY_DELAYS_MS = [8000, 20000, 45000];

/**
 * Owns the playback → lyrics → translation flow. It reacts to whichever SpotifyService is
 * active (live or demo) and publishes normalised state; it knows nothing about Electron windows.
 */
export class AppController extends TypedEmitter<ControllerEvents> {
  private bundle: ServiceBundle;
  private pipeline: LyricsPipeline;
  private unsubscribe: Array<() => void> = [];
  private playback: PlaybackState = IDLE_PLAYBACK;
  private lyricsState: LyricsState = { status: 'idle' };
  private identity: string | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private demoActive: boolean;

  constructor(private readonly deps: ControllerDeps) {
    super();
    this.demoActive = this.wantsDemo();
    this.bundle = this.demoActive ? deps.createDemoBundle() : deps.createLiveBundle();
    this.pipeline = this.buildPipeline();
  }

  /* ---------------- lifecycle ---------------- */

  start(): void {
    this.attach();
    this.bundle.spotify.start();
  }

  stop(): void {
    this.clearRetry();
    this.pipeline.cancel();
    this.unsubscribe.forEach((u) => u());
    this.unsubscribe = [];
    this.bundle.spotify.stop();
  }

  /** Switches between live and demo services when the demo setting changes. */
  syncMode(): void {
    if (this.wantsDemo() === this.demoActive) return;
    log.info(`Switching to ${this.wantsDemo() ? 'demo' : 'live'} mode`);
    this.stop();
    this.demoActive = this.wantsDemo();
    this.bundle = this.demoActive ? this.deps.createDemoBundle() : this.deps.createLiveBundle();
    this.pipeline = this.buildPipeline();
    this.playback = IDLE_PLAYBACK;
    this.identity = null;
    this.setLyrics({ status: 'idle' });
    this.emit('playback', this.playback);
    this.emit('providers', this.getProviderStatus());
    this.start();
  }

  /* ---------------- state ---------------- */

  isDemo = (): boolean => this.demoActive;

  getSnapshot(): Omit<AppSnapshot, 'appVersion' | 'platform' | 'settings'> {
    return {
      demo: this.demoActive,
      spotify: this.bundle.spotify.getConnection(),
      playback: this.playback,
      lyrics: this.lyricsState,
      providers: this.getProviderStatus(),
    };
  }

  getPlayback = (): PlaybackState => this.playback;
  getLyricsState = (): LyricsState => this.lyricsState;
  getConnection = (): SpotifyConnectionState => this.bundle.spotify.getConnection();

  getProviderStatus(): ProviderStatus {
    const { settings, secrets, env } = this.deps;
    const translation = resolveTranslationConfig(settings.get(), env, secrets);
    const clientId = settings.get().spotifyClientId ? 'settings' : env.spotifyClientId ? 'environment' : 'missing';
    return {
      demo: this.demoActive,
      translation: {
        provider: translation.providerId,
        configured: this.demoActive || (translation.providerId !== 'none' && Boolean(translation.apiKey)),
        keySource: translation.keySource,
      },
      lyrics: { provider: this.demoActive ? 'demo' : 'lrclib', label: this.bundle.lyricsLabel },
      spotify: { clientIdSource: clientId, redirectUri: this.deps.redirectUri },
    };
  }

  /* ---------------- actions ---------------- */

  async connectSpotify(): Promise<ActionResult> {
    if (this.demoActive) return { ok: true };
    if (!spotifyClientId(this.deps.settings, this.deps.env)) {
      return { ok: false, message: 'Add your Spotify Client ID first.' };
    }
    try {
      await this.bundle.spotify.connect();
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error instanceof Error && 'code' in error ? error.message : describeError(error, 'Spotify') };
    }
  }

  async disconnectSpotify(): Promise<ActionResult> {
    await this.bundle.spotify.disconnect();
    return { ok: true };
  }

  async refreshCurrentSong(): Promise<ActionResult> {
    await this.bundle.spotify.refreshNow();
    const { track, status, mediaType } = this.playback;
    if (status === 'idle' || mediaType !== 'track' || !track) return { ok: true, message: 'Nothing to refresh.' };
    this.clearRetry();
    void this.loadLyrics(track, true);
    return { ok: true };
  }

  demoCommand(command: DemoCommand): ActionResult {
    if (!this.bundle.demo) return { ok: false, message: 'Demo mode is off.' };
    this.bundle.demo.command(command);
    return { ok: true };
  }

  /** Call after the translation provider or its key changed. */
  onProviderConfigChanged(): void {
    this.emit('providers', this.getProviderStatus());
    const state = this.lyricsState;
    const view = state.status === 'ready' ? state.view : null;
    const track = this.playback.track;
    if (view && track && (view.translationStatus === 'not-configured' || view.translationStatus === 'failed')) {
      log.info('Translation settings changed; retrying current song');
      void this.loadLyrics(track, false);
    }
  }

  async setTranslationApiKey(key: string): Promise<ActionResult> {
    const provider = this.deps.settings.get().translation.provider;
    if (provider === 'none') return { ok: false, message: 'Choose a translation provider first.' };
    this.deps.secrets.set(translationKeySecretName(provider), key);
    this.onProviderConfigChanged();
    return { ok: true };
  }

  async clearTranslationApiKey(): Promise<ActionResult> {
    const provider = this.deps.settings.get().translation.provider;
    if (provider !== 'none') this.deps.secrets.delete(translationKeySecretName(provider));
    this.onProviderConfigChanged();
    return { ok: true };
  }

  async testTranslation(): Promise<ActionResult> {
    const provider = this.bundle.getTranslationProvider();
    if (!provider || !provider.isConfigured()) return { ok: false, message: 'Add an API key first.' };
    try {
      const result = await provider.translateText('Todavía te quiero, aunque no estés aquí', { source: 'es', target: 'en' });
      return { ok: true, message: `Working: “${result}”` };
    } catch (error) {
      return { ok: false, message: describeError(error, provider.displayName) };
    }
  }

  /* ---------------- internals ---------------- */

  private wantsDemo(): boolean {
    return this.deps.settings.get().demoMode || this.deps.env.demo;
  }

  private buildPipeline(): LyricsPipeline {
    return new LyricsPipeline({
      lyrics: this.bundle.lyrics,
      translations: this.bundle.translations,
      getSettings: () => this.deps.settings.get(),
      getTranslationProvider: () => this.bundle.getTranslationProvider(),
      emit: (state) => this.setLyrics(state),
    });
  }

  private attach(): void {
    const { spotify } = this.bundle;
    this.unsubscribe.push(
      spotify.on('playback', (p) => this.handlePlayback(p)),
      spotify.on('connection', (c) => this.emit('connection', c)),
    );
  }

  private handlePlayback(next: PlaybackState): void {
    // Detect the change first so lyrics state flips to "loading" before the UI sees the new track.
    const change = detectTrackChange(this.identity, next);
    this.playback = next;
    if (change.changed) {
      this.identity = change.to;
      this.onTrackChanged(next);
    }
    this.emit('playback', next);
  }

  private onTrackChanged(next: PlaybackState): void {
    this.clearRetry();
    this.retryAttempt = 0;
    const identity = playbackIdentity(next);
    log.info(`Now playing identity: ${identity ?? 'nothing'}`);

    if (identity === null || next.status === 'idle') {
      this.pipeline.cancel();
      this.setLyrics({ status: 'idle' });
    } else if (next.mediaType === 'ad') {
      this.pipeline.cancel();
      this.setLyrics({ status: 'unsupported', trackKey: 'ad', reason: 'ad' });
    } else if (next.mediaType === 'episode' && next.track) {
      this.pipeline.cancel();
      this.setLyrics({ status: 'unsupported', trackKey: next.track.key, reason: 'episode' });
    } else if (next.mediaType === 'track' && next.track) {
      void this.loadLyrics(next.track, false);
    } else {
      this.pipeline.cancel();
      this.setLyrics({ status: 'idle' });
    }
  }

  private async loadLyrics(track: NonNullable<PlaybackState['track']>, force: boolean): Promise<void> {
    const outcome = await this.pipeline.load(track, { force });
    if (outcome !== 'error' || this.playback.track?.key !== track.key) return;
    this.scheduleRetry(track);
  }

  /** Transient failures (offline, rate limit) retry with back-off while the same song is playing. */
  private scheduleRetry(track: NonNullable<PlaybackState['track']>): void {
    const delay = RETRY_DELAYS_MS[this.retryAttempt];
    if (delay === undefined) return;
    this.retryAttempt += 1;
    log.info(`Will retry lyrics lookup in ${Math.round(delay / 1000)}s (attempt ${this.retryAttempt})`);
    this.retryTimer = setTimeout(() => {
      if (this.playback.track?.key === track.key) void this.loadLyrics(track, false);
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setLyrics(state: LyricsState): void {
    this.lyricsState = state;
    this.emit('lyrics', state);
  }
}

