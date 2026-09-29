import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LyricLine } from '@shared/types/domain';
import { PlaybackSyncEngine, findActiveLineIndex } from '@shared/utils/sync';

const lines: LyricLine[] = [
  { text: 'a', startTimeMs: 1000 },
  { text: 'b', startTimeMs: 5000 },
  { text: 'c', startTimeMs: 9000 },
  { text: 'd', startTimeMs: 20_000 },
];

describe('active lyric line calculation', () => {
  it('is -1 before the first line', () => {
    expect(findActiveLineIndex(lines, 0)).toBe(-1);
    expect(findActiveLineIndex(lines, 999)).toBe(-1);
  });
  it('picks the last line that has started', () => {
    expect(findActiveLineIndex(lines, 1000)).toBe(0);
    expect(findActiveLineIndex(lines, 4999)).toBe(0);
    expect(findActiveLineIndex(lines, 5000)).toBe(1);
    expect(findActiveLineIndex(lines, 15_000)).toBe(2);
    expect(findActiveLineIndex(lines, 999_999)).toBe(3);
  });
  it('handles empty and untimed input', () => {
    expect(findActiveLineIndex([], 5000)).toBe(-1);
    expect(findActiveLineIndex([{ text: 'x' }], 5000)).toBe(-1);
  });
});

describe('PlaybackSyncEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });
  afterEach(() => vi.useRealTimers());

  const make = () => {
    const engine = new PlaybackSyncEngine();
    engine.setLines('t1', lines);
    return engine;
  };
  const sample = (over: Partial<Parameters<PlaybackSyncEngine['reconcile']>[0]> = {}) => ({
    trackKey: 't1',
    progressMs: 0,
    sampledAt: Date.now(),
    playing: true,
    durationMs: 60_000,
    ...over,
  });

  it('advances lines as time passes without new samples', () => {
    const engine = make();
    expect(engine.reconcile(sample())).toBe('init');
    expect(engine.getState().activeIndex).toBe(-1);
    vi.advanceTimersByTime(1100);
    expect(engine.getState().activeIndex).toBe(0);
    vi.advanceTimersByTime(4000);
    expect(engine.getState().activeIndex).toBe(1);
  });

  it('notifies subscribers only when the visible state changes', () => {
    const engine = make();
    const listener = vi.fn();
    engine.subscribe(listener);
    engine.reconcile(sample());
    const initial = listener.mock.calls.length;
    vi.advanceTimersByTime(500); // still before line 0
    expect(listener.mock.calls.length).toBe(initial);
    vi.advanceTimersByTime(600);
    expect(listener.mock.calls.length).toBe(initial + 1);
  });

  it('freezes on pause and continues on resume', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 2000 }));
    vi.advanceTimersByTime(1000);
    expect(engine.reconcile(sample({ progressMs: 3000, playing: false }))).toBe('pause');
    vi.advanceTimersByTime(60_000);
    expect(engine.getPositionMs()).toBe(3000);
    expect(engine.getState().activeIndex).toBe(0);
    expect(engine.reconcile(sample({ progressMs: 3000, playing: true }))).toBe('resume');
    vi.advanceTimersByTime(2100);
    expect(engine.getState().activeIndex).toBe(1);
  });

  it('detects seeking forward and backward', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 0 }));
    vi.advanceTimersByTime(1000);
    expect(engine.reconcile(sample({ progressMs: 10_000 }))).toBe('seek');
    expect(engine.getState().activeIndex).toBe(2);
    expect(engine.reconcile(sample({ progressMs: 2000 }))).toBe('seek');
    expect(engine.getState().activeIndex).toBe(0);
  });

  it('ignores small API latency jitter but corrects real drift', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 2000 }));
    vi.advanceTimersByTime(2000);
    // Spotify reports 150ms different from our clock: within tolerance, keep the anchor.
    expect(engine.reconcile(sample({ progressMs: 4150 }))).toBe('steady');
    vi.advanceTimersByTime(2000);
    // 600ms drift: corrected, not a seek.
    expect(engine.reconcile(sample({ progressMs: 6000 - 600 }))).toBe('drift-corrected');
  });

  it('resets on track change and does not show the previous track lines', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 10_000 }));
    expect(engine.getState().activeIndex).toBe(2);
    expect(engine.reconcile(sample({ trackKey: 't2', progressMs: 0 }))).toBe('track-change');
    // Lyrics are still for t1, so nothing is active for t2.
    expect(engine.getState().activeIndex).toBe(-1);
    engine.setLines('t2', [{ text: 'x', startTimeMs: 0 }]);
    expect(engine.getState().activeIndex).toBe(0);
  });

  it('applies the sync offset', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 4500 }));
    expect(engine.getState().activeIndex).toBe(0);
    engine.setOffset(-600); // lyrics earlier
    expect(engine.getState().activeIndex).toBe(1);
  });

  it('clamps to the track duration', () => {
    const engine = make();
    engine.reconcile(sample({ progressMs: 59_000, durationMs: 60_000 }));
    vi.advanceTimersByTime(10_000);
    expect(engine.getPositionMs()).toBe(60_000);
  });

  it('stops all timers when destroyed', () => {
    const engine = make();
    engine.reconcile(sample());
    engine.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
