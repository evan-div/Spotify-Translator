import { join } from 'node:path';
import { BrowserWindow, shell, type BrowserWindowConstructorOptions } from 'electron';

export type RendererPage = 'overlay' | 'settings';

export const isMac = process.platform === 'darwin';

/** Origin of the renderer: the Vite dev server in development, file:// once packaged. */
export function rendererOrigin(): string {
  const dev = process.env.ELECTRON_RENDERER_URL;
  return dev ? new URL(dev).origin : 'file://';
}

export function isTrustedRendererUrl(url: string | undefined): boolean {
  if (!url) return false;
  const dev = process.env.ELECTRON_RENDERER_URL;
  if (dev) return url.startsWith(new URL(dev).origin);
  return url.startsWith('file://');
}

/** Creates a window with locked-down web preferences. */
export function createSecureWindow(options: BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    ...options,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      ...options.webPreferences,
    },
  });

  // The renderer never navigates or opens windows; external links go to the default browser.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRendererUrl(url)) event.preventDefault();
  });
  return window;
}

export function loadRenderer(window: BrowserWindow, page: RendererPage, section?: string): Promise<void> {
  const dev = process.env.ELECTRON_RENDERER_URL;
  const hash = section ? `/${page}/${section}` : `/${page}`;
  if (dev) return window.loadURL(`${dev}#${hash}`);
  return window.loadFile(join(__dirname, '../renderer/index.html'), { hash });
}
