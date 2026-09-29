import { ProviderError, type TrackLyrics, type TrackQuery } from '@shared/types/domain';
import { createLogger } from '../logger';
import type { LyricsCache } from '../cache/caches';
import { lyricsCacheKey } from '../cache/cacheKeys';
import type { LyricsProvider } from './LyricsProvider';

const log = createLogger('lyrics');
const NEGATIVE_CACHE_MS = 10 * 60_000;

export interface LyricsLookup {
  lyrics: TrackLyrics | null;
  fromCache: boolean;
}

/**
 * Coordinates lyric retrieval: local cache first, then each provider in order.
 * Misses are remembered briefly (in memory) so a song without lyrics isn't re-queried on every replay.
 */
export class LyricsService {
  private misses = new Map<string, number>();

  constructor(
    private readonly providers: readonly LyricsProvider[],
    private readonly cache: LyricsCache,
  ) {}

  get providerLabel(): string {
    return this.providers.map((p) => p.displayName).join(' + ') || 'none';
  }

  peekCache(track: TrackQuery): TrackLyrics | null {
    return this.cache.get(lyricsCacheKey(track));
  }

  async find(track: TrackQuery, options: { force?: boolean; signal?: AbortSignal } = {}): Promise<LyricsLookup> {
    const key = lyricsCacheKey(track);
    if (!options.force) {
      const cached = this.cache.get(key);
      if (cached) return { lyrics: cached, fromCache: true };
      const missedAt = this.misses.get(key);
      if (missedAt && Date.now() - missedAt < NEGATIVE_CACHE_MS) {
        log.debug(`Skipping lookup, recent miss for ${key}`);
        return { lyrics: null, fromCache: true };
      }
    }

    let lastError: ProviderError | null = null;
    for (const provider of this.providers) {
      try {
        const lyrics = await provider.getLyrics(track, options.signal);
        if (lyrics) {
          this.cache.put(key, lyrics);
          this.misses.delete(key);
          return { lyrics, fromCache: false };
        }
      } catch (error) {
        if (error instanceof ProviderError) {
          if (error.code === 'aborted') throw error;
          log.warn(`${provider.displayName} failed: ${error.message}`);
          lastError = error;
        } else {
          throw error;
        }
      }
    }

    // Only remember a definite "not found", not a transient failure.
    if (lastError) throw lastError;
    this.misses.set(key, Date.now());
    return { lyrics: null, fromCache: false };
  }
}
