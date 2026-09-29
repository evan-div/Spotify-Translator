import { mkdirSync, readdirSync, rmSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createLogger } from '../logger';
import { readJsonFile, writeJsonFile } from '../storage/jsonFile';
import { fileNameForKey } from './cacheKeys';

const log = createLogger('cache');

interface Envelope<T> {
  key: string;
  storedAt: number;
  value: T;
}

export interface KeyedCache<T> {
  get(key: string): T | null;
  put(key: string, value: T): void;
  delete(key: string): void;
  clear(): void;
}

export interface FileCacheOptions {
  name: string;
  directory: string;
  /** Entries older than this are ignored and removed. */
  maxAgeMs?: number;
  /** Oldest entries are pruned beyond this count. */
  maxEntries?: number;
  /** Rejects entries written by an older schema. */
  validate?: (value: unknown) => value is unknown;
}

/** One JSON file per key: cheap to write, no giant index to rewrite, easy to inspect or clear. */
export class FileKeyedCache<T> implements KeyedCache<T> {
  private memory = new Map<string, Envelope<T>>();

  constructor(private readonly options: FileCacheOptions) {
    mkdirSync(options.directory, { recursive: true });
    this.prune();
  }

  get(key: string): T | null {
    const envelope = this.memory.get(key) ?? readJsonFile<Envelope<T>>(this.pathFor(key));
    if (!envelope || envelope.key !== key) {
      log.debug(`${this.options.name} miss: ${key}`);
      return null;
    }
    const { maxAgeMs, validate } = this.options;
    if ((maxAgeMs && Date.now() - envelope.storedAt > maxAgeMs) || (validate && !validate(envelope.value))) {
      this.delete(key);
      log.debug(`${this.options.name} stale: ${key}`);
      return null;
    }
    this.memory.set(key, envelope);
    log.debug(`${this.options.name} hit: ${key}`);
    return envelope.value;
  }

  put(key: string, value: T): void {
    const envelope: Envelope<T> = { key, storedAt: Date.now(), value };
    this.memory.set(key, envelope);
    try {
      writeJsonFile(this.pathFor(key), envelope, 0o600);
    } catch (error) {
      log.error(`${this.options.name}: failed to write ${key}`, error);
    }
  }

  delete(key: string): void {
    this.memory.delete(key);
    try {
      unlinkSync(this.pathFor(key));
    } catch {
      /* already gone */
    }
  }

  clear(): void {
    this.memory.clear();
    rmSync(this.options.directory, { recursive: true, force: true });
    mkdirSync(this.options.directory, { recursive: true });
  }

  private pathFor(key: string): string {
    return join(this.options.directory, fileNameForKey(key));
  }

  private prune(): void {
    const { directory, maxEntries } = this.options;
    if (!maxEntries) return;
    try {
      const files = readdirSync(directory)
        .filter((f) => f.endsWith('.json'))
        .map((f) => ({ f, mtime: statSync(join(directory, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      files.slice(maxEntries).forEach(({ f }) => unlinkSync(join(directory, f)));
    } catch (error) {
      log.warn(`${this.options.name}: prune failed`, error);
    }
  }
}

/** In-memory cache for demo mode and tests. */
export class MemoryKeyedCache<T> implements KeyedCache<T> {
  private map = new Map<string, T>();
  get = (key: string): T | null => this.map.get(key) ?? null;
  put = (key: string, value: T): void => void this.map.set(key, value);
  delete = (key: string): void => void this.map.delete(key);
  clear = (): void => this.map.clear();
}
