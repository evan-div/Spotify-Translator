import { ProviderError } from '@shared/types/domain';
import { httpJson } from '../net/http';
import { chunk, type DetectedLanguage, type TranslateOptions, type TranslationProvider } from './TranslationProvider';

interface GoogleTranslateResponse {
  data: { translations: Array<{ translatedText: string; detectedSourceLanguage?: string }> };
}
interface GoogleDetectResponse {
  data: { detections: Array<Array<{ language: string; confidence?: number }>> };
}

const ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const MAX_TEXTS_PER_REQUEST = 100;

export class GoogleTranslateProvider implements TranslationProvider {
  readonly id = 'google' as const;
  readonly displayName = 'Google Cloud Translation';

  constructor(
    private readonly getApiKey: () => string | null,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async detectLanguage(text: string, signal?: AbortSignal): Promise<DetectedLanguage> {
    const response = await httpJson<GoogleDetectResponse>(`${ENDPOINT}/detect`, this.request({ q: [text] }, signal));
    const best = response.data.detections[0]?.[0];
    return { code: best?.language ?? 'unknown', confidence: best?.confidence };
  }

  async translateText(text: string, options: TranslateOptions): Promise<string> {
    const [translated] = await this.translateLines([text], options);
    return translated ?? '';
  }

  async translateLines(lines: readonly string[], options: TranslateOptions): Promise<string[]> {
    const results: string[] = [];
    for (const batch of chunk(lines, MAX_TEXTS_PER_REQUEST)) {
      const body: Record<string, unknown> = { q: batch, target: options.target, format: 'text' };
      if (options.source) body.source = options.source;
      const response = await httpJson<GoogleTranslateResponse>(ENDPOINT, this.request(body, options.signal));
      const translations = response.data?.translations ?? [];
      if (translations.length !== batch.length) {
        throw new ProviderError('Google Translate', 'bad-response', 'Google returned an unexpected number of lines');
      }
      results.push(...translations.map((t) => t.translatedText));
    }
    return results;
  }

  private request(body: unknown, signal?: AbortSignal) {
    const key = this.getApiKey();
    if (!key) throw new ProviderError('Google Translate', 'not-configured', 'Google API key is missing');
    return {
      provider: 'Google Translate',
      method: 'POST' as const,
      // Header rather than ?key= so the key never ends up in a URL (and therefore never in logs).
      headers: { 'X-Goog-Api-Key': key },
      body,
      signal,
      fetchImpl: this.fetchImpl,
    };
  }
}
