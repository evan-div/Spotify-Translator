import { join } from 'node:path';
import { app, Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron';
import { formatAccelerator } from '@shared/utils/accelerator';
import type { PlaybackState, SpotifyConnectionState } from '@shared/types/domain';
import type { AppSettings } from '@shared/types/settings';
import type { AppAction } from '@shared/types/ipc';
import { createLogger } from './logger';

const log = createLogger('tray');

export interface TrayState {
  settings: AppSettings;
  connection: SpotifyConnectionState;
  playback: PlaybackState;
  demo: boolean;
}

function resourcePath(file: string): string {
  return app.isPackaged ? join(process.resourcesPath, file) : join(app.getAppPath(), 'resources', file);
}

function nowPlayingLabel(state: TrayState): string {
  if (state.connection.status !== 'connected') return 'Spotify not connected';
  const { track, status, mediaType } = state.playback;
  if (mediaType === 'ad') return 'Spotify ad playing';
  if (!track || status === 'idle') return 'Nothing playing';
  const label = `${status === 'paused' ? 'Paused: ' : ''}${track.title}${track.artists[0] ? ` · ${track.artists[0]}` : ''}`;
  return label.length > 46 ? `${label.slice(0, 45)}…` : label;
}

/** Menu bar icon + menu. Rebuilt whenever relevant state changes. */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly perform: (action: AppAction) => void,
    private readonly isMac: boolean,
  ) {}

  create(): void {
    try {
      const image = nativeImage.createFromPath(resourcePath('trayTemplate.png'));
      if (this.isMac) image.setTemplateImage(true);
      this.tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
      this.tray.setToolTip('Lyric Lens');
    } catch (error) {
      log.warn('Could not create tray icon', error);
    }
  }

  update(state: TrayState): void {
    if (!this.tray) return;
    const o = state.settings.overlay;
    const a = (action: AppAction) => () => this.perform(action);
    const hint = (accelerator: string) => formatAccelerator(accelerator, this.isMac);
    const connected = state.connection.status === 'connected';

    const template: MenuItemConstructorOptions[] = [
      { label: state.demo ? 'Demo mode' : nowPlayingLabel(state), enabled: false },
      { type: 'separator' },
      { label: 'Show Lyrics', enabled: !o.visible, sublabel: hint(state.settings.shortcuts.toggleOverlay), click: a('overlay.show') },
      { label: 'Hide Lyrics', enabled: o.visible, click: a('overlay.hide') },
      { type: 'separator' },
      { label: 'Lock Overlay', type: 'checkbox', checked: o.locked, click: a('overlay.toggleLock') },
      {
        label: 'Click-Through Mode',
        type: 'checkbox',
        checked: o.clickThrough,
        sublabel: hint(state.settings.shortcuts.toggleClickThrough),
        click: a('overlay.toggleClickThrough'),
      },
      { label: 'Reset Overlay Position', click: a('overlay.resetPosition') },
      { type: 'separator' },
      { label: 'Vocabulary…', click: a('settings.openVocabulary') },
      { label: 'History & Favorites…', click: a('settings.openHistory') },
      { label: 'Settings…', click: a('settings.open') },
      { type: 'separator' },
      {
        label: connected ? 'Reconnect Spotify' : 'Connect Spotify',
        enabled: !state.demo,
        click: a(connected ? 'spotify.reconnect' : 'spotify.connect'),
      },
      { label: 'Refresh Current Song', click: a('song.refresh') },
      { type: 'separator' },
      { label: 'Quit Lyric Lens', click: a('app.quit') },
    ];
    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
