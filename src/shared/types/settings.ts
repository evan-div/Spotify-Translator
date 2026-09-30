export type ThemeSetting = 'system' | 'light' | 'dark';
export type DisplayMode = 'both' | 'translation' | 'original';
export type TranslationProviderId = 'none' | 'deepl' | 'google' | 'openai';
export type SourceLanguageSetting = 'auto' | 'es';

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OverlaySettings {
  visible: boolean;
  locked: boolean;
  clickThrough: boolean;
  compact: boolean;
  /** Window opacity, 0.35..1 */
  opacity: number;
  /** Base font size in px for the active line, 14..44 */
  fontSize: number;
  theme: ThemeSetting;
  displayMode: DisplayMode;
  /** Show previous / next lines around the active one. */
  showContext: boolean;
  albumArtBackground: boolean;
  bounds: Bounds | null;
  /** Height remembered for each layout so toggling compact mode is stable. */
  heights: { regular: number; compact: number };
  /** Shifts lyric timing (positive = lyrics appear later). */
  syncOffsetMs: number;
}

export interface TranslationSettings {
  provider: TranslationProviderId;
  sourceLanguage: SourceLanguageSetting;
  targetLanguage: 'en';
  /** Model name for OpenAI-compatible providers. */
  model: string;
  /** Base URL for OpenAI-compatible providers. */
  baseUrl: string;
}

export interface ShortcutSettings {
  toggleOverlay: string;
  toggleClickThrough: string;
  increaseFont: string;
  decreaseFont: string;
}

export interface AppSettings {
  version: number;
  onboardingCompleted: boolean;
  demoMode: boolean;
  /** User-supplied Spotify Client ID (public identifier, safe to store in plain text). */
  spotifyClientId: string;
  overlay: OverlaySettings;
  translation: TranslationSettings;
  shortcuts: ShortcutSettings;
}

export type SettingsPatch = {
  onboardingCompleted?: boolean;
  demoMode?: boolean;
  spotifyClientId?: string;
  overlay?: Partial<OverlaySettings>;
  translation?: Partial<TranslationSettings>;
  shortcuts?: Partial<ShortcutSettings>;
};

export type ShortcutAction = keyof ShortcutSettings;

/** Outcome of registering a global shortcut with the OS. */
export type ShortcutState = 'active' | 'disabled' | 'in-use' | 'duplicate' | 'invalid';
export type ShortcutStatus = Record<ShortcutAction, ShortcutState>;
