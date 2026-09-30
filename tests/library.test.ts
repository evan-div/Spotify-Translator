import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderError, type LyricsView, type SpotifyTrack } from '@shared/types/domain';
import type { WordDefinition } from '@shared/types/library';
import { extractLemma, htmlToText, normalizeWord, segmentText, shortGloss } from '@shared/utils/words';
import { MemoryKeyedCache } from '../src/main/cache/fileCache';
import type { DictionaryLookup, DictionaryProvider } from '../src/main/dictionary/DictionaryProvider';
import { DictionaryService } from '../src/main/dictionary/dictionaryService';
import { WiktionaryProvider, parseWiktionary } from '../src/main/dictionary/wiktionaryProvider';
import { HistoryStore, MAX_HISTORY_ENTRIES } from '../src/main/library/historyStore';
import { VocabularyStore } from '../src/main/library/vocabularyStore';
import { parseWordRequest } from '../src/main/ipc/registerIpc';
import { sanitizeStoredSettings } from '../src/main/storage/settingsSchema';
import type { TranslationProvider } from '../src/main/translation/TranslationProvider';

describe('splitting lyrics into tappable words', () => {
  it('round-trips the text and marks words', () => {
    const text = "¿Dónde estás, corazón? Don't stop — mi-amor";
    const segs = segmentText(text);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.isWord).map((s) => s.text)).toEqual(['Dónde', 'estás', 'corazón', "Don't", 'stop', 'mi-amor']);
  });
  it('handles accents, ñ and empty input', () => {
    expect(segmentText('El niño soñó').filter((s) => s.isWord).map((s) => s.text)).toEqual(['El', 'niño', 'soñó']);
    expect(segmentText('')).toEqual([]);
    expect(segmentText('♪ …')).toEqual([{ text: '♪ …', isWord: false }]);
  });
});

describe('normalising a tapped word', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeWord('¿Quién?')).toBe('quién');
    expect(normalizeWord('  Corazón, ')).toBe('corazón');
    expect(normalizeWord('Don’t')).toBe("don't");
  });
  it('rejects things that are not words', () => {
    expect(normalizeWord('123')).toBeNull();
    expect(normalizeWord('♪')).toBeNull();
    expect(normalizeWord('a'.repeat(50))).toBeNull();
    expect(normalizeWord('two words')).toBeNull();
  });
});

describe('dictionary text handling', () => {
  it('turns definition HTML into safe plain text', () => {
    expect(htmlToText('<a href="/wiki/house" title="house">house</a> &amp; <b>home</b>&nbsp;&#8212; <script>alert(1)</script>ok')).toBe('house & home — ok');
  });
  it('finds the lemma of an inflected form', () => {
    expect(extractLemma('<i>first-person singular present indicative of</i> <a>querer</a>')).toBe('querer');
    expect(extractLemma('third-person plural present indicative of mirar')).toBe('mirar');
    expect(extractLemma('present participle of buscar')).toBe('buscar');
    expect(extractLemma('feminine singular of cansado')).toBe('cansado');
  });
  it('does not mistake ordinary definitions for inflections', () => {
    expect(extractLemma('a piece of furniture')).toBeNull();
    expect(extractLemma('to want; to love')).toBeNull();
  });
  it('builds a short gloss', () => {
    expect(shortGloss([{ meanings: ['to want', 'to love', 'to desire'] }])).toBe('to want; to love');
    expect(shortGloss([])).toBe('');
  });
});

