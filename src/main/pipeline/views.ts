import type {
  DisplayLine,
  SourceLanguageCode,
  LanguageAnalysis,
  LyricsLanguage,
  LyricsView,
  TrackLyrics,
  TrackTranslation,
  TranslationStatus,
} from '@shared/types/domain';

const NOTES: Partial<Record<TranslationStatus, string>> = {
  'not-needed': "English song detected. Translation isn't needed for this track.",
  'not-configured': 'Add a translation provider in Settings to translate this song.',
  failed: 'Translation unavailable. Showing original lyrics.',
  'unsupported-language': "This song doesn't appear to be Spanish or French. Showing original lyrics.",
};

export function noteFor(status: TranslationStatus, language: LyricsLanguage, detail?: string): string | null {
  if (status === 'not-needed' && language === 'unknown') return "Couldn't detect the language. Showing original lyrics.";
  if (status === 'failed' && detail) return `${detail} Showing original lyrics.`;
  return NOTES[status] ?? null;
}

const toDisplay = (lines: TrackTranslation['lines']): DisplayLine[] =>
  lines.map((l) => ({
    text: l.text,
    translation: l.translation,
    language: l.language,
    startTimeMs: l.startTimeMs,
    endTimeMs: l.endTimeMs,
  }));

/** The translatable language most lines are in (for labels and word lookup). */
function dominantSource(lines: ReadonlyArray<{ language?: string }>, fallback: SourceLanguageCode | null): SourceLanguageCode | null {
  const es = lines.filter((l) => l.language === 'es').length;
  const fr = lines.filter((l) => l.language === 'fr').length;
  if (es === 0 && fr === 0) return fallback;
  return es >= fr ? 'es' : 'fr';
}

const FROM_SONG_LANGUAGE: Partial<Record<LyricsLanguage, SourceLanguageCode>> = { spanish: 'es', french: 'fr' };

export function viewFromTranslation(t: TrackTranslation, fromCache: boolean): LyricsView {
  return {
    trackKey: t.trackKey,
    title: t.title,
    artist: t.artist,
    synced: t.synced,
    language: t.originalLanguage,
    sourceLanguage: dominantSource(t.lines, FROM_SONG_LANGUAGE[t.originalLanguage] ?? null),
    translationStatus: 'translated',
    note: null,
    lines: toDisplay(t.lines),
    fromCache,
    provider: t.lyricsProvider,
  };
}

export function viewFromLyrics(
  lyrics: TrackLyrics,
  analysis: LanguageAnalysis,
  status: TranslationStatus,
  fromCache: boolean,
  detail?: string,
): LyricsView {
  return {
    trackKey: lyrics.trackKey,
    title: lyrics.title,
    artist: lyrics.artist,
    synced: lyrics.synced,
    language: analysis.language,
    sourceLanguage: analysis.sourceLanguage,
    translationStatus: status,
    note: noteFor(status, analysis.language, detail),
    lines: lyrics.lines.map((l, i) => ({
      text: l.text,
      translation: null,
      language: analysis.lineLanguages[i],
      startTimeMs: l.startTimeMs,
      endTimeMs: l.endTimeMs,
    })),
    fromCache,
    provider: lyrics.provider,
  };
}
