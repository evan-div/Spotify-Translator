import { join } from 'node:path';
import { app } from 'electron';
import { Application } from './app/application';
import { loadEnvFiles, readEnv } from './config/env';
import { configureLogger, createLogger } from './logger';

// Environment first: `.env` next to the project (dev) and in the user-data folder (packaged).
loadEnvFiles([process.cwd(), app.getPath('userData')]);
const env = readEnv();
configureLogger({
  level: env.logLevel || (app.isPackaged ? 'info' : 'debug'),
  directory: join(app.getPath('userData'), 'logs'),
});
const log = createLogger('main');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A menu-bar companion: no Dock icon on macOS.
  app.dock?.hide();

  let application: Application | null = null;

  app.on('second-instance', () => void application?.openSettings());
  app.on('window-all-closed', () => {
    /* Keep running in the menu bar. */
  });
  app.on('before-quit', () => application?.shutdown());
  app.on('activate', () => void application?.openSettings());

  process.on('uncaughtException', (error) => log.error('Uncaught exception', error));
  process.on('unhandledRejection', (reason) => log.error('Unhandled rejection', reason));

  void app.whenReady().then(async () => {
    application = new Application();
    await application.start();
  });
}
