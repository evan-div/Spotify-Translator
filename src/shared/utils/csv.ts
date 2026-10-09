import type { VocabularyEntry } from '../types/library';

const escapeCell = (value: string): string => (/[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

/** Vocabulary as CSV (UTF-8, header row), ready to import into Anki, Quizlet or a spreadsheet. */
export function vocabularyToCsv(entries: readonly VocabularyEntry[]): string {
  const header = ['word', 'language', 'dictionary_form', 'part_of_speech', 'meaning', 'example', 'example_translation', 'song', 'artist', 'saved_at'];
  const rows = entries.map((e) => {
    const context = e.contexts[0];
    return [
      e.word,
      e.language,
      e.lemma ?? '',
      e.partOfSpeech ?? '',
      e.meaning,
      context?.line ?? '',
      context?.translation ?? '',
      context?.title ?? '',
      context?.artist ?? '',
      e.savedAt,
    ];
  });
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

/** "just now", "5 min ago", "yesterday", "3 weeks ago"… */
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}
