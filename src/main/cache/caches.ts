import { join } from 'node:path';
import type { TrackLyrics, TrackTranslation } from '@shared/types/domain';
import type { WordDefinition } from '@shared/types/library';
import { FileKeyedCache, MemoryKeyedCache, type KeyedCache } from './fileCache';

export const TRANSLATION_SCHEMA_VERSION = 1;
const DAY_MS = 86_400_000;

export type TranslationCache = KeyedCache<TrackTranslation>;
export type LyricsCache = KeyedCache<TrackLyrics>;
export type DefinitionCache = KeyedCache<WordDefinition>;

function isTranslation(value: unknown): value is TrackTranslation {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as TrackTranslation).schemaVersion === TRANSLATION_SCHEMA_VERSION &&
    Array.isArray((value as TrackTranslation).lines)
  );
}

function isLyrics(value: unknown): value is TrackLyrics {
  return typeof value === 'object' && value !== null && Array.isArray((value as TrackLyrics).lines);
}

export interface Caches {
  translations: TranslationCache;
  lyrics: LyricsCache;
  definitions: DefinitionCache;
}

export function createDiskCaches(baseDirectory: string): Caches {
  return {
    definitions: new FileKeyedCache<WordDefinition>({
      name: 'dictionary-cache',
      directory: join(baseDirectory, 'definitions'),
      maxAgeMs: 365 * DAY_MS,
      maxEntries: 20000,
    }),
    // Translations are the expensive thing to regenerate, so they are kept for a long time.
    translations: new FileKeyedCache<TrackTranslation>({
      name: 'translation-cache',
      directory: join(baseDirectory, 'translations'),
      maxAgeMs: 365 * DAY_MS,
      maxEntries: 5000,
      validate: isTranslation,
    }),
    lyrics: new FileKeyedCache<TrackLyrics>({
      name: 'lyrics-cache',
      directory: join(baseDirectory, 'lyrics'),
      maxAgeMs: 60 * DAY_MS,
      maxEntries: 5000,
      validate: isLyrics,
    }),
  };
}

export function createMemoryCaches(): Caches {
  return { translations: new MemoryKeyedCache(), lyrics: new MemoryKeyedCache(), definitions: new MemoryKeyedCache() };
}
