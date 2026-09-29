import { describe, expect, it, vi } from 'vitest';
import type { PlaybackState } from '@shared/types/domain';
import { mapCurrentlyPlaying, pickArtwork } from '../src/main/spotify/mapping';
import { SpotifyAuth, isPermanentAuthFailure } from '../src/main/spotify/spotifyAuth';
import { backoffDelay, nextPollDelay, POLL_INTERVALS } from '../src/main/spotify/realSpotifyService';
import { MemorySecretStore } from '../src/main/storage/secrets';
import { ProviderError } from '@shared/types/domain';

const trackItem = {
  type: 'track' as const, id: 'tid', name: 'Song', duration_ms: 200_000, artists: [{ name: 'A' }, { name: 'B' }],
  album: { name: 'Alb', images: [{ url: 'big', width: 640 }, { url: 'mid', width: 300 }, { url: 'small', width: 64 }] },
};

describe('Spotify playback mapping', () => {
  it('maps a playing track', () => {
    const s = mapCurrentlyPlaying({ is_playing: true, progress_ms: 12_345, currently_playing_type: 'track', item: trackItem }, 1000);
    expect(s).toMatchObject({ status: 'playing', mediaType: 'track', progressMs: 12_345, sampledAt: 1000, durationMs: 200_000 });
    expect(s.track).toMatchObject({ id: 'tid', key: 'tid', title: 'Song', artists: ['A', 'B'], album: 'Alb', artworkUrl: 'mid', isLocal: false });
  });
  it('maps paused, nothing playing, ads, podcasts and unknown', () => {
    expect(mapCurrentlyPlaying({ is_playing: false, progress_ms: 5, currently_playing_type: 'track', item: trackItem }, 0).status).toBe('paused');
    expect(mapCurrentlyPlaying(null, 7)).toMatchObject({ status: 'idle', track: null, sampledAt: 7 });
    expect(mapCurrentlyPlaying({ is_playing: true, progress_ms: 0, currently_playing_type: 'ad', item: null }, 0)).toMatchObject({ mediaType: 'ad', track: null });
    const ep = mapCurrentlyPlaying({ is_playing: true, progress_ms: 0, currently_playing_type: 'episode', item: { type: 'episode', id: 'e1', name: 'Ep', duration_ms: 1000, show: { name: 'Show' } } }, 0);
    expect(ep).toMatchObject({ mediaType: 'episode' });
    expect(ep.track?.key).toBe('episode:e1');
    expect(mapCurrentlyPlaying({ is_playing: true, progress_ms: 0, currently_playing_type: 'unknown', item: null }, 0).mediaType).toBe('unknown');
  });
  it('gives local files a stable derived key', () => {
    const local = { ...trackItem, id: null, is_local: true };
    const a = mapCurrentlyPlaying({ is_playing: true, progress_ms: 0, currently_playing_type: 'track', item: local }, 0);
    expect(a.track?.id).toBeNull();
    expect(a.track?.key.startsWith('local:')).toBe(true);
    expect(a.track?.isLocal).toBe(true);
  });
  it('picks a sensible artwork', () => {
    expect(pickArtwork(undefined)).toBeNull();
    expect(pickArtwork([{ url: 'only', width: 64 }])).toBe('only');
  });
});

describe('polling schedule', () => {
  const base: PlaybackState = { status: 'playing', mediaType: 'track', track: null, progressMs: 0, sampledAt: 0, durationMs: 200_000 };
  it('uses slower intervals when paused or idle', () => {
    expect(nextPollDelay({ ...base, status: 'paused' }, 0)).toBe(POLL_INTERVALS.paused);
    expect(nextPollDelay({ ...base, status: 'idle' }, 0)).toBe(POLL_INTERVALS.idle);
    expect(nextPollDelay(base, 0)).toBe(POLL_INTERVALS.playing);
  });
  it('polls right after the track ends so the next song is noticed quickly', () => {
    const d = nextPollDelay({ ...base, progressMs: 199_000 }, 0);
    expect(d).toBeLessThan(POLL_INTERVALS.playing);
    expect(d).toBeGreaterThan(1000);
  });
  it('backs off exponentially with a ceiling', () => {
    expect([1, 2, 3, 4, 10].map(backoffDelay)).toEqual([2000, 4000, 8000, 16_000, 30_000]);
  });
});

describe('auth failure classification', () => {
  it('treats invalid_grant style responses as permanent, transient ones as retryable', () => {
    expect(isPermanentAuthFailure(new ProviderError('S', 'bad-response', 'x', undefined, { status: 400 }))).toBe(true);
    expect(isPermanentAuthFailure(new ProviderError('S', 'auth', 'x'))).toBe(true);
    expect(isPermanentAuthFailure(new ProviderError('S', 'bad-response', 'x', undefined, { status: 503 }))).toBe(false);
    expect(isPermanentAuthFailure(new ProviderError('S', 'network', 'x'))).toBe(false);
  });
});

const tokenResponse = (over = {}) =>
  new Response(JSON.stringify({ access_token: 'AT1', token_type: 'Bearer', expires_in: 3600, refresh_token: 'RT1', ...over }), { status: 200 });

