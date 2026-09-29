import { globalShortcut } from 'electron';
import type { ShortcutSettings } from '@shared/types/settings';
import { createLogger } from './logger';

const log = createLogger('shortcuts');

export type ShortcutAction = keyof ShortcutSettings;

/** Registers global shortcuts from settings; call `register` again after they change. */
export class ShortcutManager {
  private registered: string[] = [];

  constructor(private readonly handlers: Record<ShortcutAction, () => void>) {}

  register(shortcuts: ShortcutSettings): void {
    this.unregister();
    (Object.keys(this.handlers) as ShortcutAction[]).forEach((action) => {
      const accelerator = shortcuts[action];
      try {
        const ok = globalShortcut.register(accelerator, this.handlers[action]);
        if (ok) this.registered.push(accelerator);
        else log.warn(`Could not register ${accelerator} (already in use by another app?)`);
      } catch (error) {
        log.warn(`Invalid shortcut "${accelerator}" for ${action}`, error);
      }
    });
  }

  unregister(): void {
    this.registered.forEach((a) => globalShortcut.unregister(a));
    this.registered = [];
  }
}
