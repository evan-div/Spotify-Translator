import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/constants/ipc';
import type { LyricLensApi } from '../shared/types/ipc';

/**
 * The only bridge between the sandboxed renderer and the main process.
 * Every method maps to one specific, validated IPC channel; no raw ipcRenderer, no Node APIs.
 */
function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: LyricLensApi = {
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  perform: (action) => ipcRenderer.invoke(IPC.perform, action),
  setTranslationApiKey: (key) => ipcRenderer.invoke(IPC.setTranslationKey, key),
  clearTranslationApiKey: () => ipcRenderer.invoke(IPC.clearTranslationKey),
  testTranslation: () => ipcRenderer.invoke(IPC.testTranslation),
  demoCommand: (command) => ipcRenderer.invoke(IPC.demoCommand, command),
  overlayDrag: {
    start: () => ipcRenderer.send(IPC.dragStart),
    move: (dx, dy) => ipcRenderer.send(IPC.dragMove, dx, dy),
    end: () => ipcRenderer.send(IPC.dragEnd),
  },
  onPlayback: (cb) => subscribe(IPC.evt.playback, cb),
  onLyrics: (cb) => subscribe(IPC.evt.lyrics, cb),
  onSettings: (cb) => subscribe(IPC.evt.settings, cb),
  onSpotify: (cb) => subscribe(IPC.evt.spotify, cb),
  onProviders: (cb) => subscribe(IPC.evt.providers, cb),
  onShortcutStatus: (cb) => subscribe(IPC.evt.shortcutStatus, cb),
  library: {
    lookupWord: (request) => ipcRenderer.invoke(IPC.library.lookupWord, request),
    saveWord: (request) => ipcRenderer.invoke(IPC.library.saveWord, request),
    removeWord: (id) => ipcRenderer.invoke(IPC.library.removeWord, id),
    setFavorite: (trackKey, favorite) => ipcRenderer.invoke(IPC.library.setFavorite, trackKey, favorite),
    removeHistory: (trackKey) => ipcRenderer.invoke(IPC.library.removeHistory, trackKey),
    clearHistory: () => ipcRenderer.invoke(IPC.library.clearHistory),
    getSong: (trackKey) => ipcRenderer.invoke(IPC.library.getSong, trackKey),
  },
  onLibrary: (cb) => subscribe(IPC.evt.library, cb),
  onNavigate: (cb) => subscribe(IPC.evt.navigate, cb),
  onNotice: (cb) => subscribe(IPC.evt.notice, cb),
};

contextBridge.exposeInMainWorld('lyricLens', api);
