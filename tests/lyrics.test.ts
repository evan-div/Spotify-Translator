import { describe, expect, it, vi } from 'vitest';
import type { TrackQuery } from '@shared/types/domain';
import { LrclibProvider } from '../src/main/lyrics/lrclibProvider';
import { canTrustSync, pickBestCandidate, scoreCandidate } from '../src/main/lyrics/matching';

const query: TrackQuery = {
  trackKey: 'abc',
  title: 'Song Name - 2011 Remaster',
  artists: ['Main Artist', 'Guest'],
  album: 'Album',
  durationMs: 200_000,
};
const cand = (over = {}) => ({ title: 'Song Name', artist: 'Main Artist', durationMs: 200_000, hasSyncedLyrics: true, ...over });

describe('lyrics candidate matching', () => {
  it('accepts the same song despite a remaster suffix', () => {
    expect(pickBestCandidate(query, [cand()])).not.toBeNull();
  });
  it('rejects a different artist with the same title', () => {
    expect(pickBestCandidate(query, [cand({ artist: 'Someone Else' })])).toBeNull();
  });
  it('rejects a different title by the same artist', () => {
    expect(pickBestCandidate(query, [cand({ title: 'Completely Other Track' })])).toBeNull();
  });
  it('prefers the candidate whose duration matches', () => {
    const good = cand({ durationMs: 200_500 });
    const long = cand({ durationMs: 260_000 });
    expect(pickBestCandidate(query, [long, good])).toBe(good);
  });
  it('skips instrumentals', () => {
    expect(pickBestCandidate(query, [cand({ instrumental: true })])).toBeNull();
  });
  it('accepts a match on a secondary credited artist', () => {
    expect(pickBestCandidate(query, [cand({ artist: 'Guest' })])).not.toBeNull();
  });
  it('scores duration-unknown candidates neutrally', () => {
    expect(scoreCandidate(query, cand({ durationMs: null })).score).toBeGreaterThan(0.8);
  });
  it('only trusts timestamps for recordings of similar length', () => {
    expect(canTrustSync(query, 202_000)).toBe(true);
    expect(canTrustSync(query, 215_000)).toBe(false);
    expect(canTrustSync(query, null)).toBe(true);
  });
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const record = (over = {}) => ({
  id: 1, trackName: 'Song Name', artistName: 'Main Artist', albumName: 'Album', duration: 200, instrumental: false,
  plainLyrics: 'one\ntwo', syncedLyrics: '[00:01.00] one\n[00:05.00] two', ...over,
});

describe('LrclibProvider', () => {
  it('returns synced lyrics from an exact match', async () => {
    const fetchImpl = vi.fn(async () => json(record())) as unknown as typeof fetch;
    const lyrics = await new LrclibProvider('https://x/api', fetchImpl).getLyrics(query);
    expect(lyrics).toMatchObject({ synced: true, provider: 'lrclib', title: 'Song Name', trackKey: 'abc' });
    expect(lyrics?.lines[0]).toMatchObject({ text: 'one', startTimeMs: 1000 });
    const url = String((fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]);
    expect(url).toContain('/get?');
    expect(url).toContain('track_name=Song+Name'); // cleaned title
    expect(url).toContain('duration=200');
  });

  it('falls back to search and picks the best candidate', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/get?')) return new Response('{}', { status: 404 });
      return json([record({ id: 9, artistName: 'Other', trackName: 'Other' }), record({ id: 2 })]);
    }) as unknown as typeof fetch;
    const lyrics = await new LrclibProvider('https://x/api', fetchImpl).getLyrics(query);
    expect(lyrics?.providerTrackId).toBe('2');
  });

  it('degrades to plain lyrics when the recording length differs too much', async () => {
    const fetchImpl = vi.fn(async () => json(record({ duration: 230 }))) as unknown as typeof fetch;
    const lyrics = await new LrclibProvider('https://x/api', fetchImpl).getLyrics(query);
    // /get is trusted as a candidate only if it matches; duration 230 vs 200 scores low but exact endpoint accepted.
    expect(lyrics?.synced).toBe(false);
    expect(lyrics?.lines.every((l) => l.startTimeMs === undefined)).toBe(true);
  });

  it('returns null when nothing matches and throws typed errors on network failure', async () => {
    const none = vi.fn(async () => new Response('[]', { status: 200 })) as unknown as typeof fetch;
    const notFound = vi.fn(async (input: string | URL) => (String(input).includes('/get?') ? new Response('{}', { status: 404 }) : json([]))) as unknown as typeof fetch;
    expect(await new LrclibProvider('https://x/api', notFound).getLyrics(query)).toBeNull();
    void none;
    const offline = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(new LrclibProvider('https://x/api', offline).getLyrics(query)).rejects.toMatchObject({ code: 'network' });
  });

  it('uses plain lyrics when there are no timestamps', async () => {
    const fetchImpl = vi.fn(async () => json(record({ syncedLyrics: null }))) as unknown as typeof fetch;
    const lyrics = await new LrclibProvider('https://x/api', fetchImpl).getLyrics(query);
    expect(lyrics).toMatchObject({ synced: false });
    expect(lyrics?.lines.map((l) => l.text)).toEqual(['one', 'two']);
  });
});
