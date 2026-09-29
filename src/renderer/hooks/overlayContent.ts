import type { LyricsState, LyricsView, PlaybackState, SpotifyConnectionState } from '@shared/types/domain';

export type EmptyIcon = 'music' | 'pause' | 'spotify' | 'search' | 'alert' | 'mic' | 'globe';

export type OverlayContent =
  | { kind: 'empty'; icon: EmptyIcon; title: string; message: string; action?: 'connect' | 'settings' | 'retry' }
  | { kind: 'loading'; message: string }
  | { kind: 'lyrics'; view: LyricsView; translating: boolean };

interface Inputs {
  connection: SpotifyConnectionState;
  playback: PlaybackState;
  lyrics: LyricsState;
  demo: boolean;
}

/** Pure mapping from app state to what the overlay body shows. All the "empty state" copy lives here. */
export function resolveOverlayContent({ connection, playback, lyrics, demo }: Inputs): OverlayContent {
  if (!demo && connection.status !== 'connected') {
    if (connection.status === 'connecting') {
      return { kind: 'loading', message: 'Waiting for Spotify sign-in…' };
    }
    return connection.needsReconnect
      ? {
          kind: 'empty',
          icon: 'spotify',
          title: 'Spotify disconnected',
          message: 'Your session expired. Reconnect Spotify from the menu bar.',
          action: 'connect',
        }
      : {
          kind: 'empty',
          icon: 'spotify',
          title: 'Connect Spotify',
          message: 'Reconnect Spotify from the menu bar, or open Settings to get started.',
          action: 'connect',
        };
  }

  if (playback.status === 'idle') {
    return { kind: 'empty', icon: 'music', title: 'Nothing is playing', message: 'Open Spotify and start a song.' };
  }
  if (playback.mediaType === 'ad') {
    return { kind: 'empty', icon: 'music', title: 'Ad playing', message: 'Lyrics will return when your music does.' };
  }
  if (playback.mediaType === 'episode') {
    return { kind: 'empty', icon: 'mic', title: 'Podcast playing', message: "Lyrics aren't available for podcasts." };
  }

  const currentKey = playback.track?.key ?? null;
  // Never show lyrics that belong to a different song than the one playing right now.
  if (lyrics.status === 'idle' || (lyrics.status !== 'unsupported' && lyrics.trackKey !== currentKey)) {
    return { kind: 'loading', message: 'Loading lyrics…' };
  }

  switch (lyrics.status) {
    case 'loading-lyrics':
      return { kind: 'loading', message: 'Loading lyrics…' };
    case 'translating':
      return { kind: 'lyrics', view: lyrics.view, translating: true };
    case 'ready':
      return { kind: 'lyrics', view: lyrics.view, translating: false };
    case 'not-found':
      return { kind: 'empty', icon: 'search', title: 'No lyrics found', message: "Lyrics weren't available for this track." };
    case 'error':
      return { kind: 'empty', icon: 'alert', title: "Couldn't load lyrics", message: lyrics.message, action: 'retry' };
    case 'unsupported':
      return { kind: 'empty', icon: 'music', title: 'No lyrics here', message: 'This kind of audio has no lyrics.' };
    default:
      return { kind: 'loading', message: 'Loading lyrics…' };
  }
}

export interface LineParts {
  primary: string;
  secondary: string | null;
}

export type DisplayModeSetting = 'both' | 'translation' | 'original';

/** Which strings to show for a line under the chosen display mode. */
export function partsForLine(text: string, translation: string | null, mode: DisplayModeSetting): LineParts {
  if (mode === 'original') return { primary: text, secondary: null };
  if (mode === 'translation') return { primary: translation ?? text, secondary: null };
  return { primary: text, secondary: translation };
}

/** Position of each line among non-blank lines, and which lines are blank (instrumental gaps). */
export function rankLines(lines: ReadonlyArray<{ text: string }>): { ranks: number[]; blank: boolean[] } {
  let counter = -1;
  const blank = lines.map((l) => l.text.trim() === '');
  const ranks = lines.map((_, i) => {
    if (!blank[i]) counter += 1;
    return counter;
  });
  return { ranks, blank };
}

/** Focus position in "non-blank line" units: whole numbers for lyrics, halves for gaps/intro. */
export function focusRank(ranks: readonly number[], blank: readonly boolean[], activeIndex: number): number {
  if (activeIndex < 0) return -0.5;
  const rank = ranks[activeIndex] ?? 0;
  return blank[activeIndex] ? rank + 0.5 : rank;
}
