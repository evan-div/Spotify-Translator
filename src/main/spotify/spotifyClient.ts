import { httpJson, httpJsonOrNull } from '../net/http';
import { ProviderError } from '@shared/types/domain';
import type { SpotifyAuth } from './spotifyAuth';

const API = 'https://api.spotify.com/v1';

/** Raw Web API shapes (only the fields we read). Confined to the spotify/ folder. */
export interface SpotifyImage {
  url: string;
  width?: number | null;
  height?: number | null;
}
export interface SpotifyTrackObject {
  type: 'track';
  id: string | null;
  name: string;
  duration_ms: number;
  is_local?: boolean;
  artists: Array<{ name: string }>;
  album: { name: string; images?: SpotifyImage[] };
}
export interface SpotifyEpisodeObject {
  type: 'episode';
  id: string;
  name: string;
  duration_ms: number;
  images?: SpotifyImage[];
  show?: { name: string; publisher?: string; images?: SpotifyImage[] };
}
export interface CurrentlyPlayingResponse {
  is_playing: boolean;
  progress_ms: number | null;
  currently_playing_type: 'track' | 'episode' | 'ad' | 'unknown';
  item: SpotifyTrackObject | SpotifyEpisodeObject | null;
}
interface ProfileResponse {
  display_name?: string | null;
  id: string;
}

export class SpotifyClient {
  constructor(
    private readonly auth: SpotifyAuth,
    private readonly fetchImpl?: typeof fetch,
  ) {}

  /** Null when nothing is playing (HTTP 204). */
  getCurrentlyPlaying(signal?: AbortSignal): Promise<CurrentlyPlayingResponse | null> {
    return this.request((token) =>
      httpJsonOrNull<CurrentlyPlayingResponse>(`${API}/me/player/currently-playing?additional_types=episode`, {
        provider: 'Spotify',
        headers: { Authorization: `Bearer ${token}` },
        signal,
        fetchImpl: this.fetchImpl,
      }),
    );
  }

  async getUserName(signal?: AbortSignal): Promise<string | null> {
    const profile = await this.request((token) =>
      httpJson<ProfileResponse>(`${API}/me`, {
        provider: 'Spotify',
        headers: { Authorization: `Bearer ${token}` },
        signal,
        fetchImpl: this.fetchImpl,
      }),
    );
    return profile.display_name || profile.id || null;
  }

  /** Runs a request; on 401 refreshes the token once and retries. */
  private async request<T>(run: (token: string) => Promise<T>): Promise<T> {
    try {
      return await run(await this.auth.getAccessToken());
    } catch (error) {
      if (error instanceof ProviderError && error.status === 401) return run(await this.auth.refresh());
      throw error;
    }
  }
}
