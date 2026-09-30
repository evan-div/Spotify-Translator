import type { LyricsLanguage } from './domain';

/* ---------------- Dictionary ---------------- */

export interface WordSense {
  /** "Noun", "Verb"… (empty for machine translations). */
  partOfSpeech: string;
  /** A few short English glosses. */
  meanings: string[];
  example?: string;
}

export type DefinitionSource = 'wiktionary' | 'machine' | 'demo';

export interface WordDefinition {
  /** The word as normalised for lookup (lowercase, no punctuation). */
  word: string;
  /** Dictionary form when the tapped word is an inflection (quiero → querer). */
  lemma: string | null;
  /** e.g. "first-person singular present indicative of querer". */
  formNote: string | null;
  senses: WordSense[];
  source: DefinitionSource;
  sourceUrl: string | null;
}

export interface WordContextInput {
  /** The original lyric line the word was tapped in. */
  line: string;
  /** Its translation, when there is one. */
  translation: string | null;
}

export type WordLookupResult =
  | { status: 'found'; definition: WordDefinition; saved: boolean }
  | { status: 'not-found'; word: string; saved: boolean }
  | { status: 'error'; word: string; message: string; saved: boolean };

/* ---------------- Vocabulary ---------------- */

export interface WordContext extends WordContextInput {
  trackKey: string;
  title: string;
  artist: string;
}

export interface VocabularyEntry {
  /** Same as the normalised word: one entry per word. */
  id: string;
  word: string;
  lemma: string | null;
  partOfSpeech: string | null;
  /** Short gloss for lists, e.g. "to want; to love". */
  meaning: string;
  /** Up to a few examples of where the word was met, newest first. */
  contexts: WordContext[];
  source: DefinitionSource;
  savedAt: string;
}

/* ---------------- History & favourites ---------------- */

export interface HistoryEntry {
  trackKey: string;
  title: string;
  artists: string[];
  album: string;
  artworkUrl: string | null;
  language: LyricsLanguage;
  synced: boolean;
  translated: boolean;
  favorite: boolean;
  playCount: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
}

export interface WordSaveRequest extends WordContextInput {
  word: string;
}

export interface LibraryState {
  vocabulary: VocabularyEntry[];
  history: HistoryEntry[];
}
