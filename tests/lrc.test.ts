import { describe, expect, it } from 'vitest';
import { hasUsableTimestamps, parseLrc, parsePlainLyrics, stripTiming } from '@shared/utils/lrc';

describe('LRC parsing (timestamp lookup input)', () => {
  it('parses timestamps into milliseconds with end times', () => {
    const lines = parseLrc('[00:01.50] one\n[00:04.00] two\n[01:00.25] three', 90_000);
    expect(lines).toEqual([
      { text: 'one', startTimeMs: 1500, endTimeMs: 4000 },
      { text: 'two', startTimeMs: 4000, endTimeMs: 60_250 },
      { text: 'three', startTimeMs: 60_250, endTimeMs: 90_000 },
    ]);
  });

  it('expands multiple timestamps on one line and sorts', () => {
    const lines = parseLrc('[00:10.00][00:30.00] chorus\n[00:20.00] verse');
    expect(lines.map((l) => [l.text, l.startTimeMs])).toEqual([
      ['chorus', 10_000],
      ['verse', 20_000],
      ['chorus', 30_000],
    ]);
  });

  it('handles metadata, offset, 3-digit fractions and word tags', () => {
    const lines = parseLrc('[ar:Someone]\n[offset:500]\n[00:01.250] <00:01.25>hel<00:01.50>lo world');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ text: 'hello world', startTimeMs: 1750 });
  });

  it('keeps one blank marker for instrumental gaps', () => {
    const lines = parseLrc('[00:01.00] a\n[00:05.00]\n[00:06.00]\n[00:09.00] b');
    expect(lines.map((l) => l.text)).toEqual(['a', '', 'b']);
  });

  it('accepts timestamps without decimals', () => {
    expect(parseLrc('[01:02] x')[0]?.startTimeMs).toBe(62_000);
  });

  it('ignores garbage lines', () => {
    expect(parseLrc('not lrc at all\n\n???')).toEqual([]);
  });
});

describe('plain lyrics', () => {
  it('keeps single stanza breaks and trims edges', () => {
    const lines = parsePlainLyrics('\n\nline one\nline two\n\n\n\nline three\n\n');
    expect(lines.map((l) => l.text)).toEqual(['line one', 'line two', '', 'line three']);
  });

  it('strips timing and reports usability', () => {
    const synced = parseLrc('[00:01.00] a\n[00:02.00] b');
    expect(hasUsableTimestamps(synced)).toBe(true);
    expect(hasUsableTimestamps(stripTiming(synced))).toBe(false);
    expect(stripTiming(synced)[0]).toEqual({ text: 'a' });
  });
});
