import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import type { AppSettings, SettingsPatch } from '@shared/types/settings';
import { TypedEmitter } from '@shared/utils/emitter';
import { createLogger } from '../logger';
import { readJsonFile, writeJsonFile } from './jsonFile';
import { applyPatch, parseSettingsPatch, sanitizeStoredSettings } from './settingsSchema';

const log = createLogger('settings');

export interface SettingsStore {
  get(): AppSettings;
  update(patch: SettingsPatch): AppSettings;
  onChange(listener: (settings: AppSettings, patch: SettingsPatch) => void): () => void;
}

interface Events extends Record<string, unknown> {
  change: { settings: AppSettings; patch: SettingsPatch };
}

const SAVE_DEBOUNCE_MS = 250;

export class FileSettingsStore extends TypedEmitter<Events> implements SettingsStore {
  private settings: AppSettings;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly filePath: string) {
    super();
    const stored = readJsonFile<unknown>(filePath);
    this.settings = stored ? sanitizeStoredSettings(stored) : structuredClone(DEFAULT_SETTINGS);
    log.debug(`Loaded settings from ${filePath}`);
  }

  get(): AppSettings {
    return this.settings;
  }

  /** Accepts untrusted input; only valid fields are applied. */
  update(rawPatch: SettingsPatch): AppSettings {
    const patch = parseSettingsPatch(rawPatch);
    this.settings = applyPatch(this.settings, patch);
    this.scheduleSave();
    this.emit('change', { settings: this.settings, patch });
    return this.settings;
  }

  onChange(listener: (settings: AppSettings, patch: SettingsPatch) => void): () => void {
    return this.on('change', ({ settings, patch }) => listener(settings, patch));
  }

  /** Flush pending writes (call on quit). */
  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      writeJsonFile(this.filePath, this.settings, 0o600);
    } catch (error) {
      log.error('Failed to save settings', error);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
  }
}

/** In-memory settings for demo sessions and tests. */
export class MemorySettingsStore extends TypedEmitter<Events> implements SettingsStore {
  constructor(private settings: AppSettings = structuredClone(DEFAULT_SETTINGS)) {
    super();
  }
  get = (): AppSettings => this.settings;
  update(patch: SettingsPatch): AppSettings {
    const valid = parseSettingsPatch(patch);
    this.settings = applyPatch(this.settings, valid);
    this.emit('change', { settings: this.settings, patch: valid });
    return this.settings;
  }
  onChange(listener: (settings: AppSettings, patch: SettingsPatch) => void): () => void {
    return this.on('change', ({ settings, patch }) => listener(settings, patch));
  }
}
