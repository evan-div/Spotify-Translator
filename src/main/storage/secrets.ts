export interface SecretStore {
  get(name: string): string | null;
  set(name: string, value: string): void;
  delete(name: string): void;
  has(name: string): boolean;
}

/** In-memory store for demo mode and tests. */
export class MemorySecretStore implements SecretStore {
  private values = new Map<string, string>();
  get = (name: string): string | null => this.values.get(name) ?? null;
  set = (name: string, value: string): void => void this.values.set(name, value);
  delete = (name: string): void => void this.values.delete(name);
  has = (name: string): boolean => this.values.has(name);
}
