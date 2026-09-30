import { ProviderError } from '@shared/types/domain';
import type { WordSense } from '@shared/types/library';
import { htmlToText } from '@shared/utils/words';
import { httpJson } from '../net/http';
import type { DictionaryLookup, DictionaryProvider } from './DictionaryProvider';

/** Only the fields we read from the (unstable) Wiktionary REST "definition" endpoint. */
interface WiktionaryEntry {
  partOfSpeech?: string;
  definitions?: Array<{ definition?: string; parsedExamples?: Array<{ example?: string }>; examples?: string[] }>;
}
type WiktionaryResponse = Record<string, WiktionaryEntry[] | undefined>;

const BASE = 'https://en.wiktionary.org/api/rest_v1/page/definition';
const USER_AGENT = 'LyricLens/0.1.0 (https://github.com/evan-div/Spotify-Translator)';
const MAX_SENSES_PER_ENTRY = 4;
const MAX_MEANING_LENGTH = 140;

/** Parses the Spanish section of a Wiktionary response into senses. Exported for tests. */
export function parseWiktionary(response: WiktionaryResponse): WordSense[] {
  const entries = response.es ?? [];
  const senses: WordSense[] = [];
  for (const entry of entries) {
    const meanings = (entry.definitions ?? [])
      .map((d) => htmlToText(d.definition ?? ''))
      .filter((text) => text.length > 0)
      .map((text) => (text.length > MAX_MEANING_LENGTH ? `${text.slice(0, MAX_MEANING_LENGTH - 1)}…` : text))
      .slice(0, MAX_SENSES_PER_ENTRY);
    if (meanings.length === 0) continue;
    const firstExample = entry.definitions?.flatMap((d) => [...(d.parsedExamples?.map((e) => e.example ?? '') ?? []), ...(d.examples ?? [])]).find(Boolean);
    senses.push({
      partOfSpeech: entry.partOfSpeech ?? '',
      meanings,
      ...(firstExample ? { example: htmlToText(firstExample) } : {}),
    });
  }
  return senses;
}

export class WiktionaryProvider implements DictionaryProvider {
  readonly id = 'wiktionary';
  readonly displayName = 'Wiktionary';
  readonly source = 'wiktionary' as const;

  constructor(private readonly fetchImpl?: typeof fetch) {}

  async lookup(word: string, signal?: AbortSignal): Promise<DictionaryLookup | null> {
    // Wiktionary titles are case-sensitive: try lowercase, then Capitalised (proper nouns).
    const candidates = [word, word.charAt(0).toUpperCase() + word.slice(1)].filter((w, i, all) => all.indexOf(w) === i);
    for (const candidate of candidates) {
      try {
        const response = await httpJson<WiktionaryResponse>(`${BASE}/${encodeURIComponent(candidate)}`, {
          provider: 'Wiktionary',
          headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT },
          signal,
          fetchImpl: this.fetchImpl,
        });
        const senses = parseWiktionary(response);
        if (senses.length > 0) {
          return { senses, sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(candidate)}#Spanish` };
        }
      } catch (error) {
        if (error instanceof ProviderError && error.code === 'not-found') continue;
        throw error;
      }
    }
    return null;
  }
}
