import { safeStorage } from 'electron';
import { createLogger } from '../logger';
import { readJsonFile, writeJsonFile } from './jsonFile';
import type { SecretStore } from './secrets';

const log = createLogger('secrets');

/**
 * Stores secrets (Spotify tokens, translation API keys) encrypted with Electron's safeStorage,
 * which uses the macOS Keychain. If OS-level encryption is unavailable, secrets are kept in
 * memory only: never written to disk in plain text.
 */
export class SafeStorageSecretStore implements SecretStore {
  private cache = new Map<string, string>();
  private persisted: Record<string, string>;

  constructor(private readonly filePath: string) {
    this.persisted = readJsonFile<Record<string, string>>(filePath) ?? {};
    if (!safeStorage.isEncryptionAvailable()) {
      log.warn('OS encryption unavailable; secrets will only be kept in memory for this session');
    }
  }

  get(name: string): string | null {
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;
    const encrypted = this.persisted[name];
    if (!encrypted || !safeStorage.isEncryptionAvailable()) return null;
    try {
      const value = safeStorage.decryptString(Buffer.from(encrypted, 'base64'));
      this.cache.set(name, value);
      return value;
    } catch {
      log.warn(`Could not decrypt secret "${name}"; discarding it`);
      this.delete(name);
      return null;
    }
  }

  set(name: string, value: string): void {
    this.cache.set(name, value);
    if (!safeStorage.isEncryptionAvailable()) return;
    this.persisted[name] = safeStorage.encryptString(value).toString('base64');
    this.flush();
  }

  delete(name: string): void {
    this.cache.delete(name);
    if (name in this.persisted) {
      delete this.persisted[name];
      this.flush();
    }
  }

  has(name: string): boolean {
    return this.get(name) !== null;
  }

  private flush(): void {
    try {
      writeJsonFile(this.filePath, this.persisted);
    } catch (error) {
      log.error('Failed to persist secrets', error);
    }
  }
}
