import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import type { AppSettings, TranslationProviderId } from '@shared/types/settings';
import type { EnvConfig } from '../config/env';
import type { SecretStore } from '../storage/secrets';
import { DeepLProvider } from './deeplProvider';
import { GoogleTranslateProvider } from './googleProvider';
import { OpenAiCompatibleProvider } from './openaiProvider';
import type { TranslationProvider } from './TranslationProvider';

export const translationKeySecretName = (id: TranslationProviderId): string => `translation.${id}`;

export interface ResolvedTranslationConfig {
  providerId: TranslationProviderId;
  apiKey: string | null;
  keySource: 'stored' | 'environment' | 'none';
  model: string;
  baseUrl: string;
}

/** Settings choose the provider; environment variables are the fallback for everything left unset. */
export function resolveTranslationConfig(
  settings: AppSettings,
  env: EnvConfig,
  secrets: SecretStore,
): ResolvedTranslationConfig {
  const providerId: TranslationProviderId =
    settings.translation.provider !== 'none' ? settings.translation.provider : env.translationProvider || 'none';
  const stored = providerId === 'none' ? null : secrets.get(translationKeySecretName(providerId));
  const apiKey = stored ?? (env.translationApiKey || null);
  const defaults = DEFAULT_SETTINGS.translation;
  return {
    providerId,
    apiKey,
    keySource: stored ? 'stored' : env.translationApiKey ? 'environment' : 'none',
    model: settings.translation.model !== defaults.model ? settings.translation.model : env.translationModel || defaults.model,
    baseUrl:
      settings.translation.baseUrl !== defaults.baseUrl ? settings.translation.baseUrl : env.translationBaseUrl || defaults.baseUrl,
  };
}

/** Builds the provider for the *current* settings; call again when settings change. */
export function createTranslationProvider(config: ResolvedTranslationConfig): TranslationProvider | null {
  const getKey = () => config.apiKey;
  switch (config.providerId) {
    case 'deepl':
      return new DeepLProvider(getKey);
    case 'google':
      return new GoogleTranslateProvider(getKey);
    case 'openai':
      return new OpenAiCompatibleProvider(getKey, () => config.model, () => config.baseUrl);
    default:
      return null;
  }
}