describe('Wiktionary provider', () => {
  const body = {
    en: [{ partOfSpeech: 'Noun', definitions: [{ definition: 'english only' }] }],
    es: [
      { partOfSpeech: 'Noun', language: 'Spanish', definitions: [
        { definition: '<a href="/wiki/house">house</a>', parsedExamples: [{ example: 'Mi <b>casa</b> es tu casa.' }] },
        { definition: '<a>home</a>' }, { definition: '' },
      ] },
      { partOfSpeech: 'Verb', definitions: [{ definition: 'first-person singular present indicative of <a>casar</a>' }] },
    ],
  };
  it('reads only the Spanish section, cleaned and limited', () => {
    const senses = parseWiktionary(body);
    expect(senses).toHaveLength(2);
    expect(senses[0]).toMatchObject({ partOfSpeech: 'Noun', meanings: ['house', 'home'], example: 'Mi casa es tu casa.' });
  });
  it('returns nothing when there is no Spanish entry', () => {
    expect(parseWiktionary({ en: body.en })).toEqual([]);
  });
  it('looks up lowercase then Capitalised and treats 404 as not found', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: string | URL) => {
      urls.push(String(input));
      return String(input).endsWith('/Madrid') ? new Response(JSON.stringify({ es: [{ partOfSpeech: 'Proper noun', definitions: [{ definition: 'Madrid' }] }] }), { status: 200 }) : new Response('{}', { status: 404 });
    }) as unknown as typeof fetch;
    const result = await new WiktionaryProvider(fetchImpl).lookup('madrid');
    expect(urls.map((u) => u.split('/').pop())).toEqual(['madrid', 'Madrid']);
    expect(result?.senses[0]?.partOfSpeech).toBe('Proper noun');
    expect(result?.sourceUrl).toContain('Madrid');
    const none = vi.fn(async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
    expect(await new WiktionaryProvider(none).lookup('zzzz')).toBeNull();
  });
  it('surfaces network failures as typed errors', async () => {
    const offline = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    await expect(new WiktionaryProvider(offline).lookup('casa')).rejects.toMatchObject({ code: 'network' });
  });
});

const provider = (table: Record<string, DictionaryLookup | null | Error>): DictionaryProvider & { calls: string[] } => {
  const calls: string[] = [];
  return {
    id: 't', displayName: 'Test', source: 'wiktionary' as const, calls,
    async lookup(word) {
      calls.push(word);
      const v = table[word];
      if (v instanceof Error) throw v;
      return v ?? null;
    },
  };
};
const sense = (...meanings: string[]) => ({ senses: [{ partOfSpeech: 'Verb', meanings }], sourceUrl: null });
const translator = (out: string, configured = true): TranslationProvider =>
  ({ id: 'openai', displayName: 'MT', isConfigured: () => configured, detectLanguage: async () => ({ code: 'es' }), translateText: async () => out, translateLines: async (l: readonly string[]) => [...l] }) as TranslationProvider;

describe('DictionaryService', () => {
  it('caches dictionary results', async () => {
    const p = provider({ casa: sense('house') });
    const svc = new DictionaryService([p], new MemoryKeyedCache(), () => null);
    expect((await svc.define('casa'))?.senses[0]?.meanings).toEqual(['house']);
    await svc.define('casa');
    expect(p.calls).toEqual(['casa']);
  });
  it('follows an inflected form to its dictionary form', async () => {
    const p = provider({ quiero: sense('first-person singular present indicative of querer'), querer: sense('to want', 'to love') });
    const def = await new DictionaryService([p], new MemoryKeyedCache(), () => null).define('quiero');
    expect(def).toMatchObject({ word: 'quiero', lemma: 'querer', formNote: expect.stringContaining('querer') });
    expect(def?.senses[0]?.meanings).toEqual(['to want', 'to love']);
  });
  it('keeps the form note when the lemma is not in the dictionary', async () => {
    const p = provider({ quiero: sense('first-person singular present indicative of querer') });
    const def = await new DictionaryService([p], new MemoryKeyedCache(), () => null).define('quiero');
    expect(def?.lemma).toBe('querer');
    expect(def?.senses[0]?.meanings[0]).toMatch(/querer/);
  });
  it('falls back to a marked machine translation, and does not cache it', async () => {
    const cache = new MemoryKeyedCache<WordDefinition>();
    const svc = new DictionaryService([provider({})], cache, () => translator('sweetheart'));
    const def = await svc.define('cariñito');
    expect(def).toMatchObject({ source: 'machine', senses: [{ meanings: ['sweetheart'] }] });
    expect(cache.get('dict:es:cariñito')).toBeNull();
  });
  it('ignores a "translation" identical to the word, and unconfigured translators', async () => {
    expect(await new DictionaryService([provider({})], new MemoryKeyedCache(), () => translator('hola')).define('hola')).toBeNull();
    expect(await new DictionaryService([provider({})], new MemoryKeyedCache(), () => translator('x', false)).define('hola')).toBeNull();
  });
  it('uses the machine fallback when the dictionary is unreachable, and reports the error when there is none', async () => {
    const down = provider({ casa: new ProviderError('W', 'network', 'x') });
    expect((await new DictionaryService([down], new MemoryKeyedCache(), () => translator('house')).define('casa'))?.source).toBe('machine');
    await expect(new DictionaryService([down], new MemoryKeyedCache(), () => null).define('casa')).rejects.toMatchObject({ code: 'network' });
  });
});

