import type { ShortcutSettings, ShortcutAction, ShortcutState } from '@shared/types/settings';
import { isDisabledAccelerator, normalizeAccelerator, validateAccelerator } from '@shared/utils/accelerator';

export interface PlannedShortcut {
  action: ShortcutAction;
  accelerator: string;
  /** 'active' here means "try to register it"; the OS may still refuse. */
  state: Extract<ShortcutState, 'active' | 'disabled' | 'duplicate' | 'invalid'>;
}

/** Decides which shortcuts should be registered: skips disabled, invalid and duplicate ones (first wins). */
export function planShortcuts(shortcuts: ShortcutSettings): PlannedShortcut[] {
  const claimed = new Set<string>();
  return (Object.keys(shortcuts) as ShortcutAction[]).map((action) => {
    const accelerator = shortcuts[action];
    if (isDisabledAccelerator(accelerator)) return { action, accelerator, state: 'disabled' };
    const normalized = normalizeAccelerator(accelerator);
    if (!normalized || !validateAccelerator(accelerator).ok) return { action, accelerator, state: 'invalid' };
    if (claimed.has(normalized)) return { action, accelerator, state: 'duplicate' };
    claimed.add(normalized);
    return { action, accelerator, state: 'active' };
  });
}
