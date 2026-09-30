import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import {
  acceleratorFromKeyEvent,
  formatAccelerator,
  isDisabledAccelerator,
  normalizeAccelerator,
  validateAccelerator,
} from '@shared/utils/accelerator';
import { planShortcuts } from '../src/main/shortcutPlan';
import { parseSettingsPatch } from '../src/main/storage/settingsSchema';

const ev = (code: string, mods: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}, key = '') => ({
  code, key, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods,
});

describe('recording a shortcut from key events', () => {
  it('uses the physical key so Option+letter is not a special character on macOS', () => {
    expect(acceleratorFromKeyEvent(ev('KeyL', { metaKey: true, altKey: true, shiftKey: true }, 'Ò'), true)).toBe('CommandOrControl+Alt+Shift+L');
  });
  it('maps arrows, digits, function and punctuation keys', () => {
    expect(acceleratorFromKeyEvent(ev('ArrowUp', { ctrlKey: true, altKey: true }), true)).toBe('Control+Alt+Up');
    expect(acceleratorFromKeyEvent(ev('Digit7', { metaKey: true, shiftKey: true }), true)).toBe('CommandOrControl+Shift+7');
    expect(acceleratorFromKeyEvent(ev('F5', { altKey: true }), true)).toBe('Alt+F5');
    expect(acceleratorFromKeyEvent(ev('Equal', { metaKey: true, altKey: true }), true)).toBe('CommandOrControl+Alt+=');
  });
  it('treats Ctrl as CommandOrControl on Windows/Linux and Win key as Super', () => {
    expect(acceleratorFromKeyEvent(ev('KeyL', { ctrlKey: true, altKey: true }), false)).toBe('CommandOrControl+Alt+L');
    expect(acceleratorFromKeyEvent(ev('KeyL', { metaKey: true, altKey: true }), false)).toBe('Super+Alt+L');
  });
  it('ignores modifier-only presses and unsupported keys', () => {
    expect(acceleratorFromKeyEvent(ev('MetaLeft', { metaKey: true }), true)).toBeNull();
    expect(acceleratorFromKeyEvent(ev('ShiftRight', { shiftKey: true }), true)).toBeNull();
    expect(acceleratorFromKeyEvent(ev('AudioVolumeUp', { metaKey: true }), true)).toBeNull();
  });
});

describe('shortcut validation', () => {
  it.each(['CommandOrControl+Alt+Shift+L', 'Control+Alt+Up', 'CommandOrControl+Shift+7', 'Alt+F5', 'CommandOrControl+F9'])('accepts %s', (a) => {
    expect(validateAccelerator(a).ok).toBe(true);
  });
  it.each([
    ['L', /modifier/],
    ['Shift+L', /Shift alone/],
    ['CommandOrControl+C', /two modifier/],
    ['CommandOrControl+Q', /two modifier/],
    ['Alt+Space', /two modifier/],
    ['CommandOrControl+Alt+Escape', /can't be used/],
    ['Foo+Alt+L', /supported/],
    ['CommandOrControl+Alt+Nope', /supported/],
  ])('rejects %s', (a, reason) => {
    const check = validateAccelerator(a);
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toMatch(reason);
  });
});

describe('normalising and formatting', () => {
  it('compares accelerators regardless of order, case and aliases', () => {
    expect(normalizeAccelerator('shift+alt+cmdorctrl+l')).toBe('CommandOrControl+Alt+Shift+L');
    expect(normalizeAccelerator('Option+Ctrl+Up')).toBe('Control+Alt+Up');
    expect(normalizeAccelerator('nonsense+L')).toBeNull();
  });
  it('formats punctuation and disabled state', () => {
    expect(formatAccelerator('CommandOrControl+Alt+=', true)).toBe('⌥⌘=');
    expect(isDisabledAccelerator('')).toBe(true);
    expect(isDisabledAccelerator('Alt+L')).toBe(false);
  });
});

describe('registration plan', () => {
  it('registers the defaults', () => {
    expect(planShortcuts(DEFAULT_SETTINGS.shortcuts).every((p) => p.state === 'active')).toBe(true);
  });
  it('skips disabled ones and lets the first of two duplicates win', () => {
    const plan = planShortcuts({
      toggleOverlay: 'CommandOrControl+Alt+Shift+L',
      toggleClickThrough: 'shift+alt+cmdorctrl+l',
      increaseFont: '',
      decreaseFont: 'Control+Alt+Down',
    });
    expect(plan.map((p) => p.state)).toEqual(['active', 'duplicate', 'disabled', 'active']);
  });
  it('flags invalid stored values without throwing', () => {
    expect(planShortcuts({ ...DEFAULT_SETTINGS.shortcuts, increaseFont: 'L' })[2]?.state).toBe('invalid');
  });
});

describe('settings schema for shortcuts', () => {
  it('accepts valid, disabled and punctuation shortcuts; drops weak or malformed ones', () => {
    const { shortcuts } = parseSettingsPatch({
      shortcuts: { toggleOverlay: 'CommandOrControl+Alt+=', toggleClickThrough: '', increaseFont: 'CommandOrControl+C', decreaseFont: '<script>' },
    });
    expect(shortcuts).toEqual({ toggleOverlay: 'CommandOrControl+Alt+=', toggleClickThrough: '' });
  });
});