const track = (key: string, title = key): SpotifyTrack => ({ id: key, key, title, artists: ['A'], album: '', artworkUrl: null, durationMs: 1000, isLocal: false });
const view = (over: Partial<LyricsView> = {}): LyricsView => ({
  trackKey: 'k', title: 't', artist: 'a', synced: true, language: 'spanish', translationStatus: 'translated', note: null, lines: [], fromCache: false, provider: 'x', ...over,
});
const ctx = (line: string, key = 'k1') => ({ line, translation: null, trackKey: key, title: 'T', artist: 'A' });

describe('VocabularyStore', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));
  const def: WordDefinition = { word: 'querer', lemma: null, formNote: null, senses: [{ partOfSpeech: 'Verb', meanings: ['to want', 'to love', 'to like'] }], source: 'wiktionary', sourceUrl: null };

  it('saves once per word and accumulates sightings, newest first', () => {
    const store = new VocabularyStore(null);
    store.save(def, 'querer', ctx('te quiero', 'a'));
    store.save(def, 'querer', ctx('quiero más', 'b'));
    store.save(def, 'querer', ctx('te quiero', 'a')); // same line again: no duplicate
    expect(store.list()).toHaveLength(1);
    expect(store.list()[0]).toMatchObject({ id: 'querer', meaning: 'to want; to love', partOfSpeech: 'Verb' });
    expect(store.list()[0]?.contexts.map((c) => c.line)).toEqual(['te quiero', 'quiero más']);
  });
  it('can save without a definition and remove', () => {
    const store = new VocabularyStore(null);
    store.save(null, 'ay', ctx('ay ay'));
    expect(store.has('ay')).toBe(true);
    expect(store.list()[0]?.meaning).toBe('');
    store.remove('ay');
    expect(store.has('ay')).toBe(false);
  });
  it('persists to disk and notifies listeners', () => {
    dir = mkdtempSync(join(tmpdir(), 'll-vocab-'));
    const file = join(dir, 'v.json');
    const a = new VocabularyStore(file);
    const listener = vi.fn();
    a.on('change', listener);
    a.save(def, 'querer', ctx('x'));
    a.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(new VocabularyStore(file).list()[0]?.id).toBe('querer');
  });
  it('survives a corrupt file', () => {
    dir = mkdtempSync(join(tmpdir(), 'll-vocab-'));
    const file = join(dir, 'v.json');
    writeFileSync(file, '{not json');
    expect(new VocabularyStore(file).list()).toEqual([]);
  });
});

