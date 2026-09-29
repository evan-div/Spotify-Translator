import type { LyricLine } from '../types/domain';

const TIME_TAG_RE = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const META_TAG_RE = /^\[([a-z]{2,}):(.*)\]$/i;
const WORD_TAG_RE = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;
const DEFAULT_LAST_LINE_MS = 5000;

function tagToMs(minutes: string, seconds: string, fraction?: string): number {
  const frac = fraction ? Number(fraction.padEnd(3, '0').slice(0, 3)) : 0;
  return Number(minutes) * 60_000 + Number(seconds) * 1000 + frac;
}

/**
 * Parses LRC text into timestamped lines sorted by time.
 * Supports multiple timestamps per line, `[offset:]` metadata and enhanced word tags.
 * Blank lines are kept (as empty text) because they mark instrumental gaps.
 */
export function parseLrc(lrc: string, durationMs?: number): LyricLine[] {
  let offsetMs = 0;
  const entries: Array<{ startTimeMs: number; text: string }> = [];

  for (const rawLine of lrc.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const meta = META_TAG_RE.exec(line);
    if (meta && meta[1] && !/^\d+$/.test(meta[1])) {
      if (meta[1].toLowerCase() === 'offset') offsetMs = Number(meta[2]?.trim()) || 0;
      continue;
    }

    const stamps: number[] = [];
    TIME_TAG_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    while ((match = TIME_TAG_RE.exec(line)) !== null) {
      stamps.push(tagToMs(match[1] ?? '0', match[2] ?? '0', match[3]));
      lastIndex = TIME_TAG_RE.lastIndex;
    }
    if (stamps.length === 0) continue;

    const text = line.slice(lastIndex).replace(WORD_TAG_RE, '').replace(/\s+/g, ' ').trim();
    for (const startTimeMs of stamps) entries.push({ startTimeMs, text });
  }

  entries.sort((a, b) => a.startTimeMs - b.startTimeMs);

  const collapsed: typeof entries = [];
  for (const entry of entries) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && prev.text === '' && entry.text === '') continue;
    collapsed.push(entry);
  }

  return collapsed.map((entry, i) => {
    const start = Math.max(0, entry.startTimeMs + offsetMs);
    const next = collapsed[i + 1];
    const end = next
      ? Math.max(start, next.startTimeMs + offsetMs)
      : Math.max(start + DEFAULT_LAST_LINE_MS, durationMs ?? 0);
    return { text: entry.text, startTimeMs: start, endTimeMs: end };
  });
}

/** Plain (unsynced) lyrics: one entry per line; a single blank entry preserves stanza breaks. */
export function parsePlainLyrics(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(TIME_TAG_RE, '').replace(/\s+/g, ' ').trim();
    if (line === '' && (lines.length === 0 || lines[lines.length - 1]?.text === '')) continue;
    lines.push({ text: line });
  }
  while (lines.length > 0 && lines[lines.length - 1]?.text === '') lines.pop();
  return lines;
}

/** Strips timing from synced lines, e.g. when the matched recording's length differs too much. */
export function stripTiming(lines: readonly LyricLine[]): LyricLine[] {
  const plain = lines.map((l) => ({ text: l.text }));
  return plain.filter((l, i) => !(l.text === '' && (i === 0 || plain[i - 1]?.text === '')));
}

export function hasUsableTimestamps(lines: readonly LyricLine[]): boolean {
  const withText = lines.filter((l) => l.text.length > 0);
  return withText.length >= 2 && withText.every((l) => typeof l.startTimeMs === 'number');
}
