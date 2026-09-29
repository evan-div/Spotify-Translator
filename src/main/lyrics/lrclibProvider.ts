import { ProviderError, type LyricLine, type TrackLyrics, type TrackQuery } from '@shared/types/domain';
import { hasUsableTimestamps, parseLrc, parsePlainLyrics, stripTiming } from '@shared/utils/lrc';
import { titleVariants } from '@shared/utils/text';
import { createLogger } from '../logger';
import { httpJson, httpJsonOrNull } from '../net/http';
import type { LyricsProvider, LyricsSearchResult } from './LyricsProvider';
import { canTrustSync, pickBestCandidate, type MatchCandidate } from './matching';

const log = createLogger('lyrics:lrclib');

/** Shape of an LRCLIB record (https://lrclib.net/docs). Isolated here: nothing else sees it. */
interface LrclibRecord {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

interface Candidate extends MatchCandidate {
  record: LrclibRecord;
}

const DEFAULT_BASE_URL = 'https://lrclib.net/api';
const USER_AGENT = 'LyricLens/0.1.0 (https://github.com/evan-div/Spotify-Translator)';

function toCandidate(record: LrclibRecord): Candidate {
  return {
    record,
    title: record.trackName,
    artist: record.artistName,
    durationMs: typeof record.duration === 'number' ? Math.round(record.duration * 1000) : null,
    hasSyncedLyrics: Boolean(record.syncedLyrics),
    instrumental: Boolean(record.instrumental),
  };
}

/**
 * LRCLIB: a free, community-maintained lyrics database with synced (LRC) lyrics and no API key.
 * See README for licensing considerations: lyrics remain the property of their rightsholders.
 */
export class LrclibProvider implements LyricsProvider {
  readonly id = 'lrclib';
  readonly displayName = 'LRCLIB';

  constructor(
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  supportsSyncedLyrics(): boolean {
    return true;
  }

  async searchLyrics(track: TrackQuery, signal?: AbortSignal): Promise<LyricsSearchResult[]> {
    const candidates = await this.collectCandidates(track, signal);
    return candidates.map((c) => ({
      providerId: this.id,
      providerTrackId: String(c.record.id),
      title: c.record.trackName,
      artist: c.record.artistName,
      album: c.record.albumName ?? '',
      durationMs: c.durationMs,
      hasSyncedLyrics: Boolean(c.hasSyncedLyrics),
      instrumental: Boolean(c.instrumental),
    }));
  }

  async getLyrics(track: TrackQuery, signal?: AbortSignal): Promise<TrackLyrics | null> {
    const exact = await this.getExact(track, signal);
    const chosen = exact ?? pickBestCandidate(track, await this.searchCandidates(track, signal));
    if (!chosen) {
      log.info(`No acceptable match for "${track.title}" — ${track.artists.join(', ')}`);
      return null;
    }
    log.info(`Matched "${chosen.title}" — ${chosen.artist} (id ${chosen.record.id})`);
    return this.toTrackLyrics(track, chosen);
  }

  /* -------------------------------------------------------------- */

  private async collectCandidates(track: TrackQuery, signal?: AbortSignal): Promise<Candidate[]> {
    const exact = await this.getExact(track, signal);
    const searched = await this.searchCandidates(track, signal);
    return exact ? [exact, ...searched.filter((c) => c.record.id !== exact.record.id)] : searched;
  }

  /** /api/get: exact signature match including duration. */
  private async getExact(track: TrackQuery, signal?: AbortSignal): Promise<Candidate | null> {
    const artist = track.artists[0];
    const title = titleVariants(track.title)[0];
    if (!artist || !title) return null;
    const params = new URLSearchParams({ track_name: title, artist_name: artist });
    if (track.album) params.set('album_name', track.album);
    if (track.durationMs > 0) params.set('duration', String(Math.round(track.durationMs / 1000)));
    try {
      const record = await httpJson<LrclibRecord>(`${this.baseUrl}/get?${params}`, this.request(signal));
      return record?.id ? toCandidate(record) : null;
    } catch (error) {
      if (error instanceof ProviderError && error.code === 'not-found') return null;
      throw error;
    }
  }

  /** /api/search: fuzzy; tried with each title variant and finally with a free-text query. */
  private async searchCandidates(track: TrackQuery, signal?: AbortSignal): Promise<Candidate[]> {
    const artist = track.artists[0] ?? '';
    const queries: URLSearchParams[] = titleVariants(track.title).map(
      (title) => new URLSearchParams({ track_name: title, artist_name: artist }),
    );
    queries.push(new URLSearchParams({ q: `${artist} ${titleVariants(track.title).at(-1) ?? track.title}`.trim() }));

    const seen = new Map<number, Candidate>();
    for (const params of queries) {
      const records = await httpJsonOrNull<LrclibRecord[]>(`${this.baseUrl}/search?${params}`, this.request(signal));
      (records ?? []).forEach((r) => seen.set(r.id, toCandidate(r)));
      if (pickBestCandidate(track, [...seen.values()])) break;
    }
    return [...seen.values()];
  }

  private request(signal?: AbortSignal) {
    return {
      provider: 'LRCLIB',
      headers: { 'User-Agent': USER_AGENT, 'Lrclib-Client': USER_AGENT },
      signal,
      fetchImpl: this.fetchImpl,
    };
  }

  private toTrackLyrics(track: TrackQuery, chosen: Candidate): TrackLyrics | null {
    const { record } = chosen;
    let lines: LyricLine[] = [];
    let synced = false;

    if (record.syncedLyrics) {
      const parsed = parseLrc(record.syncedLyrics, track.durationMs);
      if (hasUsableTimestamps(parsed)) {
        if (canTrustSync(track, chosen.durationMs)) {
          lines = parsed;
          synced = true;
        } else {
          log.warn(`Duration mismatch for ${record.id}; using lyrics without timing`);
          lines = stripTiming(parsed);
        }
      }
    }
    if (lines.length === 0 && record.plainLyrics) lines = parsePlainLyrics(record.plainLyrics);
    if (lines.filter((l) => l.text).length === 0) return null;

    return {
      trackKey: track.trackKey,
      artist: record.artistName,
      title: record.trackName,
      synced,
      lines,
      provider: this.id,
      providerTrackId: String(record.id),
      fetchedAt: new Date().toISOString(),
    };
  }
}
