import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import { applyPatch, parseSettingsPatch, sanitizeStoredSettings } from '../src/main/storage/settingsSchema';
import { mapTranslations, extractJsonObject } from '../src/main/translation/openaiProvider';
import { formatAccelerator } from '@shared/utils/accelerator';

describe('settings validation (untrusted IPC / disk input)', () => {
  it('drops unknown keys and wrong types', () => {
    const patch = parseSettingsPatch({ evil: 1, overlay: { visible: 'yes', opacity: 'x', locked: true, __proto__: { polluted: true } }, translation: { provider: 'rm -rf' } });
    expect(patch).toEqual({ overlay: { locked: true }, translation: {} });
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
  it('clamps numeric ranges', () => {
    const { overlay } = parseSettingsPatch({ overlay: { opacity: 5, fontSize: 1, syncOffsetMs: 99_999 } });
    expect(overlay).toEqual({ opacity: 1, fontSize: 14, syncOffsetMs: 5000 });
  });
  it('validates bounds and shortcuts', () => {
    expect(parseSettingsPatch({ overlay: { bounds: { x: 1, y: 2, width: 10, height: 10 } } }).overlay?.bounds).toEqual({ x: 1, y: 2, width: 300, height: 96 });
    expect(parseSettingsPatch({ overlay: { bounds: { x: 'a' } } }).overlay?.bounds).toBeUndefined();
    expect(parseSettingsPatch({ shortcuts: { toggleOverlay: 'CommandOrControl+Alt+L', increaseFont: '<script>' } }).shortcuts).toEqual({ toggleOverlay: 'CommandOrControl+Alt+L' });
  });
  it('merges deeply without losing defaults', () => {
    const next = applyPatch(DEFAULT_SETTINGS, { overlay: { heights: { compact: 150 } as never, compact: true } });
    expect(next.overlay.heights).toEqual({ regular: DEFAULT_SETTINGS.overlay.heights.regular, compact: 150 });
    expect(next.overlay.theme).toBe('system');
  });
  it('recovers from garbage on disk', () => {
    expect(sanitizeStoredSettings('nonsense')).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeStoredSettings({ overlay: { fontSize: 30 } }).overlay.fontSize).toBe(30);
  });
});

describe('LLM translation response handling', () => {
  it('maps indexed translations back to their input positions', () => {
    expect(mapTranslations({ translations: [{ i: 1, text: 'b' }, { i: 0, text: 'a' }] }, 2)).toEqual(['a', 'b']);
  });
  it('reports missing lines instead of shifting others', () => {
    expect(mapTranslations({ translations: [{ i: 0, text: 'a' }, { i: 2, text: 'c' }] }, 3)).toEqual(['a', null, 'c']);
  });
  it('accepts plain string arrays and ignores junk', () => {
    expect(mapTranslations({ translations: ['x', 'y'] }, 2)).toEqual(['x', 'y']);
    expect(mapTranslations({ nope: true }, 2)).toEqual([null, null]);
    expect(mapTranslations({ translations: [{ i: 99, text: 'z' }] }, 1)).toEqual([null]);
  });
  it('extracts JSON from fenced answers', () => {
    expect(extractJsonObject('```json\n{"translations":[]}\n```')).toEqual({ translations: [] });
    expect(() => extractJsonObject('no json')).toThrow();
  });
});

describe('accelerator formatting', () => {
  it('renders mac glyphs and windows text', () => {
    expect(formatAccelerator('CommandOrControl+Alt+Shift+L', true)).toBe('⌥⇧⌘L');
    expect(formatAccelerator('CommandOrControl+Alt+Shift+Up', false)).toBe('Ctrl+Alt+Shift+↑');
  });
});
