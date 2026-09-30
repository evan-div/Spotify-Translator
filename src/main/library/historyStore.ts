import type { LyricsView, SpotifyTrack } from '@shared/types/domain';
import type { HistoryEntry } from '@shared/types/library';
import { TypedEmitter } from '@shared/utils/emitter';
import { PersistedDocument } from '../storage/persisted';

const FILE_VERSION = 1;
export const MAX_HISTORY_ENTRIES = 500;

interface HistoryFile {
  version: number;
  entries: HistoryEntry[];
}

interface Events extends Record<string, unknown> {
  change: HistoryEntry[];
}

const byRecency = (a: HistoryEntry, b: HistoryEntry): number => b.lastPlayedAt.localeCompare(a.lastPlayedAt);

/** Songs that have shown lyrics, newest first. Favourites are never pruned or cleared. */
export class HistoryStore extends TypedEmitter<Events> {
  private entries: HistoryEntry[];
  private readonly doc: PersistedDocument<HistoryFile>;

  constructor(
    path: string | null,
    private readonly now: () => Date = () => new Date(),
  ) {
    super();
    this.doc = new PersistedDocument<HistoryFile>(path);
    const stored = this.doc.load({ version: FILE_VERSION, entries: [] });
    this.entries = (Array.isArray(stored.entries) ? stored.entries : []).sort(byRecency);
  }

  list(): HistoryEntry[] {
    return this.entries;
  }

  get(trackKey: string): HistoryEntry | undefined {
    return this.entries.find((e) => e.trackKey === trackKey);
  }

  /** Records that a song's lyrics were shown (one call per listen). */
  recordPlay(track: SpotifyTrack, view: LyricsView, countPlay = true): HistoryEntry {
    const stamp = this.now().toISOString();
    const existing = this.get(track.key);
    const entry: HistoryEntry = {
      trackKey: track.key,
      title: track.title,
      artists: track.artists,
      album: track.album,
      artworkUrl: track.artworkUrl,
      language: view.language,
      synced: view.synced,
      translated: view.translationStatus === 'translated',
      favorite: existing?.favorite ?? false,
      playCount: (existing?.playCount ?? 0) + (countPlay || !existing ? 1 : 0),
      firstPlayedAt: existing?.firstPlayedAt ?? stamp,
      lastPlayedAt: countPlay ? stamp : (existing?.lastPlayedAt ?? stamp),
    };
    this.upsert(entry);
    return entry;
  }

  /** Favouriting a song that isn't in history yet (e.g. no lyrics found) creates its entry. */
  setFavorite(track: Pick<SpotifyTrack, 'key' | 'title' | 'artists' | 'album' | 'artworkUrl'> | null, trackKey: string, favorite: boolean): void {
    const existing = this.get(trackKey);
    if (existing) {
      if (existing.favorite !== favorite) this.upsert({ ...existing, favorite }, false);
      return;
    }
    if (!favorite || !track) return;
    const stamp = this.now().toISOString();
    this.upsert({
      trackKey,
      title: track.title,
      artists: track.artists,
      album: track.album,
      artworkUrl: track.artworkUrl,
      language: 'unknown',
      synced: false,
      translated: false,
      favorite: true,
      playCount: 0,
      firstPlayedAt: stamp,
      lastPlayedAt: stamp,
    });
  }

  isFavorite(trackKey: string): boolean {
    return this.get(trackKey)?.favorite ?? false;
  }

  remove(trackKey: string): void {
    this.replaceAll(this.entries.filter((e) => e.trackKey !== trackKey));
  }

  /** Clears everything except favourites. */
  clear(): void {
    this.replaceAll(this.entries.filter((e) => e.favorite));
  }

  flush(): void {
    this.doc.saveNow({ version: FILE_VERSION, entries: this.entries });
  }

  private upsert(entry: HistoryEntry, resort = true): void {
    const rest = this.entries.filter((e) => e.trackKey !== entry.trackKey);
    const next = resort ? [entry, ...rest].sort(byRecency) : this.entries.map((e) => (e.trackKey === entry.trackKey ? entry : e));
    this.replaceAll(this.prune(next));
  }

  /** Keeps every favourite, then the most recent others up to the cap. */
  private prune(entries: HistoryEntry[]): HistoryEntry[] {
    if (entries.length <= MAX_HISTORY_ENTRIES) return entries;
    const favorites = entries.filter((e) => e.favorite);
    const others = entries.filter((e) => !e.favorite).slice(0, Math.max(0, MAX_HISTORY_ENTRIES - favorites.length));
    return [...favorites, ...others].sort(byRecency);
  }

  private replaceAll(next: HistoryEntry[]): void {
    this.entries = next;
    this.doc.scheduleSave({ version: FILE_VERSION, entries: this.entries });
    this.emit('change', this.entries);
  }
}
