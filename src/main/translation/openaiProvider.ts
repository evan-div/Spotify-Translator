import { ProviderError } from '@shared/types/domain';
import { httpJson } from '../net/http';
import { chunk, type DetectedLanguage, type TranslateOptions, type TranslationProvider } from './TranslationProvider';

interface ChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
}

const MAX_LINES_PER_REQUEST = 80;
const TARGET_NAMES = { en: 'English' } as const;

export const LYRICS_SYSTEM_PROMPT = (target: string, source: string) =>
  [
    `You are an expert literary translator of song lyrics from ${source} into natural, idiomatic ${target}.`,
    'Translate for meaning, tone and feeling rather than word-for-word; keep slang, idioms and register believable in the target language.',
    'Rules:',
    '- Produce exactly one translation for every input line, keyed by its index "i". Never merge, split, drop or reorder lines.',
    '- Repeated lines (choruses) must be translated identically every time.',
    '- Keep line-level punctuation where it helps readability; keep interjections such as "ay" or "oh".',
    '- If a line is already in the target language, return it unchanged.',
    '- Do not add explanations, notes or quotation marks.',
    'Respond with JSON only: {"translations":[{"i":0,"text":"..."}]}',
  ].join('\n');

/** Extracts the first JSON object from text that may be wrapped in code fences or prose. */
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

/** Maps a model's `{translations:[{i,text}]}` answer back onto input positions. */
export function mapTranslations(payload: unknown, count: number): Array<string | null> {
  const out: Array<string | null> = Array.from({ length: count }, () => null);
  const list = (payload as { translations?: unknown })?.translations;
  if (!Array.isArray(list)) return out;
  list.forEach((item, position) => {
    if (typeof item === 'string') {
      if (position < count) out[position] = item;
      return;
    }
    const { i, text } = (item ?? {}) as { i?: unknown; text?: unknown };
    const index = typeof i === 'number' ? i : position;
    if (Number.isInteger(index) && index >= 0 && index < count && typeof text === 'string') out[index] = text;
  });
  return out;
}

/** Works with OpenAI and any OpenAI-compatible chat completions endpoint (Azure, OpenRouter, local servers...). */
export class OpenAiCompatibleProvider implements TranslationProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI-compatible';

  constructor(
    private readonly getApiKey: () => string | null,
    private readonly getModel: () => string,
    private readonly getBaseUrl: () => string,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  async detectLanguage(text: string, signal?: AbortSignal): Promise<DetectedLanguage> {
    const answer = await this.chat(
      [
        { role: 'system', content: 'Identify the language of the text. Reply with only its ISO 639-1 code, or "und" if unsure.' },
        { role: 'user', content: text },
      ],
      { signal, json: false },
    );
    return { code: answer.trim().toLowerCase().slice(0, 3) || 'und' };
  }

  async translateText(text: string, options: TranslateOptions): Promise<string> {
    const [translated] = await this.translateLines([text], options);
    return translated ?? '';
  }

  async translateLines(lines: readonly string[], options: TranslateOptions): Promise<string[]> {
    const results: string[] = [];
    for (const batch of chunk(lines, MAX_LINES_PER_REQUEST)) results.push(...(await this.translateBatch(batch, options)));
    return results;
  }

  private async translateBatch(batch: readonly string[], options: TranslateOptions): Promise<string[]> {
    const target = TARGET_NAMES[options.target];
    const user = JSON.stringify({
      song: options.context ? { title: options.context.title, artist: options.context.artist } : undefined,
      lines: batch.map((text, i) => ({ i, text })),
    });
    const answer = await this.chat(
      [
        { role: 'system', content: LYRICS_SYSTEM_PROMPT(target, options.source === 'es' ? 'Spanish' : 'the source language') },
        { role: 'user', content: user },
      ],
      { signal: options.signal, json: true },
    );

    let mapped: Array<string | null>;
    try {
      mapped = mapTranslations(extractJsonObject(answer), batch.length);
    } catch (error) {
      throw new ProviderError('OpenAI', 'bad-response', 'The translation model returned an unreadable answer', undefined, { cause: error });
    }

    // Retry any lines the model skipped, one at a time, before giving up.
    const missing = mapped.flatMap((value, i) => (value === null ? [i] : []));
    for (const index of missing) {
      const retry = await this.chat(
        [
          { role: 'system', content: `Translate this song lyric line into natural ${target}. Reply with only the translation.` },
          { role: 'user', content: batch[index] ?? '' },
        ],
        { signal: options.signal, json: false },
      );
      mapped[index] = retry.trim();
    }
    return mapped.map((value) => value ?? '');
  }

  private async chat(
    messages: Array<{ role: 'system' | 'user'; content: string }>,
    options: { signal?: AbortSignal; json: boolean },
  ): Promise<string> {
    const key = this.getApiKey();
    if (!key) throw new ProviderError('OpenAI', 'not-configured', 'Translation API key is missing');
    const url = `${this.getBaseUrl().replace(/\/+$/, '')}/chat/completions`;
    const send = (withJsonMode: boolean) =>
      httpJson<ChatResponse>(url, {
        provider: 'OpenAI',
        method: 'POST',
        headers: { Authorization: `Bearer ${key}` },
        body: {
          model: this.getModel(),
          messages,
          ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
        },
        signal: options.signal,
        timeoutMs: 60_000,
        fetchImpl: this.fetchImpl,
      });

    let response: ChatResponse;
    try {
      response = await send(options.json);
    } catch (error) {
      // Some compatible servers reject response_format; retry once without it.
      if (options.json && error instanceof ProviderError && error.code === 'bad-response') response = await send(false);
      else throw error;
    }
    const content = response.choices?.[0]?.message?.content;
    if (!content) throw new ProviderError('OpenAI', 'bad-response', 'The translation model returned an empty answer');
    return content;
  }
}