describe('SpotifyAuth (PKCE, loopback callback, refresh)', () => {
  const redirectUri = 'http://127.0.0.1:38901/callback';

  it('completes the browser flow and stores tokens', async () => {
    const secrets = new MemorySecretStore();
    const requests: URLSearchParams[] = [];
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      requests.push(init?.body as URLSearchParams);
      return tokenResponse();
    }) as unknown as typeof fetch;

    const auth = new SpotifyAuth({
      getClientId: () => 'client123',
      redirectUri,
      secrets,
      fetchImpl,
      // Simulate the browser: approve and follow the redirect back to the loopback server.
      openExternal: async (url) => {
        const u = new URL(url);
        expect(u.searchParams.get('code_challenge_method')).toBe('S256');
        expect(u.searchParams.get('client_id')).toBe('client123');
        expect(u.searchParams.get('scope')).toContain('user-read-currently-playing');
        expect(u.searchParams.get('redirect_uri')).toBe(redirectUri);
        const cb = new URL(redirectUri);
        cb.searchParams.set('code', 'the-code');
        cb.searchParams.set('state', u.searchParams.get('state')!);
        setTimeout(() => void fetch(cb), 20);
      },
    });

    expect(auth.hasSession()).toBe(false);
    await auth.connect();
    expect(auth.hasSession()).toBe(true);
    expect(await auth.getAccessToken()).toBe('AT1');
    const body = requests[0]!;
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')?.length).toBeGreaterThan(40);
    expect(body.has('client_secret')).toBe(false);
    expect(secrets.has('spotify.session')).toBe(true);
  });

  it('rejects a callback with the wrong state', async () => {
    const auth = new SpotifyAuth({
      getClientId: () => 'client123', redirectUri: 'http://127.0.0.1:38902/callback', secrets: new MemorySecretStore(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
      openExternal: async () => {
        const cb = new URL('http://127.0.0.1:38902/callback?code=x&state=WRONG');
        setTimeout(() => void fetch(cb), 20);
      },
    });
    await expect(auth.connect()).rejects.toMatchObject({ code: 'auth' });
  });

  it('reports a declined authorisation', async () => {
    const auth = new SpotifyAuth({
      getClientId: () => 'c', redirectUri: 'http://127.0.0.1:38903/callback', secrets: new MemorySecretStore(),
      fetchImpl: vi.fn() as unknown as typeof fetch,
      openExternal: async () => { setTimeout(() => void fetch('http://127.0.0.1:38903/callback?error=access_denied'), 20); },
    });
    await expect(auth.connect()).rejects.toThrow(/declined/);
  });

  it('requires a client id', async () => {
    const auth = new SpotifyAuth({ getClientId: () => '', redirectUri, secrets: new MemorySecretStore(), openExternal: async () => undefined });
    await expect(auth.connect()).rejects.toMatchObject({ code: 'not-configured' });
  });

  it('refreshes expiring tokens once even for concurrent callers, keeping the refresh token', async () => {
    const secrets = new MemorySecretStore();
    secrets.set('spotify.session', JSON.stringify({ accessToken: 'old', refreshToken: 'RT0', expiresAt: Date.now() + 1000, clientId: 'c' }));
    const fetchImpl = vi.fn(async () => tokenResponse({ access_token: 'new', refresh_token: undefined })) as unknown as typeof fetch;
    const auth = new SpotifyAuth({ getClientId: () => 'c', redirectUri, secrets, fetchImpl, openExternal: async () => undefined });
    const [a, b] = await Promise.all([auth.getAccessToken(), auth.getAccessToken()]);
    expect([a, b]).toEqual(['new', 'new']);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(secrets.get('spotify.session')!).refreshToken).toBe('RT0');
  });

  it('clears the session when the refresh token is revoked, but keeps it on network errors', async () => {
    const seed = () => {
      const secrets = new MemorySecretStore();
      secrets.set('spotify.session', JSON.stringify({ accessToken: 'old', refreshToken: 'RT0', expiresAt: 1, clientId: 'c' }));
      return secrets;
    };
    const revoked = seed();
    const authA = new SpotifyAuth({ getClientId: () => 'c', redirectUri, secrets: revoked, openExternal: async () => undefined,
      fetchImpl: vi.fn(async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as unknown as typeof fetch });
    await expect(authA.getAccessToken()).rejects.toMatchObject({ code: 'auth' });
    expect(authA.hasSession()).toBe(false);
    expect(revoked.has('spotify.session')).toBe(false);

    const flaky = seed();
    const authB = new SpotifyAuth({ getClientId: () => 'c', redirectUri, secrets: flaky, openExternal: async () => undefined,
      fetchImpl: vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch });
    await expect(authB.getAccessToken()).rejects.toMatchObject({ code: 'network' });
    expect(authB.hasSession()).toBe(true);
  });

  it('ignores a stored session that belongs to a different client id', () => {
    const secrets = new MemorySecretStore();
    secrets.set('spotify.session', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 1e6, clientId: 'old' }));
    const auth = new SpotifyAuth({ getClientId: () => 'new', redirectUri, secrets, openExternal: async () => undefined });
    expect(auth.hasSession()).toBe(false);
  });
});
