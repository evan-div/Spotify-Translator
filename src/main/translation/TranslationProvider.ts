import type { TargetLanguage } from '@shared/types/domain';
import type { TranslationProviderId } from '@shared/types/settings';

export interface TranslateOptions {
  /** ISO 639-1 source code, or null to let the provider detect it. */
  source: string | null;
  target: TargetLanguage;
  /** Song metadata, useful context for LLM-based providers. */
  context?: { title: string; artist: string };
  signal?: AbortSignal;
}

export interface DetectedLanguage {
  /** ISO 639-1 code such as "es" or "en". */
  code: string;
  confidence?: number;
}

/**
 * A machine translation backend. Implementations must:
 *  - return exactly one output per input line, in the same order (line boundaries are sacred);
 *  - throw ProviderError (never raw HTTP errors) so failures can be handled centrally.
 */
export interface TranslationProvider {
  readonly id: Exclude<TranslationProviderId, 'none'> | 'demo';
  readonly displayName: string;
  isConfigured(): boolean;
  detectLanguage(text: string, signal?: AbortSignal): Promise<DetectedLanguage>;
  translateText(text: string, options: TranslateOptions): Promise<string>;
  translateLines(lines: readonly string[], options: TranslateOptions): Promise<string[]>;
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
