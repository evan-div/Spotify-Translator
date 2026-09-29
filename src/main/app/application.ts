import { join } from 'node:path';
import { app, BrowserWindow, nativeTheme, powerMonitor, session } from 'electron';
import { IPC } from '@shared/constants/ipc';
import { OVERLAY_LIMITS } from '@shared/constants/defaults';
import { formatAccelerator } from '@shared/utils/accelerator';
import type { AppSettings, SettingsPatch } from '@shared/types/settings';
import type { ActionResult, AppAction, AppSnapshot, Notice } from '@shared/types/ipc';
import { DEFAULT_REDIRECT_URI, readEnv, type EnvConfig } from '../config/env';
import { IpcHost, registerIpc } from '../ipc/registerIpc';
import { createLogger } from '../logger';
import { SafeStorageSecretStore } from '../storage/secretStore';
import { FileSettingsStore } from '../storage/settingsStore';
import { ShortcutManager } from '../shortcuts';
import { TrayController } from '../tray';
import { isMac } from '../windows/common';
import { OverlayWindow } from '../windows/overlayWindow';
import { SettingsWindow } from '../windows/settingsWindow';
import { AppController } from './appController';
import { createDemoBundle, createLiveBundle } from './services';

const log = createLogger('application');

/** Composition root: wires services, windows, tray, shortcuts and IPC together. */
export class Application implements IpcHost {
  private readonly env: EnvConfig = readEnv();
  private readonly settings = new FileSettingsStore(join(app.getPath('userData'), 'settings.json'));
  private readonly secrets = new SafeStorageSecretStore(join(app.getPath('userData'), 'secrets.json'));
  private readonly controller: AppController;
  private readonly overlay = new OverlayWindow(this.settings);
  private readonly settingsWindow = new SettingsWindow();
  private readonly tray = new TrayController((action) => void this.perform(action), isMac);
  private readonly shortcuts = new ShortcutManager({
    toggleOverlay: () => void this.perform('overlay.toggle'),
    toggleClickThrough: () => void this.perform('overlay.toggleClickThrough'),
    increaseFont: () => this.adjustFont(OVERLAY_LIMITS.fontStep),
    decreaseFont: () => this.adjustFont(-OVERLAY_LIMITS.fontStep),
  });
  private stopIpc: (() => void) | null = null;
  private noticeId = 0;
  private previousSettings: AppSettings = this.settings.get();
  private quitting = false;

  constructor() {
    const cacheDirectory = join(app.getPath('userData'), 'cache');
    const redirectUri = this.env.spotifyRedirectUri || DEFAULT_REDIRECT_URI;
    this.controller = new AppController({
      settings: this.settings,
      secrets: this.secrets,
      env: this.env,
      redirectUri,
      createLiveBundle: () =>
        createLiveBundle({ env: this.env, settings: this.settings, secrets: this.secrets, cacheDirectory, redirectUri }),
      createDemoBundle,
    });
  }

  async start(): Promise<void> {
    log.info(`Starting Lyric Lens ${app.getVersion()} (${this.controller.isDemo() ? 'demo' : 'live'} mode)`);
    this.installContentSecurityPolicy();
    nativeTheme.themeSource = this.settings.get().overlay.theme;
    this.stopIpc = registerIpc(this);
    this.wireEvents();

    this.tray.create();
    this.refreshTray();
    this.shortcuts.register(this.settings.get().shortcuts);
    this.controller.start();

    const { onboardingCompleted } = this.settings.get();
    await this.overlay.create();
    if (!onboardingCompleted) {
      // First launch: keep the overlay out of the way until setup is done.
      await this.settingsWindow.open();
    }
    if (!onboardingCompleted && this.settings.get().overlay.visible) {
      this.overlay.browserWindow?.hide();
    }

    powerMonitor.on('resume', () => {
      log.info('System resumed; refreshing playback');
      void this.controller.refreshCurrentSong();
    });
  }

  shutdown(): void {
    this.quitting = true;
    this.shortcuts.unregister();
    this.controller.stop();
    this.stopIpc?.();
    this.settings.flush();
    this.tray.destroy();
  }

  get isQuitting(): boolean {
    return this.quitting;
  }

  /** Re-opens the settings window (e.g. when the app is activated from the Dock or a second launch). */
  openSettings(): Promise<void> {
    return this.settingsWindow.open();
  }

  /* ---------------- IpcHost ---------------- */

