import type {
  LanguageAnalysis,
  TargetLanguage,
  TrackLyrics,
  TrackQuery,
  TrackTranslation,
  TranslatedLyricLine,
} from '@shared/types/domain';
import { selectLinesToTranslate } from '@shared/utils/language';
import { TRANSLATION_SCHEMA_VERSION } from '../cache/caches';
import { hashLyrics, translationCacheKey } from '../cache/cacheKeys';
import { createLogger } from '../logger';
import type { TranslationProvider } from './TranslationProvider';

const log = createLogger('translation');

export interface TranslateLyricsRequest {
  track: TrackQuery;
  lyrics: TrackLyrics;
  analysis: LanguageAnalysis;
  forceSpanish: boolean;
  target: TargetLanguage;
  provider: TranslationProvider;
  signal?: AbortSignal;
}

/**
 * Translates only the lines that need it, once per distinct text (so repeated choruses are
 * consistent and cheap), and reassembles them in the original order.
 */
export async function translateLyrics(request: TranslateLyricsRequest): Promise<TrackTranslation> {
  const { track, lyrics, analysis, forceSpanish, target, provider, signal } = request;
  const selected = selectLinesToTranslate(lyrics.lines, analysis, forceSpanish);

  const uniqueTexts = [...new Set(lyrics.lines.filter((_, i) => selected[i]).map((l) => l.text))];
  log.info(
    `Translating ${uniqueTexts.length} unique lines (of ${lyrics.lines.length}) with ${provider.displayName}`,
  );

  const translated = uniqueTexts.length
    ? await provider.translateLines(uniqueTexts, {
        source: 'es',
        target,
        context: { title: lyrics.title, artist: lyrics.artist },
        signal,
      })
    : [];
  if (translated.length !== uniqueTexts.length) {
    throw new Error('Translation provider returned a different number of lines than requested');
  }
  const byText = new Map(uniqueTexts.map((text, i) => [text, translated[i]?.trim() ?? '']));

  const lines: TranslatedLyricLine[] = lyrics.lines.map((line, i) => {
    const translation = selected[i] ? byText.get(line.text) || null : null;
    return {
      ...line,
      language: analysis.lineLanguages[i] ?? 'unknown',
      translation,
    };
  });

  return {
    schemaVersion: TRANSLATION_SCHEMA_VERSION,
    cacheKey: translationCacheKey(track, target),
    trackKey: track.trackKey,
    trackId: track.trackKey.startsWith('local:') ? null : track.trackKey,
    artist: lyrics.artist,
    title: lyrics.title,
    originalLanguage: analysis.language,
    targetLanguage: target,
    synced: lyrics.synced,
    lines,
    lyricsProvider: lyrics.provider,
    translationProvider: provider.id,
    lyricsHash: hashLyrics(lyrics.lines),
    translatedAt: new Date().toISOString(),
  };
}
