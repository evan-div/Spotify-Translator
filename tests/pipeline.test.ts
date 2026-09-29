import { describe, expect, it, vi } from 'vitest';
import { ProviderError, type LyricsState, type SpotifyTrack, type TrackLyrics } from '@shared/types/domain';
import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import { MemoryKeyedCache } from '../src/main/cache/fileCache';
import type { LyricsCache, TranslationCache } from '../src/main/cache/caches';
import { LyricsService } from '../src/main/lyrics/lyricsService';
import type { LyricsProvider } from '../src/main/lyrics/LyricsProvider';
import { LyricsPipeline } from '../src/main/pipeline/lyricsPipeline';
import type { TranslationProvider } from '../src/main/translation/TranslationProvider';

const track: SpotifyTrack = { id: 't1', key: 't1', title: 'Canción', artists: ['Artista'], album: 'Alb', artworkUrl: null, durationMs: 100_000, isLocal: false };
const spanish: TrackLyrics = {
  trackKey: 't1', artist: 'Artista', title: 'Canción', synced: true, provider: 'fake', fetchedAt: '',
  lines: [
    { text: 'Todavía te quiero', startTimeMs: 0 },
    { text: 'aunque no estés aquí', startTimeMs: 4000 },
    { text: '', startTimeMs: 8000 },
    { text: 'Todavía te quiero', startTimeMs: 9000 },
  ],
};
const english: TrackLyrics = { ...spanish, lines: [{ text: "I can't stop thinking about you", startTimeMs: 0 }, { text: 'and the way that we were', startTimeMs: 3000 }] };

function setup(opts: { lyrics?: TrackLyrics | null; provider?: Partial<TranslationProvider> | null; getLyricsError?: Error } = {}) {
  const getLyrics = vi.fn(async () => {
    if (opts.getLyricsError) throw opts.getLyricsError;
    return opts.lyrics === undefined ? spanish : opts.lyrics;
  });
  const lyricsProvider: LyricsProvider = { id: 'fake', displayName: 'Fake', supportsSyncedLyrics: () => true, searchLyrics: async () => [], getLyrics };
  const translateLines = vi.fn(async (lines: readonly string[]) => lines.map((l) => `EN(${l})`));
  const provider: TranslationProvider | null =
    opts.provider === null
      ? null
      : ({ id: 'openai', displayName: 'Fake MT', isConfigured: () => true, detectLanguage: async () => ({ code: 'es' }), translateText: async (t: string) => t, translateLines, ...opts.provider } as TranslationProvider);
  const translations: TranslationCache = new MemoryKeyedCache();
  const lyricsCache: LyricsCache = new MemoryKeyedCache();
  const states: LyricsState[] = [];
  const pipeline = new LyricsPipeline({
    lyrics: new LyricsService([lyricsProvider], lyricsCache),
    translations,
    getSettings: () => DEFAULT_SETTINGS,
    getTranslationProvider: () => provider,
    emit: (s) => states.push(s),
  });
  return { pipeline, states, getLyrics, translateLines, translations, lyricsCache };
}
const last = (states: LyricsState[]) => states[states.length - 1]!;

describe('lyrics pipeline', () => {
  it('goes loading → translating → ready and caches the translation', async () => {
    const { pipeline, states, translateLines, translations } = setup();
    expect(await pipeline.load(track)).toBe('ready');
    expect(states.map((s) => s.status)).toEqual(['loading-lyrics', 'translating', 'ready']);
    const done = last(states);
    if (done.status !== 'ready') throw new Error('expected ready');
    expect(done.view.translationStatus).toBe('translated');
    expect(done.view.lines.map((l) => l.translation)).toEqual(['EN(Todavía te quiero)', 'EN(aunque no estés aquí)', null, 'EN(Todavía te quiero)']);
    // Repeated chorus is translated once.
    expect(translateLines).toHaveBeenCalledWith(['Todavía te quiero', 'aunque no estés aquí'], expect.anything());
    expect(translations.get('spotify:t1:en')).not.toBeNull();
  });

  it('serves a replay entirely from cache with no provider calls', async () => {
    const { pipeline, states, getLyrics, translateLines } = setup();
    await pipeline.load(track);
    getLyrics.mockClear();
    translateLines.mockClear();
    states.length = 0;
    await pipeline.load(track);
    expect(getLyrics).not.toHaveBeenCalled();
    expect(translateLines).not.toHaveBeenCalled();
    expect(states.map((s) => s.status)).toEqual(['loading-lyrics', 'ready']);
    const done = last(states);
    expect(done.status === 'ready' && done.view.fromCache).toBe(true);
  });

  it('a forced refresh bypasses every cache', async () => {
    const { pipeline, getLyrics, translateLines } = setup();
    await pipeline.load(track);
    await pipeline.load(track, { force: true });
    expect(getLyrics).toHaveBeenCalledTimes(2);
    expect(translateLines).toHaveBeenCalledTimes(2);
  });

  it('does not translate English lyrics', async () => {
    const { pipeline, states, translateLines } = setup({ lyrics: english });
    await pipeline.load(track);
    expect(translateLines).not.toHaveBeenCalled();
    const done = last(states);
    expect(done.status === 'ready' && done.view.translationStatus).toBe('not-needed');
  });

  it('shows original lyrics with a clear status when translation fails, and does not cache the failure', async () => {
    const { pipeline, states, translations } = setup({ provider: { translateLines: async () => { throw new ProviderError('X', 'network', 'down'); } } });
    await pipeline.load(track);
    const done = last(states);
    expect(done.status).toBe('ready');
    if (done.status === 'ready') {
      expect(done.view.translationStatus).toBe('failed');
      expect(done.view.lines[0]?.text).toBe('Todavía te quiero');
      expect(done.view.note).toMatch(/Showing original lyrics/);
    }
    expect(translations.get('spotify:t1:en')).toBeNull();
  });

  it('degrades gracefully when no translation provider is configured', async () => {
    const { pipeline, states } = setup({ provider: null });
    await pipeline.load(track);
    const done = last(states);
    expect(done.status === 'ready' && done.view.translationStatus).toBe('not-configured');
  });

  it('reports not-found and recoverable errors', async () => {
    const a = setup({ lyrics: null });
    expect(await a.pipeline.load(track)).toBe('not-found');
    expect(last(a.states).status).toBe('not-found');
    const b = setup({ getLyricsError: new ProviderError('LRCLIB', 'network', 'x') });
    expect(await b.pipeline.load(track)).toBe('error');
    const err = last(b.states);
    expect(err.status === 'error' && err.message).toMatch(/internet/);
    expect(JSON.stringify(err)).not.toMatch(/stack|at .*\(/);
  });

  it('a skipped song never publishes stale results', async () => {
    let release: () => void = () => undefined;
    const slow = setup({ provider: { translateLines: (lines: readonly string[]) => new Promise<string[]>((r) => { release = () => r(lines.map((l) => `EN(${l})`)); }) } });
    const first = slow.pipeline.load(track);
    await vi.waitFor(() => expect(slow.states.some((s) => s.status === 'translating')).toBe(true));
    const other: SpotifyTrack = { ...track, id: 't2', key: 't2' };
    slow.pipeline.cancel();
    release();
    expect(await first).toBe('cancelled');
    expect(slow.states.some((s) => s.status === 'ready')).toBe(false);
    void other;
  });
});
