import type { SourceLanguageCode } from '@shared/types/domain';
import type { VocabularyEntry, WordContext, WordDefinition } from '@shared/types/library';
import { shortGloss, vocabularyId } from '@shared/utils/words';
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
    // Entries saved before French support had no language: they were all Spanish.
    this.entries = (Array.isArray(stored.entries) ? stored.entries : []).map((e) => {
      const language = (e as Partial<VocabularyEntry>).language ?? 'es';
      return { ...e, language, id: e.id.includes(':') ? e.id : vocabularyId(language, e.id) };
    });
  }

  list(): VocabularyEntry[] {
    return this.entries;
  }

  has(id: string): boolean {
    return this.entries.some((e) => e.id === id);
  }

  /** Saves (or updates) a word from a definition and the line it was found in. */
  save(definition: WordDefinition | null, word: string, language: SourceLanguageCode, context: WordContext): VocabularyEntry {
    const id = vocabularyId(language, word);
    const existing = this.entries.find((e) => e.id === id);
    const sense = definition?.senses[0];
    const entry: VocabularyEntry = existing
      ? {
          ...existing,
          contexts: [context, ...existing.contexts.filter((c) => c.line !== context.line)].slice(0, MAX_CONTEXTS),
        }
      : {
          id,
          word,
          language,
          lemma: definition?.lemma ?? null,
          partOfSpeech: sense?.partOfSpeech || null,
          meaning: definition ? shortGloss(definition.senses) : '',
          contexts: [context],
          source: definition?.source ?? 'machine',
          savedAt: new Date().toISOString(),
        };
    this.entries = [entry, ...this.entries.filter((e) => e.id !== id)];
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
