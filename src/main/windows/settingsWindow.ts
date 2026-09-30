import { BrowserWindow } from 'electron';
import type { SettingsTab } from '@shared/types/ipc';
import { createSecureWindow, isMac, loadRenderer } from './common';

/** The small settings / onboarding window. At most one exists at a time. */
export class SettingsWindow {
  private window: BrowserWindow | null = null;

  constructor(private readonly onClosed: () => void = () => undefined) {}

  async open(tab: SettingsTab = 'settings'): Promise<void> {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore();
      this.window.show();
      this.window.focus();
      return;
    }

    const window = createSecureWindow({
      width: 520,
      height: 660,
      minWidth: 460,
      minHeight: 520,
      show: false,
      title: 'Lyric Lens',
      maximizable: false,
      fullscreenable: false,
      ...(isMac
        ? {
            titleBarStyle: 'hiddenInset' as const,
            trafficLightPosition: { x: 18, y: 18 },
            vibrancy: 'under-window' as const,
            visualEffectState: 'active' as const,
            backgroundColor: '#00000000',
          }
        : { backgroundColor: '#1c1c1e', autoHideMenuBar: true }),
    });
    this.window = window;
    window.once('ready-to-show', () => {
      window.show();
      window.focus();
    });
    window.on('closed', () => {
      this.window = null;
      this.onClosed();
    });
    await loadRenderer(window, 'settings', tab === 'settings' ? undefined : tab);
  }

  get browserWindow(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null;
  }

  close(): void {
    this.browserWindow?.close();
  }
}
