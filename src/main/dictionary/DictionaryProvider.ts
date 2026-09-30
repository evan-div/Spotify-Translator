import type { DefinitionSource, WordSense } from '@shared/types/library';

export interface DictionaryLookup {
  senses: WordSense[];
  sourceUrl: string | null;
}

/**
 * A source of word definitions (Spanish → English glosses). Implementations return null when
 * the word is unknown and throw ProviderError for network/API problems.
 */
export interface DictionaryProvider {
  readonly id: string;
  readonly displayName: string;
  /** How definitions from this provider are labelled in the UI. */
  readonly source: Exclude<DefinitionSource, 'machine'>;
  lookup(word: string, signal?: AbortSignal): Promise<DictionaryLookup | null>;
}
