import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileKeyedCache } from '../src/main/cache/fileCache';
import { hashLyrics, localTrackKey, lyricsCacheKey, translationCacheKey } from '../src/main/cache/cacheKeys';

const q = (over = {}) => ({ trackKey: '3n3Ppam7vgaVa1iaRUc9Lp', title: 'Song', artists: ['Artist'], ...over });

describe('translation cache keys', () => {
  it('uses the Spotify ID and target language', () => {
    expect(translationCacheKey(q(), 'en')).toBe('spotify:3n3Ppam7vgaVa1iaRUc9Lp:en');
  });
  it('is independent of title/artist metadata changes for Spotify tracks', () => {
    expect(translationCacheKey(q({ title: 'Song - 2020 Remaster' }), 'en')).toBe(translationCacheKey(q(), 'en'));
  });
  it('falls back to a normalised artist+title hash for local files', () => {
    const a = translationCacheKey(q({ trackKey: 'local:abc', title: 'Bésame Mucho - Remastered', artists: ['Consuelo'] }), 'en');
    const b = translationCacheKey(q({ trackKey: 'local:zzz', title: 'besame mucho', artists: ['consuelo'] }), 'en');
    expect(a).toBe(b);
    expect(a.startsWith('meta:')).toBe(true);
    expect(translationCacheKey(q({ trackKey: 'local:abc', title: 'Other', artists: ['Consuelo'] }), 'en')).not.toBe(a);
  });
  it('local track keys are stable', () => {
    expect(localTrackKey('Song', ['A'], 180_400)).toBe(localTrackKey('Song ', ['a'], 180_000));
  });
  it('separates lyrics keys', () => {
    expect(lyricsCacheKey(q())).toBe('lyrics:3n3Ppam7vgaVa1iaRUc9Lp');
  });
  it('hashes lyric text but not timing', () => {
    expect(hashLyrics([{ text: 'a', startTimeMs: 1 }, { text: 'b' }])).toBe(hashLyrics([{ text: 'a', startTimeMs: 99 }, { text: 'b' }]));
    expect(hashLyrics([{ text: 'a' }])).not.toBe(hashLyrics([{ text: 'b' }]));
  });
});

describe('FileKeyedCache', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('persists across instances and honours max age', () => {
    dir = mkdtempSync(join(tmpdir(), 'll-cache-'));
    const a = new FileKeyedCache<{ v: number }>({ name: 't', directory: dir });
    expect(a.get('k')).toBeNull();
    a.put('k', { v: 1 });
    expect(new FileKeyedCache<{ v: number }>({ name: 't', directory: dir }).get('k')).toEqual({ v: 1 });
    const expired = new FileKeyedCache<{ v: number }>({ name: 't', directory: dir, maxAgeMs: -1 });
    expect(expired.get('k')).toBeNull();
  });

  it('drops entries that fail validation and survives corrupt files', () => {
    dir = mkdtempSync(join(tmpdir(), 'll-cache-'));
    const c = new FileKeyedCache<{ v: number }>({ name: 't', directory: dir, validate: (x): x is unknown => (x as { v?: number }).v === 2 });
    c.put('k', { v: 1 });
    expect(new FileKeyedCache<{ v: number }>({ name: 't', directory: dir, validate: (x): x is unknown => (x as { v?: number }).v === 2 }).get('k')).toBeNull();
  });
});
