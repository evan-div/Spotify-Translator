import type {
  DisplayLine,
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
  'unsupported-language': "This song doesn't appear to be Spanish. Showing original lyrics.",
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

export function viewFromTranslation(t: TrackTranslation, fromCache: boolean): LyricsView {
  return {
    trackKey: t.trackKey,
    title: t.title,
    artist: t.artist,
    synced: t.synced,
    language: t.originalLanguage,
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
