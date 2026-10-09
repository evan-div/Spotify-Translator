import { DEFAULT_SETTINGS, OVERLAY_LIMITS } from '@shared/constants/defaults';
import { isDisabledAccelerator, validateAccelerator } from '@shared/utils/accelerator';
import type {
  AppSettings,
  Bounds,
  DisplayMode,
  SettingsPatch,
  SourceLanguageSetting,
  ThemeSetting,
  TranslationProviderId,
} from '@shared/types/settings';

/**
 * Hand-rolled validation for settings coming from disk or from the renderer.
 * Unknown keys are dropped and out-of-range values are clamped or ignored.
 */

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const str = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.length <= max ? v : undefined;
const num = (v: unknown, min: number, max: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : undefined;
const oneOf = <T extends string>(v: unknown, allowed: readonly T[]): T | undefined =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

function definedOnly<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

function parseBounds(v: unknown): Bounds | null | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  const x = num(v.x, -32000, 32000);
  const y = num(v.y, -32000, 32000);
  const width = num(v.width, OVERLAY_LIMITS.minWidth, 10000);
  const height = num(v.height, OVERLAY_LIMITS.minHeight, 10000);
  if ([x, y, width, height].some((n) => n === undefined)) return undefined;
  return { x: Math.round(x!), y: Math.round(y!), width: Math.round(width!), height: Math.round(height!) };
}

export function parseSettingsPatch(input: unknown): SettingsPatch {
  if (!isObj(input)) return {};
  const patch: SettingsPatch = definedOnly({
    onboardingCompleted: bool(input.onboardingCompleted),
    demoMode: bool(input.demoMode),
    spotifyClientId: str(input.spotifyClientId, 100)?.trim(),
  });

  if (isObj(input.overlay)) {
    const o = input.overlay;
    const heights = isObj(o.heights)
      ? definedOnly({
          regular: num(o.heights.regular, OVERLAY_LIMITS.minHeight, 10000),
          compact: num(o.heights.compact, OVERLAY_LIMITS.minHeight, 10000),
        })
      : undefined;
    patch.overlay = definedOnly({
      visible: bool(o.visible),
      locked: bool(o.locked),
      clickThrough: bool(o.clickThrough),
      compact: bool(o.compact),
      opacity: num(o.opacity, OVERLAY_LIMITS.opacityMin, OVERLAY_LIMITS.opacityMax),
      fontSize: num(o.fontSize, OVERLAY_LIMITS.fontMin, OVERLAY_LIMITS.fontMax),
      theme: oneOf<ThemeSetting>(o.theme, ['system', 'light', 'dark']),
      displayMode: oneOf<DisplayMode>(o.displayMode, ['both', 'translation', 'original']),
      showContext: bool(o.showContext),
      albumArtBackground: bool(o.albumArtBackground),
      bounds: parseBounds(o.bounds),
      syncOffsetMs: num(o.syncOffsetMs, -5000, 5000),
      tapWords: bool(o.tapWords),
      heights: heights as AppSettings['overlay']['heights'] | undefined,
    });
  }

  if (isObj(input.translation)) {
    const t = input.translation;
    patch.translation = definedOnly({
      provider: oneOf<TranslationProviderId>(t.provider, ['none', 'deepl', 'google', 'openai']),
      sourceLanguage: oneOf<SourceLanguageSetting>(t.sourceLanguage, ['auto', 'es', 'fr']),
      targetLanguage: oneOf(t.targetLanguage, ['en'] as const),
      model: str(t.model, 100)?.trim(),
      baseUrl: str(t.baseUrl, 300)?.trim(),
    });
  }

  if (isObj(input.shortcuts)) {
    const s = input.shortcuts;
    const accel = (v: unknown) => {
      const value = str(v, 60);
      if (value === undefined) return undefined;
      // '' disables the shortcut; anything else must pass the global-shortcut rules.
      return isDisabledAccelerator(value) || validateAccelerator(value).ok ? value : undefined;
    };
    patch.shortcuts = definedOnly({
      toggleOverlay: accel(s.toggleOverlay),
      toggleClickThrough: accel(s.toggleClickThrough),
      increaseFont: accel(s.increaseFont),
      decreaseFont: accel(s.decreaseFont),
    });
  }
  if (isObj(input.library)) {
    patch.library = definedOnly({ recordHistory: bool(input.library.recordHistory) });
  }
  return patch;
}

/** Deep-merges a validated patch into settings. */
export function applyPatch(base: AppSettings, patch: SettingsPatch): AppSettings {
  return {
    ...base,
    ...definedOnly({
      onboardingCompleted: patch.onboardingCompleted,
      demoMode: patch.demoMode,
      spotifyClientId: patch.spotifyClientId,
    }),
    overlay: {
      ...base.overlay,
      ...patch.overlay,
      heights: { ...base.overlay.heights, ...patch.overlay?.heights },
    },
    translation: { ...base.translation, ...patch.translation },
    shortcuts: { ...base.shortcuts, ...patch.shortcuts },
    library: { ...base.library, ...patch.library },
  };
}

/** Builds a complete, valid settings object from whatever was on disk. */
export function sanitizeStoredSettings(stored: unknown): AppSettings {
  return applyPatch(DEFAULT_SETTINGS, parseSettingsPatch(stored));
}
