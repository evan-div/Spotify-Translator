import type { AppSettings } from '../types/settings';

export const SETTINGS_VERSION = 1;

export const OVERLAY_LIMITS = {
  minWidth: 300,
  minHeight: 96,
  defaultWidth: 450,
  defaultRegularHeight: 260,
  defaultCompactHeight: 118,
  opacityMin: 0.35,
  opacityMax: 1,
  fontMin: 14,
  fontMax: 44,
  fontStep: 2,
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  onboardingCompleted: false,
  demoMode: false,
  spotifyClientId: '',
  overlay: {
    visible: true,
    locked: false,
    clickThrough: false,
    compact: false,
    opacity: 0.96,
    fontSize: 22,
    theme: 'system',
    displayMode: 'both',
    showContext: true,
    albumArtBackground: false,
    bounds: null,
    heights: {
      regular: OVERLAY_LIMITS.defaultRegularHeight,
      compact: OVERLAY_LIMITS.defaultCompactHeight,
    },
    syncOffsetMs: 0,
    tapWords: true,
  },
  translation: {
    provider: 'none',
    sourceLanguage: 'auto',
    targetLanguage: 'en',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
  },
  shortcuts: {
    toggleOverlay: 'CommandOrControl+Alt+Shift+L',
    toggleClickThrough: 'CommandOrControl+Alt+Shift+C',
    increaseFont: 'CommandOrControl+Alt+Shift+Up',
    decreaseFont: 'CommandOrControl+Alt+Shift+Down',
  },
  library: { recordHistory: true },
};

/** Languages the UI can offer as translation targets. Extend here (and in providers) to add more. */
export const TARGET_LANGUAGES = [{ code: 'en', label: 'English' }] as const;
export const SOURCE_LANGUAGES = [
  { code: 'auto', label: 'Auto detect' },
  { code: 'es', label: 'Spanish' },
] as const;

export const TRANSLATION_PROVIDERS = [
  { id: 'none', label: 'None' },
  { id: 'deepl', label: 'DeepL' },
  { id: 'google', label: 'Google Cloud Translation' },
  { id: 'openai', label: 'OpenAI-compatible (LLM)' },
] as const;
