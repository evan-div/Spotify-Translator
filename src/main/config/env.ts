import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TranslationProviderId } from '@shared/types/settings';

export interface EnvConfig {
  spotifyClientId: string;
  spotifyRedirectUri: string;
  lyricsProvider: string;
  lyricsApiKey: string;
  lyricsApiBaseUrl: string;
  translationProvider: TranslationProviderId | '';
  translationApiKey: string;
  translationModel: string;
  translationBaseUrl: string;
  demo: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error' | '';
}

export const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:8888/callback';

/**
 * Loads `.env` files without a dotenv dependency (Node ≥ 20.12 provides process.loadEnvFile).
 * Existing environment variables always win over file values.
 */
export function loadEnvFiles(directories: string[]): void {
  for (const dir of directories) {
    const file = join(dir, '.env');
    if (!existsSync(file)) continue;
    try {
      process.loadEnvFile(file);
    } catch {
      /* a malformed .env must not stop the app */
    }
  }
}

const PROVIDERS: readonly string[] = ['none', 'deepl', 'google', 'openai'];

export function readEnv(env: NodeJS.ProcessEnv = process.env): EnvConfig {
  const provider = (env.TRANSLATION_PROVIDER ?? '').trim().toLowerCase();
  const level = (env.LOG_LEVEL ?? '').trim().toLowerCase();
  return {
    spotifyClientId: (env.SPOTIFY_CLIENT_ID ?? '').trim(),
    spotifyRedirectUri: (env.SPOTIFY_REDIRECT_URI ?? '').trim() || DEFAULT_REDIRECT_URI,
    lyricsProvider: (env.LYRICS_PROVIDER ?? 'lrclib').trim().toLowerCase(),
    lyricsApiKey: (env.LYRICS_API_KEY ?? '').trim(),
    lyricsApiBaseUrl: (env.LYRICS_API_BASE_URL ?? '').trim(),
    translationProvider: PROVIDERS.includes(provider) ? (provider as TranslationProviderId) : '',
    translationApiKey: (env.TRANSLATION_API_KEY ?? '').trim(),
    translationModel: (env.TRANSLATION_MODEL ?? '').trim(),
    translationBaseUrl: (env.TRANSLATION_API_BASE_URL ?? '').trim(),
    demo: env.LYRICLENS_DEMO === '1' || env.LYRICLENS_DEMO === 'true',
    logLevel: ['debug', 'info', 'warn', 'error'].includes(level) ? (level as EnvConfig['logLevel']) : '',
  };
}
