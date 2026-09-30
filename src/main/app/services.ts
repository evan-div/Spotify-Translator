import { join } from 'node:path';
import { shell } from 'electron';
import type { EnvConfig } from '../config/env';
import { createDiskCaches, createMemoryCaches, type LyricsCache, type TranslationCache } from '../cache/caches';
import { DemoDictionaryProvider } from '../demo/demoDictionary';
import { DictionaryService } from '../dictionary/dictionaryService';
import { WiktionaryProvider } from '../dictionary/wiktionaryProvider';
import { HistoryStore } from '../library/historyStore';
import { VocabularyStore } from '../library/vocabularyStore';
import { DemoLyricsProvider, DemoSpotifyService, DemoTranslationProvider } from '../demo/demoServices';
import { LrclibProvider } from '../lyrics/lrclibProvider';
import type { LyricsProvider } from '../lyrics/LyricsProvider';
import { LyricsService } from '../lyrics/lyricsService';
import { RealSpotifyService } from '../spotify/realSpotifyService';
import { SpotifyAuth } from '../spotify/spotifyAuth';
import { SpotifyClient } from '../spotify/spotifyClient';
import type { SpotifyService } from '../spotify/SpotifyService';
import type { SecretStore } from '../storage/secrets';
import type { SettingsStore } from '../storage/settingsStore';
import type { TranslationProvider } from '../translation/TranslationProvider';
import { createTranslationProvider, resolveTranslationConfig } from '../translation/providerFactory';

/** Everything the controller needs that differs between live and demo mode. */
export interface ServiceBundle {
  spotify: SpotifyService;
  lyrics: LyricsService;
  translations: TranslationCache;
  lyricsCache: LyricsCache;
  getTranslationProvider: () => TranslationProvider | null;
  dictionary: DictionaryService;
  vocabulary: VocabularyStore;
  history: HistoryStore;
  lyricsLabel: string;
  demo: DemoSpotifyService | null;
}

export interface LiveContext {
  env: EnvConfig;
  settings: SettingsStore;
  secrets: SecretStore;
  cacheDirectory: string;
  /** Where vocabulary.json and history.json live (the user-data folder). */
  dataDirectory: string;
  redirectUri: string;
}

export function spotifyClientId(settings: SettingsStore, env: EnvConfig): string {
  return settings.get().spotifyClientId || env.spotifyClientId;
}

function createLyricsProviders(env: EnvConfig): LyricsProvider[] {
  // Add new providers here (e.g. a keyed provider using env.lyricsApiKey); order = priority.
  return [new LrclibProvider(env.lyricsApiBaseUrl || undefined)];
}

export function createLiveBundle(ctx: LiveContext): ServiceBundle {
  const caches = createDiskCaches(join(ctx.cacheDirectory));
  const auth = new SpotifyAuth({
    getClientId: () => spotifyClientId(ctx.settings, ctx.env),
    redirectUri: ctx.redirectUri,
    secrets: ctx.secrets,
    openExternal: (url) => shell.openExternal(url),
  });
  const providers = createLyricsProviders(ctx.env);
  const getTranslationProvider = () =>
    createTranslationProvider(resolveTranslationConfig(ctx.settings.get(), ctx.env, ctx.secrets));
  return {
    spotify: new RealSpotifyService(auth, new SpotifyClient(auth)),
    lyrics: new LyricsService(providers, caches.lyrics),
    translations: caches.translations,
    lyricsCache: caches.lyrics,
    getTranslationProvider,
    dictionary: new DictionaryService([new WiktionaryProvider()], caches.definitions, getTranslationProvider),
    vocabulary: new VocabularyStore(join(ctx.dataDirectory, 'vocabulary.json')),
    history: new HistoryStore(join(ctx.dataDirectory, 'history.json')),
    lyricsLabel: providers.map((p) => p.displayName).join(' + '),
    demo: null,
  };
}

/** Demo bundle: simulated playback + fake providers + in-memory caches (never touches real caches). */
export function createDemoBundle(): ServiceBundle {
  const caches = createMemoryCaches();
  const demo = new DemoSpotifyService();
  const translator = new DemoTranslationProvider();
  return {
    spotify: demo,
    lyrics: new LyricsService([new DemoLyricsProvider()], caches.lyrics),
    translations: caches.translations,
    lyricsCache: caches.lyrics,
    getTranslationProvider: () => translator,
    dictionary: new DictionaryService([new DemoDictionaryProvider()], caches.definitions, () => null),
    vocabulary: new VocabularyStore(null),
    history: new HistoryStore(null),
    lyricsLabel: 'Demo lyrics',
    demo,
  };
}