  getSnapshot(): AppSnapshot {
    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      settings: this.settings.get(),
      ...this.controller.getSnapshot(),
    };
  }

  updateSettings(patch: SettingsPatch): AppSettings {
    return this.settings.update(patch);
  }

  async perform(action: AppAction): Promise<ActionResult> {
    const overlay = this.settings.get().overlay;
    switch (action) {
      case 'spotify.connect':
      case 'spotify.reconnect': {
        const result = await this.controller.connectSpotify();
        if (!result.ok && result.message) this.notify(result.message, 'warning');
        return result;
      }
      case 'spotify.disconnect':
        return this.controller.disconnectSpotify();
      case 'song.refresh':
        return this.controller.refreshCurrentSong();
      case 'overlay.show':
        this.settings.update({ overlay: { visible: true } });
        return { ok: true };
      case 'overlay.hide':
        this.settings.update({ overlay: { visible: false } });
        return { ok: true };
      case 'overlay.toggle':
        this.settings.update({ overlay: { visible: !overlay.visible } });
        return { ok: true };
      case 'overlay.toggleLock':
        this.settings.update({ overlay: { locked: !overlay.locked } });
        return { ok: true };
      case 'overlay.toggleClickThrough':
        this.settings.update({ overlay: { clickThrough: !overlay.clickThrough, visible: true } });
        return { ok: true };
      case 'overlay.resetPosition':
        this.overlay.resetPosition();
        return { ok: true };
      case 'settings.open':
        await this.settingsWindow.open();
        return { ok: true };
      case 'app.quit':
        app.quit();
        return { ok: true };
    }
  }

  dragOverlay = (phase: 'start' | 'move' | 'end', dx?: number, dy?: number): void => this.overlay.drag(phase, dx, dy);
  setTranslationApiKey = (key: string) => this.controller.setTranslationApiKey(key);
  clearTranslationApiKey = () => this.controller.clearTranslationApiKey();
  testTranslation = () => this.controller.testTranslation();
  demoCommand = (command: Parameters<AppController['demoCommand']>[0]) => this.controller.demoCommand(command);

  /* ---------------- internals ---------------- */

  private wireEvents(): void {
    this.controller.on('playback', (p) => {
      this.broadcast(IPC.evt.playback, p);
      this.refreshTray();
    });
    this.controller.on('lyrics', (l) => this.broadcast(IPC.evt.lyrics, l));
    this.controller.on('connection', (c) => {
      this.broadcast(IPC.evt.spotify, c);
      this.refreshTray();
    });
    this.controller.on('providers', (p) => this.broadcast(IPC.evt.providers, p));
    this.settings.onChange((next, patch) => this.onSettingsChanged(next, patch));
  }

  private onSettingsChanged(next: AppSettings, patch: SettingsPatch): void {
    const previous = this.previousSettings;
    this.previousSettings = next;

    if (patch.overlay) {
      this.overlay.apply(next, previous.overlay);
      if (patch.overlay.theme) nativeTheme.themeSource = next.overlay.theme;
      if (patch.overlay.clickThrough !== undefined && patch.overlay.clickThrough !== previous.overlay.clickThrough) {
        this.notify(
          next.overlay.clickThrough
            ? `Click-through is on. Press ${formatAccelerator(next.shortcuts.toggleClickThrough, isMac)} or use the menu bar to turn it off.`
            : 'Click-through is off.',
          'info',
        );
      }
    }
    if (patch.shortcuts) this.shortcuts.register(next.shortcuts);
    if (patch.demoMode !== undefined) this.controller.syncMode();
    if (patch.translation || patch.spotifyClientId !== undefined) this.controller.onProviderConfigChanged();
    if (patch.onboardingCompleted && !previous.onboardingCompleted) {
      this.settings.update({ overlay: { visible: true } });
    }

    this.broadcast(IPC.evt.settings, next);
    this.refreshTray();
  }

  private adjustFont(delta: number): void {
    const { fontSize } = this.settings.get().overlay;
    const next = Math.min(OVERLAY_LIMITS.fontMax, Math.max(OVERLAY_LIMITS.fontMin, fontSize + delta));
    this.settings.update({ overlay: { fontSize: next } });
  }

  private refreshTray(): void {
    this.tray.update({
      settings: this.settings.get(),
      connection: this.controller.getConnection(),
      playback: this.controller.getPlayback(),
      demo: this.controller.isDemo(),
    });
  }

  private notify(message: string, level: Notice['level']): void {
    this.noticeId += 1;
    this.broadcast(IPC.evt.notice, { id: this.noticeId, level, message } satisfies Notice);
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send(channel, payload);
    }
  }

  /** Strict CSP for packaged builds (the Vite dev server needs inline scripts and websockets). */
  private installContentSecurityPolicy(): void {
    if (!app.isPackaged) return;
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.scdn.co https://*.spotifycdn.com",
      "font-src 'self' data:",
      "connect-src 'none'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
    });
  }
}