describe('HistoryStore', () => {
  const clock = () => { let t = Date.parse('2026-01-01T00:00:00Z'); return () => new Date((t += 60_000)); };

  it('records plays newest first and counts repeats', () => {
    const h = new HistoryStore(null, clock());
    h.recordPlay(track('a'), view());
    h.recordPlay(track('b'), view({ language: 'english', translationStatus: 'not-needed' }));
    h.recordPlay(track('a'), view());
    expect(h.list().map((e) => [e.trackKey, e.playCount])).toEqual([['a', 2], ['b', 1]]);
    expect(h.get('b')).toMatchObject({ language: 'english', translated: false });
  });
  it('updates details without counting again within one listen', () => {
    const h = new HistoryStore(null, clock());
    h.recordPlay(track('a'), view({ translationStatus: 'not-configured' }));
    h.recordPlay(track('a'), view({ translationStatus: 'translated' }), false);
    expect(h.get('a')).toMatchObject({ playCount: 1, translated: true });
  });
  it('favourites survive a play, clear, and pruning', () => {
    const h = new HistoryStore(null, clock());
    h.recordPlay(track('fav'), view());
    h.setFavorite(null, 'fav', true);
    h.recordPlay(track('other'), view());
    h.recordPlay(track('fav'), view());
    expect(h.isFavorite('fav')).toBe(true);
    h.clear();
    expect(h.list().map((e) => e.trackKey)).toEqual(['fav']);
    for (let i = 0; i < MAX_HISTORY_ENTRIES + 20; i++) h.recordPlay(track(`t${i}`), view());
    expect(h.list()).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(h.isFavorite('fav')).toBe(true);
  });
  it('can favourite a song that was never in history (e.g. no lyrics), but not un-favourite nothing', () => {
    const h = new HistoryStore(null, clock());
    h.setFavorite(track('x', 'No lyrics song'), 'x', true);
    expect(h.get('x')).toMatchObject({ title: 'No lyrics song', favorite: true, playCount: 0 });
    h.setFavorite(null, 'ghost', true);
    h.setFavorite(track('y'), 'y', false);
    expect(h.get('ghost')).toBeUndefined();
    expect(h.get('y')).toBeUndefined();
  });
  it('removes single entries', () => {
    const h = new HistoryStore(null, clock());
    h.recordPlay(track('a'), view());
    h.remove('a');
    expect(h.list()).toEqual([]);
  });
});

describe('untrusted input', () => {
  it('validates word requests from the renderer', () => {
    expect(parseWordRequest({ word: 'casa', line: 'mi casa', translation: 'my house' })).toEqual({ word: 'casa', line: 'mi casa', translation: 'my house' });
    expect(parseWordRequest({ word: 'casa', line: 'x' })).toEqual({ word: 'casa', line: 'x', translation: null });
    expect(parseWordRequest({ word: '', line: 'x' })).toBeNull();
    expect(parseWordRequest({ word: 'x'.repeat(100), line: 'x' })).toBeNull();
    expect(parseWordRequest({ word: 'casa', line: 5 })).toBeNull();
    expect(parseWordRequest(null)).toBeNull();
  });
  it('keeps new settings valid', () => {
    const s = sanitizeStoredSettings({ overlay: { tapWords: false }, library: { recordHistory: 'no' } });
    expect(s.overlay.tapWords).toBe(false);
    expect(s.library.recordHistory).toBe(true);
  });
});

import { formatRelativeTime, vocabularyToCsv } from '@shared/utils/csv';

describe('CSV export and relative time', () => {
  it('escapes commas, quotes and newlines', () => {
    const csv = vocabularyToCsv([
      { id: 'querer', word: 'querer', lemma: null, partOfSpeech: 'Verb', meaning: 'to want; to love', source: 'wiktionary', savedAt: '2026-01-01T00:00:00Z',
        contexts: [{ line: 'Te quiero, "mucho"', translation: 'I love you\nso much', trackKey: 'k', title: 'Song', artist: 'Ana' }] },
    ]);
    const [header, row] = csv.trimEnd().split('\r\n');
    expect(header).toBe('word,dictionary_form,part_of_speech,meaning,example,example_translation,song,artist,saved_at');
    expect(csv).toContain('"Te quiero, ""mucho"""');
    expect(csv).toContain('"I love you\nso much"');
    expect(row?.startsWith('querer,,Verb,')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('is just a header for an empty list', () => {
    expect(vocabularyToCsv([]).trim().split('\r\n')).toHaveLength(1);
  });
  it('formats relative times', () => {
    const now = Date.parse('2026-06-01T12:00:00Z');
    const ago = (ms: number) => new Date(now - ms).toISOString();
    expect(formatRelativeTime(ago(10_000), now)).toBe('just now');
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5 min ago');
    expect(formatRelativeTime(ago(3 * 3600_000), now)).toBe('3 hr ago');
    expect(formatRelativeTime(ago(26 * 3600_000), now)).toBe('yesterday');
    expect(formatRelativeTime(ago(3 * 86400_000), now)).toBe('3 days ago');
    expect(formatRelativeTime(ago(21 * 86400_000), now)).toBe('3 wk ago');
    expect(formatRelativeTime(ago(400 * 86400_000), now)).toBe('1 yr ago');
    expect(formatRelativeTime('garbage', now)).toBe('');
  });
});
