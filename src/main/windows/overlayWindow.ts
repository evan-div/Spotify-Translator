import { BrowserWindow, screen, type Rectangle } from 'electron';
import { OVERLAY_LIMITS } from '@shared/constants/defaults';
import type { AppSettings, Bounds, OverlaySettings } from '@shared/types/settings';
import { createLogger } from '../logger';
import type { SettingsStore } from '../storage/settingsStore';
import { createSecureWindow, isMac, loadRenderer } from './common';

const log = createLogger('overlay');
const BOUNDS_SAVE_DELAY_MS = 300;

/** Whether at least a usable part of `bounds` is on some display. */
export function isVisibleOnSomeDisplay(bounds: Bounds, workAreas: readonly Rectangle[]): boolean {
  return workAreas.some((area) => {
    const overlapX = Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x);
    const overlapY = Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y);
    return overlapX >= 120 && overlapY >= 60;
  });
}

export function defaultBounds(workArea: Rectangle, height: number): Bounds {
  const width = OVERLAY_LIMITS.defaultWidth;
  return {
    width,
    height,
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + workArea.height - height - 96),
  };
}

/**
 * The floating lyrics panel: frameless, always on top, translucent, draggable and resizable,
 * with optional click-through. All window behaviour is driven from OverlaySettings.
 */
export class OverlayWindow {
  private window: BrowserWindow | null = null;
  private applyingBounds = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly settings: SettingsStore) {}

  get browserWindow(): BrowserWindow | null {
    return this.window && !this.window.isDestroyed() ? this.window : null;
  }

  async create(): Promise<void> {
    const overlay = this.settings.get().overlay;
    const bounds = this.initialBounds(overlay);

    const window = createSecureWindow({
      ...bounds,
      minWidth: OVERLAY_LIMITS.minWidth,
      minHeight: OVERLAY_LIMITS.minHeight,
      show: false,
      frame: false,
      hasShadow: true,
      resizable: !overlay.locked,
      movable: !overlay.locked,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      acceptFirstMouse: true,
      title: 'Lyric Lens',
      // macOS: real vibrancy, rounded by the OS. Elsewhere: a transparent window styled by CSS.
      ...(isMac
        ? { vibrancy: 'under-window' as const, visualEffectState: 'active' as const, backgroundColor: '#00000000' }
        : { transparent: true, backgroundColor: '#00000000' }),
    });
    this.window = window;

    // Sit above full-screen apps and games, on every Space.
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });

    window.on('moved', () => this.scheduleBoundsSave());
    window.on('resized', () => this.scheduleBoundsSave());
    window.on('closed', () => {
      this.window = null;
    });

    await loadRenderer(window, 'overlay');
    this.apply(this.settings.get());
  }

  /** Reacts to any settings change: idempotent, safe to call with the full settings. */
  apply(settings: AppSettings, previous?: OverlaySettings): void {
    const window = this.browserWindow;
    if (!window) return;
    const o = settings.overlay;

    window.setOpacity(o.opacity);
    window.setResizable(!o.locked);
    window.setMovable(!o.locked);
    window.setIgnoreMouseEvents(o.clickThrough, { forward: true });

    if (previous && previous.compact !== o.compact) this.applyLayoutHeight(o);

    if (o.visible && !window.isVisible()) {
      window.showInactive();
      log.debug('Overlay shown');
    } else if (!o.visible && window.isVisible()) {
      window.hide();
      log.debug('Overlay hidden');
    }
  }

  private dragOrigin: Bounds | null = null;

  /** Pointer-driven drag (see preload): the renderer sends screen-space deltas. */
  drag(phase: 'start' | 'move' | 'end', dx = 0, dy = 0): void {
    const window = this.browserWindow;
    if (!window || this.settings.get().overlay.locked) return;
    if (phase === 'start') {
      this.dragOrigin = window.getBounds();
    } else if (phase === 'move' && this.dragOrigin) {
      const o = this.dragOrigin;
      // Re-assert width/height so moving across displays with different scale factors can't resize the window.
      this.setBounds({ x: o.x + dx, y: o.y + dy, width: o.width, height: o.height });
    } else if (phase === 'end' && this.dragOrigin) {
      this.dragOrigin = null;
      this.saveBounds();
    }
  }

  /** Puts the overlay back at its default position on the primary display. */
  resetPosition(): void {
    const window = this.browserWindow;
    if (!window) return;
    const o = this.settings.get().overlay;
    const height = o.compact ? o.heights.compact : o.heights.regular;
    this.setBounds(defaultBounds(screen.getPrimaryDisplay().workArea, height));
    this.saveBounds();
  }

  destroy(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.browserWindow?.destroy();
  }

  /* -------------------------------------------------------------- */

  private initialBounds(overlay: OverlaySettings): Bounds {
    const height = overlay.compact ? overlay.heights.compact : overlay.heights.regular;
    const workAreas = screen.getAllDisplays().map((d) => d.workArea);
    if (overlay.bounds && isVisibleOnSomeDisplay(overlay.bounds, workAreas)) return overlay.bounds;
    return defaultBounds(screen.getPrimaryDisplay().workArea, height);
  }

  private applyLayoutHeight(o: OverlaySettings): void {
    const window = this.browserWindow;
    if (!window) return;
    const current = window.getBounds();
    this.setBounds({ ...current, height: o.compact ? o.heights.compact : o.heights.regular });
    this.scheduleBoundsSave();
  }

  private setBounds(bounds: Bounds): void {
    const window = this.browserWindow;
    if (!window) return;
    this.applyingBounds = true;
    window.setBounds(bounds);
    // 'resized'/'moved' fire asynchronously on some platforms; release the guard afterwards.
    setTimeout(() => {
      this.applyingBounds = false;
    }, 100);
  }

  private scheduleBoundsSave(): void {
    if (this.applyingBounds) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveBounds(), BOUNDS_SAVE_DELAY_MS);
  }

  private saveBounds(): void {
    const window = this.browserWindow;
    if (!window) return;
    const bounds = window.getBounds();
    const o = this.settings.get().overlay;
    // Remember height per layout so toggling compact mode restores what the user chose.
    const heights = o.compact ? { ...o.heights, compact: bounds.height } : { ...o.heights, regular: bounds.height };
    this.settings.update({ overlay: { bounds, heights } });
  }
}
