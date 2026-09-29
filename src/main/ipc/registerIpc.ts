import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { IPC } from '@shared/constants/ipc';
import type { AppSettings, SettingsPatch } from '@shared/types/settings';
import {
  APP_ACTIONS,
  DEMO_COMMANDS,
  type ActionResult,
  type AppAction,
  type AppSnapshot,
  type DemoCommand,
} from '@shared/types/ipc';
import { createLogger } from '../logger';
import { isTrustedRendererUrl } from '../windows/common';

const log = createLogger('ipc');
const MAX_KEY_LENGTH = 400;

/** What the IPC layer needs from the application: a deliberately small surface. */
export interface IpcHost {
  getSnapshot(): AppSnapshot;
  updateSettings(patch: SettingsPatch): AppSettings;
  perform(action: AppAction): Promise<ActionResult>;
  setTranslationApiKey(key: string): Promise<ActionResult>;
  clearTranslationApiKey(): Promise<ActionResult>;
  testTranslation(): Promise<ActionResult>;
  demoCommand(command: DemoCommand): ActionResult;
  dragOverlay(phase: 'start' | 'move' | 'end', dx?: number, dy?: number): void;
}

const denied: ActionResult = { ok: false, message: 'Request rejected.' };

function trusted(event: IpcMainInvokeEvent): boolean {
  const ok = isTrustedRendererUrl(event.senderFrame?.url);
  if (!ok) log.warn(`Rejected IPC from untrusted frame: ${event.senderFrame?.url ?? 'unknown'}`);
  return ok;
}

/** Registers every IPC handler. Each validates the sender and its arguments; nothing else is exposed. */
export function registerIpc(host: IpcHost): () => void {
  ipcMain.handle(IPC.getSnapshot, (event) => {
    if (!trusted(event)) throw new Error('Untrusted sender');
    return host.getSnapshot();
  });

  ipcMain.handle(IPC.updateSettings, (event, patch: unknown) => {
    if (!trusted(event)) throw new Error('Untrusted sender');
    // The store validates and clamps; unknown keys are dropped.
    return host.updateSettings(patch as SettingsPatch);
  });

  ipcMain.handle(IPC.perform, async (event, action: unknown): Promise<ActionResult> => {
    if (!trusted(event) || typeof action !== 'string' || !(APP_ACTIONS as readonly string[]).includes(action)) {
      return denied;
    }
    return host.perform(action as AppAction);
  });

  ipcMain.handle(IPC.setTranslationKey, async (event, key: unknown): Promise<ActionResult> => {
    if (!trusted(event) || typeof key !== 'string') return denied;
    const trimmed = key.trim();
    if (!trimmed || trimmed.length > MAX_KEY_LENGTH || /\s/.test(trimmed)) {
      return { ok: false, message: 'That doesn’t look like a valid API key.' };
    }
    return host.setTranslationApiKey(trimmed);
  });

  ipcMain.handle(IPC.clearTranslationKey, async (event): Promise<ActionResult> =>
    trusted(event) ? host.clearTranslationApiKey() : denied,
  );

  ipcMain.handle(IPC.testTranslation, async (event): Promise<ActionResult> =>
    trusted(event) ? host.testTranslation() : denied,
  );

  ipcMain.handle(IPC.demoCommand, async (event, command: unknown): Promise<ActionResult> => {
    if (!trusted(event) || typeof command !== 'string' || !(DEMO_COMMANDS as readonly string[]).includes(command)) {
      return denied;
    }
    return host.demoCommand(command as DemoCommand);
  });

  const onDrag = (phase: 'start' | 'move' | 'end') => (event: Electron.IpcMainEvent, dx?: unknown, dy?: unknown) => {
    if (!isTrustedRendererUrl(event.senderFrame?.url)) return;
    if (phase === 'move') {
      if (typeof dx !== 'number' || typeof dy !== 'number' || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
      host.dragOverlay('move', Math.round(dx), Math.round(dy));
    } else {
      host.dragOverlay(phase);
    }
  };
  ipcMain.on(IPC.dragStart, onDrag('start'));
  ipcMain.on(IPC.dragMove, onDrag('move'));
  ipcMain.on(IPC.dragEnd, onDrag('end'));

  return () => {
    [IPC.dragStart, IPC.dragMove, IPC.dragEnd].forEach((channel) => ipcMain.removeAllListeners(channel));
    [
      IPC.getSnapshot,
      IPC.updateSettings,
      IPC.perform,
      IPC.setTranslationKey,
      IPC.clearTranslationKey,
      IPC.testTranslation,
      IPC.demoCommand,
    ].forEach((channel) => ipcMain.removeHandler(channel));
  };
}
