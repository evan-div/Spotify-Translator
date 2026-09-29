import type { LyricLine } from '../types/domain';

/**
 * Timing engine for synchronised lyrics. Deliberately free of React / Electron so it is
 * unit-testable and reusable (e.g. a future karaoke window).
 *
 * The engine keeps a local playback clock anchored on the most recent Spotify sample and
 * reconciles it every time a new sample arrives, so it tolerates pauses, seeks, skips and
 * API latency without assuming that playback is uninterrupted.
 */

export interface SyncSample {
  trackKey: string;
  progressMs: number;
  /** Epoch ms at which progressMs was true. */
  sampledAt: number;
  playing: boolean;
  durationMs: number;
}

export type ReconcileKind =
  | 'init'
  | 'steady'
  | 'drift-corrected'
  | 'seek'
  | 'pause'
  | 'resume'
  | 'track-change';

export interface SyncState {
  trackKey: string | null;
  activeIndex: number;
  playing: boolean;
}

export interface SyncEngineOptions {
  now?: () => number;
  /** Differences below this are ignored (avoids jitter from API latency). */
  driftToleranceMs?: number;
  /** Differences above this are treated as a seek. */
  seekThresholdMs?: number;
}

/** Index of the last line whose start time is <= positionMs, or -1 when before the first line. */
export function findActiveLineIndex(lines: readonly LyricLine[], positionMs: number): number {
  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const start = lines[mid]?.startTimeMs;
    if (start === undefined) return -1;
    if (start <= positionMs) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
}

const MAX_TIMER_MS = 2000;
const TIMER_SLACK_MS = 8;

export class PlaybackSyncEngine {
  private readonly now: () => number;
  private readonly driftToleranceMs: number;
  private readonly seekThresholdMs: number;

  private lines: readonly LyricLine[] = [];
  private lyricsTrackKey: string | null = null;
  private offsetMs = 0;
  private anchor: SyncSample | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<() => void>();
  private state: SyncState = { trackKey: null, activeIndex: -1, playing: false };

  constructor(options: SyncEngineOptions = {}) {
    this.now = options.now ?? Date.now;
    this.driftToleranceMs = options.driftToleranceMs ?? 250;
    this.seekThresholdMs = options.seekThresholdMs ?? 1500;
  }

  /** Stable snapshot for useSyncExternalStore; only replaced when something visible changes. */
  getState = (): SyncState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  setLines(trackKey: string | null, lines: readonly LyricLine[]): void {
    this.lyricsTrackKey = trackKey;
    this.lines = lines;
    this.refresh();
  }

  setOffset(offsetMs: number): void {
    this.offsetMs = offsetMs;
    this.refresh();
  }

  /** Estimated playback position (ms) at `at`, from the local clock. */
  getPositionMs(at: number = this.now()): number {
    const a = this.anchor;
    if (!a) return 0;
    const elapsed = a.playing ? Math.max(0, at - a.sampledAt) : 0;
    const position = a.progressMs + elapsed;
    return a.durationMs > 0 ? Math.min(position, a.durationMs) : position;
  }

  /** Feed a fresh playback sample from Spotify. Returns how it related to the local clock. */
  reconcile(sample: SyncSample): ReconcileKind {
    const previous = this.anchor;
    let kind: ReconcileKind;

    if (!previous) {
      kind = 'init';
    } else if (previous.trackKey !== sample.trackKey) {
      kind = 'track-change';
    } else if (previous.playing !== sample.playing) {
      kind = sample.playing ? 'resume' : 'pause';
    } else {
      const expected = this.getPositionMs(sample.sampledAt);
      const delta = Math.abs(sample.progressMs - expected);
      if (!sample.playing) {
        kind = delta > this.seekThresholdMs ? 'seek' : delta > 1 ? 'drift-corrected' : 'steady';
      } else if (delta > this.seekThresholdMs) kind = 'seek';
      else if (delta > this.driftToleranceMs) kind = 'drift-corrected';
      else kind = 'steady';
    }

    // Within tolerance we keep the existing anchor so the visible clock doesn't jitter.
    if (kind !== 'steady' || !previous) this.anchor = { ...sample };
    this.refresh();
    return kind;
  }

  clear(): void {
    this.anchor = null;
    this.refresh();
  }

  destroy(): void {
    this.stopTimer();
    this.listeners.clear();
  }

  private lookupPosition(): number {
    return this.getPositionMs() - this.offsetMs;
  }

  private computeIndex(): number {
    const a = this.anchor;
    if (!a || this.lines.length === 0 || this.lyricsTrackKey !== a.trackKey) return -1;
    return findActiveLineIndex(this.lines, this.lookupPosition());
  }

  private refresh(): void {
    const a = this.anchor;
    const next: SyncState = {
      trackKey: a?.trackKey ?? null,
      activeIndex: this.computeIndex(),
      playing: a?.playing ?? false,
    };
    const prev = this.state;
    if (prev.trackKey !== next.trackKey || prev.activeIndex !== next.activeIndex || prev.playing !== next.playing) {
      this.state = next;
      this.listeners.forEach((l) => l());
    }
    this.schedule();
  }

  private stopTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  /** Wake up right when the next line starts (bounded, so seeks/pauses are picked up quickly). */
  private schedule(): void {
    this.stopTimer();
    const a = this.anchor;
    if (!a || !a.playing || this.lines.length === 0 || this.lyricsTrackKey !== a.trackKey) return;
    const nextLine = this.lines[this.state.activeIndex + 1];
    const nextStart = nextLine?.startTimeMs;
    if (nextStart === undefined) return;
    const wait = nextStart - this.lookupPosition() + TIMER_SLACK_MS;
    this.timer = setTimeout(() => this.refresh(), Math.min(MAX_TIMER_MS, Math.max(TIMER_SLACK_MS, wait)));
  }
}
