import type { MediaType, PlaybackState, SpotifyTrack } from '@shared/types/domain';
import { localTrackKey } from '../cache/cacheKeys';
import type { CurrentlyPlayingResponse, SpotifyEpisodeObject, SpotifyImage, SpotifyTrackObject } from './spotifyClient';
import { IDLE_PLAYBACK } from './SpotifyService';

const PREFERRED_ARTWORK_WIDTH = 300;

/** Picks the smallest image at least ~300px wide (good enough for a blurred backdrop or thumbnail). */
export function pickArtwork(images: readonly SpotifyImage[] | undefined): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find((i) => (i.width ?? 0) >= PREFERRED_ARTWORK_WIDTH) ?? sorted[sorted.length - 1])?.url ?? null;
}

function mapTrack(item: SpotifyTrackObject): SpotifyTrack {
  const artists = item.artists.map((a) => a.name).filter(Boolean);
  const isLocal = Boolean(item.is_local) || !item.id;
  return {
    id: item.id,
    key: item.id ?? localTrackKey(item.name, artists, item.duration_ms),
    title: item.name,
    artists,
    album: item.album?.name ?? '',
    artworkUrl: pickArtwork(item.album?.images),
    durationMs: item.duration_ms,
    isLocal,
  };
}

function mapEpisode(item: SpotifyEpisodeObject): SpotifyTrack {
  return {
    id: item.id,
    key: `episode:${item.id}`,
    title: item.name,
    artists: item.show?.name ? [item.show.name] : [],
    album: item.show?.name ?? '',
    artworkUrl: pickArtwork(item.images ?? item.show?.images),
    durationMs: item.duration_ms,
    isLocal: false,
  };
}

/**
 * Converts a currently-playing response into our domain model.
 * `sampledAt` is the (latency-compensated) moment the progress value was true.
 */
export function mapCurrentlyPlaying(
  response: CurrentlyPlayingResponse | null,
  sampledAt: number,
): PlaybackState {
  if (!response) return { ...IDLE_PLAYBACK, sampledAt };

  const status = response.is_playing ? 'playing' : 'paused';
  const progressMs = Math.max(0, response.progress_ms ?? 0);
  const type = response.currently_playing_type;
  const { item } = response;

  if (type === 'ad') {
    return { status, mediaType: 'ad', track: null, progressMs, sampledAt, durationMs: 0 };
  }
  if (item?.type === 'episode') {
    const track = mapEpisode(item);
    return { status, mediaType: 'episode', track, progressMs, sampledAt, durationMs: track.durationMs };
  }
  if (item?.type === 'track') {
    const track = mapTrack(item);
    return { status, mediaType: 'track', track, progressMs, sampledAt, durationMs: track.durationMs };
  }
  const mediaType: MediaType = 'unknown';
  return { status, mediaType, track: null, progressMs, sampledAt, durationMs: 0 };
}
