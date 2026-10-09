import { ProviderError, type SourceLanguageCode } from '@shared/types/domain';
import type { WordDefinition, WordSense } from '@shared/types/library';
import { extractLemma } from '@shared/utils/words';
import { createLogger } from '../logger';
import type { DefinitionCache } from '../cache/caches';
import type { TranslationProvider } from '../translation/TranslationProvider';
import type { DictionaryProvider } from './DictionaryProvider';

const log = createLogger('dictionary');

const cacheKey = (word: string, language: SourceLanguageCode): string => `dict:${language}:${word}`;

/**
 * Looks a foreign word up: cache → dictionary providers → (optionally) a machine translation of
 * the single word, clearly marked as such. For inflected forms ("quiero") it also fetches the
 * dictionary form ("querer") so learners see the real meaning.
 */
export class DictionaryService {
  constructor(
    private readonly providers: readonly DictionaryProvider[],
    private readonly cache: DefinitionCache,
    private readonly getTranslator: () => TranslationProvider | null,
  ) {}

  async define(word: string, language: SourceLanguageCode, signal?: AbortSignal): Promise<WordDefinition | null> {
    const cached = this.cache.get(cacheKey(word, language));
    if (cached) return cached;

    const fromDictionary = await this.fromProviders(word, language, signal);
    const definition = fromDictionary ?? (await this.fromTranslator(word, language, signal));
    // Machine fallbacks are not cached: a dictionary might learn the word, or a key may be added later.
    if (definition && definition.source !== 'machine') this.cache.put(cacheKey(word, language), definition);
    return definition;
  }

  private async fromProviders(word: string, language: SourceLanguageCode, signal?: AbortSignal): Promise<WordDefinition | null> {
    let lastError: ProviderError | null = null;
    for (const provider of this.providers) {
      try {
        const result = await provider.lookup(word, language, signal);
        if (!result) continue;
        return await this.withLemma(word, language, provider, result.senses, result.sourceUrl, signal);
      } catch (error) {
        if (error instanceof ProviderError) {
          if (error.code === 'aborted') throw error;
          log.warn(`${provider.displayName} failed for "${word}": ${error.message}`);
          lastError = error;
        } else throw error;
      }
    }
    // All providers failed (as opposed to "not found"): let the caller fall back or report it.
    if (lastError && this.providers.length > 0 && !this.getTranslator()) throw lastError;
    return null;
  }

  private async withLemma(
    word: string,
    language: SourceLanguageCode,
    provider: DictionaryProvider,
    senses: WordSense[],
    sourceUrl: string | null,
    signal?: AbortSignal,
  ): Promise<WordDefinition> {
    const base: WordDefinition = { word, language, lemma: null, formNote: null, senses, source: provider.source, sourceUrl };
    const first = senses[0]?.meanings[0];
    const lemma = first ? extractLemma(first) : null;
    if (!lemma || lemma === word) return base;

    try {
      const lemmaResult = await provider.lookup(lemma, language, signal);
      if (!lemmaResult) return { ...base, lemma, formNote: first ?? null };
      return { word, language, lemma, formNote: first ?? null, senses: lemmaResult.senses, source: provider.source, sourceUrl: lemmaResult.sourceUrl };
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'aborted') throw error;
      return { ...base, lemma, formNote: first ?? null };
    }
  }

  private async fromTranslator(word: string, language: SourceLanguageCode, signal?: AbortSignal): Promise<WordDefinition | null> {
    const translator = this.getTranslator();
    if (!translator?.isConfigured()) return null;
    try {
      const translated = (await translator.translateText(word, { source: language, target: 'en', signal })).trim();
      if (!translated || translated.toLowerCase() === word) return null;
      return {
        word,
        language,
        lemma: null,
        formNote: null,
        senses: [{ partOfSpeech: '', meanings: [translated] }],
        source: 'machine',
        sourceUrl: null,
      };
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'aborted') throw error;
      log.warn(`Machine translation of "${word}" failed`, error);
      return null;
    }
  }
}
