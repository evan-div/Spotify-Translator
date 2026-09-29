import { describe, expect, it } from 'vitest';
import type { PlaybackState, SpotifyTrack } from '@shared/types/domain';
import { detectTrackChange, playbackIdentity } from '@shared/utils/trackChange';

const track = (key: string): SpotifyTrack => ({
  id: key, key, title: key, artists: ['A'], album: '', artworkUrl: null, durationMs: 1000, isLocal: false,
});
const state = (over: Partial<PlaybackState>): PlaybackState => ({
  status: 'playing', mediaType: 'track', track: track('x'), progressMs: 0, sampledAt: 0, durationMs: 1000, ...over,
});

describe('Spotify track change detection', () => {
  it('flags the first track', () => {
    expect(detectTrackChange(null, state({}))).toEqual({ changed: true, from: null, to: 'track:x' });
  });
  it('does not fire for progress, pause or resume on the same track', () => {
    const id = playbackIdentity(state({}));
    expect(detectTrackChange(id, state({ progressMs: 500 })).changed).toBe(false);
    expect(detectTrackChange(id, state({ status: 'paused' })).changed).toBe(false);
  });
  it('fires when the track ID changes', () => {
    expect(detectTrackChange('track:x', state({ track: track('y') })).changed).toBe(true);
  });
  it('treats ads and episodes as their own identities', () => {
    expect(playbackIdentity(state({ mediaType: 'ad', track: null }))).toBe('ad');
    expect(playbackIdentity(state({ mediaType: 'episode', track: track('episode:e1') }))).toBe('episode:episode:e1');
    expect(detectTrackChange('track:x', state({ mediaType: 'ad', track: null })).changed).toBe(true);
  });
  it('goes null when nothing is playing, and back', () => {
    expect(playbackIdentity(state({ status: 'idle', track: null }))).toBeNull();
    expect(detectTrackChange('track:x', state({ status: 'idle', track: null }))).toEqual({ changed: true, from: 'track:x', to: null });
    expect(detectTrackChange(null, state({ status: 'idle', track: null })).changed).toBe(false);
  });
  it('a repeated identical track is not a change (repeat/seek is handled by the sync engine)', () => {
    expect(detectTrackChange('track:x', state({ progressMs: 0 })).changed).toBe(false);
  });
});
