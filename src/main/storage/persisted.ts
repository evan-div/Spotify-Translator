import { createLogger } from '../logger';
import { readJsonFile, writeJsonFile } from './jsonFile';

const log = createLogger('storage');

/** A JSON document on disk with debounced, atomic saves. In-memory only when `path` is null. */
export class PersistedDocument<T> {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly path: string | null,
    private readonly delayMs = 300,
  ) {}

  load(fallback: T): T {
    return (this.path ? readJsonFile<T>(this.path) : null) ?? fallback;
  }

  scheduleSave(value: T): void {
    if (!this.path) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.saveNow(value), this.delayMs);
  }

  saveNow(value: T): void {
    if (!this.path) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try {
      writeJsonFile(this.path, value, 0o600);
    } catch (error) {
      log.error(`Failed to save ${this.path}`, error);
    }
  }
}
