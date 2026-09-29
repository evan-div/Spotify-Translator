import { createHash } from 'node:crypto';
import type { LyricLine, TargetLanguage, TrackQuery } from '@shared/types/domain';
import { normalizeArtist, normalizeTitle } from '@shared/utils/text';

const sha1 = (value: string): string => createHash('sha1').update(value).digest('hex');

/** Stable key for a track that has no Spotify ID (local files). */
export function localTrackKey(title: string, artists: readonly string[], durationMs: number): string {
  const artist = artists.map(normalizeArtist).join(',');
  return `local:${sha1(`${artist}|${normalizeTitle(title)}|${Math.round(durationMs / 1000)}`).slice(0, 16)}`;
}

/**
 * Translation cache key. Prefers the Spotify track ID (stable across re-releases of metadata);
 * falls back to a hash of normalised artist + title. The target language is part of the key so
 * additional target languages can coexist.
 */
export function translationCacheKey(
  track: Pick<TrackQuery, 'trackKey' | 'title' | 'artists'>,
  target: TargetLanguage,
): string {
  const isSpotifyId = !track.trackKey.startsWith('local:');
  const base = isSpotifyId
    ? `spotify:${track.trackKey}`
    : `meta:${sha1(`${track.artists.map(normalizeArtist).join(',')}|${normalizeTitle(track.title)}`)}`;
  return `${base}:${target}`;
}

export function lyricsCacheKey(track: Pick<TrackQuery, 'trackKey'>): string {
  return `lyrics:${track.trackKey}`;
}

/** Hash of the lyric text (independent of timing) used to validate cached translations. */
export function hashLyrics(lines: readonly LyricLine[]): string {
  return sha1(lines.map((l) => l.text).join('\n'));
}

export function fileNameForKey(key: string): string {
  return `${sha1(key)}.json`;
}
