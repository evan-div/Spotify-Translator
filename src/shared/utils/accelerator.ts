/** Renders an Electron accelerator ("CommandOrControl+Alt+Shift+L") as macOS-style glyphs ("⌥⇧⌘L"). */
export function formatAccelerator(accelerator: string, isMac: boolean): string {
  const parts = accelerator.split('+');
  const key = parts.pop() ?? '';
  const has = (...names: string[]) => parts.some((p) => names.includes(p));
  const keyLabel =
    ({ Up: '↑', Down: '↓', Left: '←', Right: '→', Plus: '+', Space: 'Space' } as Record<string, string>)[key] ??
    key.toUpperCase();
  if (isMac) {
    return [
      has('Control', 'Ctrl') ? '⌃' : '',
      has('Alt', 'Option') ? '⌥' : '',
      has('Shift') ? '⇧' : '',
      has('Command', 'Cmd', 'CommandOrControl', 'CmdOrCtrl', 'Super') ? '⌘' : '',
      keyLabel,
    ].join('');
  }
  return [
    has('Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl') ? 'Ctrl' : '',
    has('Alt', 'Option') ? 'Alt' : '',
    has('Shift') ? 'Shift' : '',
    keyLabel,
  ]
    .filter(Boolean)
    .join('+');
}

/* ------------------------------------------------------------------ */
/* Building, validating and comparing accelerators                     */
/* ------------------------------------------------------------------ */

export interface KeyEventLike {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

const MODIFIER_ORDER = ['CommandOrControl', 'Command', 'Control', 'Alt', 'Shift', 'Super'] as const;
const MODIFIER_ALIASES: Record<string, (typeof MODIFIER_ORDER)[number]> = {
  commandorcontrol: 'CommandOrControl',
  cmdorctrl: 'CommandOrControl',
  command: 'Command',
  cmd: 'Command',
  control: 'Control',
  ctrl: 'Control',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  super: 'Super',
  meta: 'Super',
};

const PUNCTUATION_CODES: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Backquote: '`',
};
const NAMED_CODES: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Return',
  Tab: 'Tab',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
};
const NAMED_KEYS = new Set([...Object.values(NAMED_CODES), 'Backspace', 'Delete', 'Escape', 'Plus']);
const PUNCTUATION_KEYS = new Set(Object.values(PUNCTUATION_CODES));

/** Key part of an accelerator for a physical key (layout independent, so ⌥L stays "L" on macOS). */
export function keyNameFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return NAMED_CODES[code] ?? PUNCTUATION_CODES[code] ?? null;
}

export const isModifierCode = (code: string): boolean => /^(Meta|Control|Alt|Shift|OS)(Left|Right)?$/.test(code);

/** Modifiers currently held, in canonical order. */
export function modifiersFromEvent(event: Pick<KeyEventLike, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>, isMac: boolean): string[] {
  const mods: string[] = [];
  if (isMac) {
    if (event.metaKey) mods.push('CommandOrControl');
    if (event.ctrlKey) mods.push('Control');
  } else {
    if (event.ctrlKey) mods.push('CommandOrControl');
    if (event.metaKey) mods.push('Super');
  }
  if (event.altKey) mods.push('Alt');
  if (event.shiftKey) mods.push('Shift');
  return mods;
}

/** Converts a key press into an accelerator string, or null for modifier-only / unsupported keys. */
export function acceleratorFromKeyEvent(event: KeyEventLike, isMac: boolean): string | null {
  if (isModifierCode(event.code)) return null;
  const key = keyNameFromCode(event.code) ?? (event.code === 'Backspace' ? 'Backspace' : event.code === 'Delete' ? 'Delete' : null);
  if (!key) return null;
  return [...modifiersFromEvent(event, isMac), key].join('+');
}

interface Parsed {
  modifiers: Array<(typeof MODIFIER_ORDER)[number]>;
  key: string;
}

function parse(accelerator: string): Parsed | null {
  const parts = accelerator.split('+');
  const key = parts.pop();
  if (!key) return null;
  const modifiers: Parsed['modifiers'] = [];
  for (const part of parts) {
    const mod = MODIFIER_ALIASES[part.toLowerCase()];
    if (!mod) return null;
    if (!modifiers.includes(mod)) modifiers.push(mod);
  }
  const validKey =
    /^[A-Za-z0-9]$/.test(key) || /^F([1-9]|1[0-9]|2[0-4])$/.test(key) || NAMED_KEYS.has(key) || PUNCTUATION_KEYS.has(key);
  return validKey ? { modifiers, key: key.length === 1 ? key.toUpperCase() : key } : null;
}

/** Canonical form used to compare two accelerators for equality. */
export function normalizeAccelerator(accelerator: string): string | null {
  const parsed = parse(accelerator);
  if (!parsed) return null;
  const mods = MODIFIER_ORDER.filter((m) => parsed.modifiers.includes(m));
  return [...mods, parsed.key].join('+');
}

export type AcceleratorCheck = { ok: true } | { ok: false; reason: string };

/**
 * Rules for a *global* shortcut. It must not be typeable on its own or hijack a universal
 * shortcut like ⌘C / ⌘Q, so it needs either two modifiers, or Control/Alt/Cmd plus a function key.
 */
export function validateAccelerator(accelerator: string): AcceleratorCheck {
  const parsed = parse(accelerator);
  if (!parsed) return { ok: false, reason: "That key combination isn't supported." };
  const { modifiers, key } = parsed;
  if (modifiers.length === 0) return { ok: false, reason: 'Include a modifier key such as ⌘, ⌥ or ⌃.' };
  if (modifiers.length === 1 && modifiers[0] === 'Shift') return { ok: false, reason: 'Shift alone is not enough. Add ⌘, ⌥ or ⌃.' };
  const isFunctionKey = /^F\d+$/.test(key);
  if (modifiers.length === 1 && !isFunctionKey) {
    return { ok: false, reason: 'Use at least two modifier keys, so it never clashes with everyday shortcuts.' };
  }
  if (key === 'Escape' || key === 'Backspace' || key === 'Delete') return { ok: false, reason: "That key can't be used." };
  return { ok: true };
}

/** Empty string means "disabled". */
export const isDisabledAccelerator = (accelerator: string): boolean => accelerator.trim() === '';
