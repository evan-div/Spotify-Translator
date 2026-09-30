import { globalShortcut } from 'electron';
import type { ShortcutAction, ShortcutSettings, ShortcutState, ShortcutStatus } from '@shared/types/settings';
import { createLogger } from './logger';
import { planShortcuts } from './shortcutPlan';

const log = createLogger('shortcuts');

/** Registers global shortcuts from settings and reports, per action, whether the OS accepted them. */
export class ShortcutManager {
  private registered: string[] = [];
  private suspended = false;
  private latest: ShortcutSettings | null = null;
  private status: ShortcutStatus | null = null;

  constructor(private readonly handlers: Record<ShortcutAction, () => void>) {}

  getStatus(): ShortcutStatus {
    return this.status ?? { toggleOverlay: 'disabled', toggleClickThrough: 'disabled', increaseFont: 'disabled', decreaseFont: 'disabled' };
  }

  register(shortcuts: ShortcutSettings): ShortcutStatus {
    this.latest = shortcuts;
    this.unregister();
    const status = {} as ShortcutStatus;
    for (const plan of planShortcuts(shortcuts)) {
      let state: ShortcutState = plan.state;
      if (plan.state === 'active' && !this.suspended) state = this.tryRegister(plan.action, plan.accelerator);
      status[plan.action] = state;
    }
    this.status = status;
    return status;
  }

  /** Frees every shortcut while the settings window records a new one (otherwise they'd fire instead). */
  suspend(): void {
    this.suspended = true;
    this.unregister();
  }

  resume(): ShortcutStatus | null {
    if (!this.suspended) return null;
    this.suspended = false;
    return this.latest ? this.register(this.latest) : null;
  }

  unregister(): void {
    this.registered.forEach((a) => globalShortcut.unregister(a));
    this.registered = [];
  }

  private tryRegister(action: ShortcutAction, accelerator: string): ShortcutState {
    try {
      if (globalShortcut.register(accelerator, this.handlers[action])) {
        this.registered.push(accelerator);
        return 'active';
      }
      log.warn(`Could not register ${accelerator} for ${action}: already in use`);
      return 'in-use';
    } catch (error) {
      log.warn(`Invalid shortcut "${accelerator}" for ${action}`, error);
      return 'invalid';
    }
  }
}
