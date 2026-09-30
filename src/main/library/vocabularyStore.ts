import type { VocabularyEntry, WordContext, WordDefinition } from '@shared/types/library';
import { shortGloss } from '@shared/utils/words';
import { TypedEmitter } from '@shared/utils/emitter';
import { PersistedDocument } from '../storage/persisted';

const MAX_CONTEXTS = 4;
const FILE_VERSION = 1;

interface VocabularyFile {
  version: number;
  entries: VocabularyEntry[];
}

interface Events extends Record<string, unknown> {
  change: VocabularyEntry[];
}

/** Words the user saved while listening. One entry per word; new sightings add context lines. */
export class VocabularyStore extends TypedEmitter<Events> {
  private entries: VocabularyEntry[];
  private readonly doc: PersistedDocument<VocabularyFile>;

  /** `path` null = in memory (demo mode, tests). */
  constructor(path: string | null) {
    super();
    this.doc = new PersistedDocument<VocabularyFile>(path);
    const stored = this.doc.load({ version: FILE_VERSION, entries: [] });
    this.entries = Array.isArray(stored.entries) ? stored.entries : [];
  }

  list(): VocabularyEntry[] {
    return this.entries;
  }

  has(id: string): boolean {
    return this.entries.some((e) => e.id === id);
  }

  /** Saves (or updates) a word from a definition and the line it was found in. */
  save(definition: WordDefinition | null, word: string, context: WordContext): VocabularyEntry {
    const existing = this.entries.find((e) => e.id === word);
    const sense = definition?.senses[0];
    const entry: VocabularyEntry = existing
      ? {
          ...existing,
          contexts: [context, ...existing.contexts.filter((c) => c.line !== context.line)].slice(0, MAX_CONTEXTS),
        }
      : {
          id: word,
          word,
          lemma: definition?.lemma ?? null,
          partOfSpeech: sense?.partOfSpeech || null,
          meaning: definition ? shortGloss(definition.senses) : '',
          contexts: [context],
          source: definition?.source ?? 'machine',
          savedAt: new Date().toISOString(),
        };
    this.entries = [entry, ...this.entries.filter((e) => e.id !== word)];
    this.commit();
    return entry;
  }

  remove(id: string): void {
    const next = this.entries.filter((e) => e.id !== id);
    if (next.length === this.entries.length) return;
    this.entries = next;
    this.commit();
  }

  flush(): void {
    this.doc.saveNow({ version: FILE_VERSION, entries: this.entries });
  }

  private commit(): void {
    this.doc.scheduleSave({ version: FILE_VERSION, entries: this.entries });
    this.emit('change', this.entries);
  }
}
