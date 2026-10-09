import type { SourceLanguageCode } from '../types/domain';

export const LANGUAGE_NAMES: Record<SourceLanguageCode | 'en', string> = {
  es: 'Spanish',
  fr: 'French',
  en: 'English',
};

/** Short badge text for toolbars: "ES", "FR". */
export const LANGUAGE_BADGE: Record<SourceLanguageCode | 'en', string> = { es: 'ES', fr: 'FR', en: 'EN' };

export const SOURCE_LANGUAGE_CODES: readonly SourceLanguageCode[] = ['es', 'fr'];

export const isSourceLanguage = (value: unknown): value is SourceLanguageCode =>
  typeof value === 'string' && (SOURCE_LANGUAGE_CODES as readonly string[]).includes(value);

/** Wiktionary-style section name, e.g. for "#French" anchors. */
export const languageName = (code: SourceLanguageCode): string => LANGUAGE_NAMES[code];
