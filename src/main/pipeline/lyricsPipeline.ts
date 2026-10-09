import type { LyricsState, SpotifyTrack, TrackQuery } from '@shared/types/domain';
import { ProviderError } from '@shared/types/domain';
import type { AppSettings } from '@shared/types/settings';
import { analyzeLyrics, needsTranslation } from '@shared/utils/language';
import type { TranslationCache } from '../cache/caches';
import { hashLyrics, translationCacheKey } from '../cache/cacheKeys';
import { describeError } from '../errors';
import type { LyricsService } from '../lyrics/lyricsService';
import { createLogger } from '../logger';
import type { TranslationProvider } from '../translation/TranslationProvider';
import { translateLyrics } from '../translation/translationService';
import { viewFromLyrics, viewFromTranslation } from './views';

const log = createLogger('pipeline');

export interface PipelineDeps {
  lyrics: LyricsService;
  translations: TranslationCache;
  getSettings: () => AppSettings;
  getTranslationProvider: () => TranslationProvider | null;
  emit: (state: LyricsState) => void;
}

export type PipelineOutcome = 'ready' | 'not-found' | 'error' | 'cancelled';

export function toTrackQuery(track: SpotifyTrack): TrackQuery {
  return {
    trackKey: track.key,
    title: track.title,
    artists: track.artists,
    album: track.album,
    durationMs: track.durationMs,
  };
}

/**
 * The song-change flow:
 *   translation cache → lyrics cache/provider → language detection → translation → cache.
 * Every step checks for cancellation so a fast skip never shows stale lyrics.
 */
export class LyricsPipeline {
  private controller: AbortController | null = null;

  constructor(private readonly deps: PipelineDeps) {}

  cancel(): void {
    this.controller?.abort();
    this.controller = null;
  }

  async load(track: SpotifyTrack, options: { force?: boolean } = {}): Promise<PipelineOutcome> {
    this.cancel();
    const controller = new AbortController();
    this.controller = controller;
    const { signal } = controller;
    const { deps } = this;
    const query = toTrackQuery(track);
    const force = options.force ?? false;
    const settings = deps.getSettings();
    const target = settings.translation.targetLanguage;
    const cancelled = () => signal.aborted;

    log.info(`Track changed → "${track.title}" — ${track.artists.join(', ')}${force ? ' (forced refresh)' : ''}`);
    deps.emit({ status: 'loading-lyrics', trackKey: track.key });

    try {
      // 1. Fully translated result already cached?
      if (!force) {
        const cached = deps.translations.get(translationCacheKey(query, target));
        if (cached) {
          log.info('Translation cache hit');
          deps.emit({ status: 'ready', trackKey: track.key, view: viewFromTranslation(cached, true) });
          return 'ready';
        }
      }

      // 2. Lyrics (cache, then providers).
      const lookup = await deps.lyrics.find(query, { force, signal });
      if (cancelled()) return 'cancelled';
      if (!lookup.lyrics) {
        deps.emit({ status: 'not-found', trackKey: track.key });
        return 'not-found';
      }
      const { lyrics } = lookup;

      // 3. Language.
      const forced = settings.translation.sourceLanguage === 'auto' ? null : settings.translation.sourceLanguage;
      const analysis = analyzeLyrics(lyrics.lines);
      log.info(`Language: ${analysis.language} (${Math.round(analysis.foreignShare * 100)}% ${analysis.sourceLanguage ?? 'foreign'} lines)`);

      if (!needsTranslation(analysis, forced)) {
        const status = analysis.language === 'other' ? 'unsupported-language' : 'not-needed';
        deps.emit({ status: 'ready', trackKey: track.key, view: viewFromLyrics(lyrics, analysis, status, lookup.fromCache) });
        return 'ready';
      }

      // 4. Translation. Show the original lyrics immediately while it runs.
      const provider = deps.getTranslationProvider();
      if (!provider || !provider.isConfigured()) {
        deps.emit({
          status: 'ready',
          trackKey: track.key,
          view: viewFromLyrics(lyrics, analysis, 'not-configured', lookup.fromCache),
        });
        return 'ready';
      }
      deps.emit({
        status: 'translating',
        trackKey: track.key,
        view: viewFromLyrics(lyrics, analysis, 'pending', lookup.fromCache),
      });

      try {
        const translation = await translateLyrics({ track: query, lyrics, analysis, forced, target, provider, signal });
        if (cancelled()) return 'cancelled';
        deps.translations.put(translation.cacheKey, translation);
        log.info(`Translated and cached (${translation.cacheKey}, hash ${hashLyrics(lyrics.lines).slice(0, 8)})`);
        deps.emit({ status: 'ready', trackKey: track.key, view: viewFromTranslation(translation, false) });
        return 'ready';
      } catch (error) {
        if (cancelled() || (error instanceof ProviderError && error.code === 'aborted')) return 'cancelled';
        log.warn('Translation failed', error);
        deps.emit({
          status: 'ready',
          trackKey: track.key,
          view: viewFromLyrics(lyrics, analysis, 'failed', lookup.fromCache, describeError(error, provider.displayName)),
        });
        return 'ready';
      }
    } catch (error) {
      if (cancelled() || (error instanceof ProviderError && error.code === 'aborted')) return 'cancelled';
      log.warn('Lyrics lookup failed', error);
      deps.emit({ status: 'error', trackKey: track.key, message: describeError(error, 'the lyrics service') });
      return 'error';
    } finally {
      if (this.controller === controller) this.controller = null;
    }
  }
}
