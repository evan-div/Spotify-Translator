import { ProviderError } from '@shared/types/domain';
import { httpJson } from '../net/http';
import { chunk, type DetectedLanguage, type TranslateOptions, type TranslationProvider } from './TranslationProvider';

interface DeepLResponse {
  translations: Array<{ detected_source_language?: string; text: string }>;
}

const MAX_TEXTS_PER_REQUEST = 50;
const TARGETS = { en: 'EN-US' } as const;

export class DeepLProvider implements TranslationProvider {
  readonly id = 'deepl' as const;
  readonly displayName = 'DeepL';

  constructor(
    private readonly getApiKey: () => string | null,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async detectLanguage(text: string, signal?: AbortSignal): Promise<DetectedLanguage> {
    const response = await this.post([text], { source: null, target: 'en', signal });
    return { code: (response.translations[0]?.detected_source_language ?? 'unknown').toLowerCase() };
  }

  async translateText(text: string, options: TranslateOptions): Promise<string> {
    const [translated] = await this.translateLines([text], options);
    return translated ?? '';
  }

  async translateLines(lines: readonly string[], options: TranslateOptions): Promise<string[]> {
    const results: string[] = [];
    for (const batch of chunk(lines, MAX_TEXTS_PER_REQUEST)) {
      const response = await this.post(batch, options);
      if (response.translations.length !== batch.length) {
        throw new ProviderError('DeepL', 'bad-response', 'DeepL returned an unexpected number of lines');
      }
      results.push(...response.translations.map((t) => t.text));
    }
    return results;
  }

  private post(texts: readonly string[], options: TranslateOptions): Promise<DeepLResponse> {
    const key = this.getApiKey();
    if (!key) throw new ProviderError('DeepL', 'not-configured', 'DeepL API key is missing');
    // Free-plan keys end in ":fx" and use a different host.
    const host = key.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
    const body: Record<string, unknown> = {
      text: texts,
      target_lang: TARGETS[options.target],
      // Lyrics lines are not sentences; don't let DeepL re-split them.
      split_sentences: '0',
      preserve_formatting: true,
    };
    if (options.source) body.source_lang = options.source.toUpperCase();
    return httpJson<DeepLResponse>(`https://${host}/v2/translate`, {
      provider: 'DeepL',
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}` },
      body,
      signal: options.signal,
      fetchImpl: this.fetchImpl,
    });
  }
}
