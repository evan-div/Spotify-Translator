import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { LyricsView } from '@shared/types/domain';
import { focusRank, rankLines, type DisplayModeSetting } from '../hooks/overlayContent';
import { LyricLine, type LineState } from './LyricLine';
import type { TapConfig } from './TappableText';

interface Props {
  view: LyricsView;
  activeIndex: number;
  mode: DisplayModeSetting;
  showContext: boolean;
  translating: boolean;
  fontSize: number;
  tap: TapConfig | null;
}

/**
 * Apple-Music style lyric scroller: every line is in the DOM, the list is translated so the active
 * line sits at the vertical centre, and distance from the active line drives opacity/scale.
 */
export function SyncedLyrics({ view, activeIndex, mode, showContext, translating, fontSize, tap }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const { ranks, blank } = useMemo(() => rankLines(view.lines), [view.lines]);
  const focus = focusRank(ranks, blank, activeIndex);

  useLayoutEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setViewportHeight(node.clientHeight));
    observer.observe(node);
    setViewportHeight(node.clientHeight);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const target = activeRef.current ?? firstRef.current;
    if (!target || viewportHeight === 0) return;
    setOffset(viewportHeight / 2 - (target.offsetTop + target.offsetHeight / 2));
  }, [activeIndex, viewportHeight, fontSize, mode, view, translating]);

  return (
    <div className="synced" ref={viewportRef} data-context={showContext} data-intro={activeIndex < 0}>
      <div className="synced__list" style={{ transform: `translateY(${offset}px)` }}>
        {view.lines.map((line, i) => {
          const isBlank = blank[i] ?? false;
          const isActive = i === activeIndex;
          // Gaps are only drawn while they are the active line.
          if (isBlank && !isActive) return null;
          const distance = Math.abs((ranks[i] ?? 0) - focus);
          const state: LineState = isActive ? 'active' : distance <= 1 ? 'near' : 'far';
          const direction = isActive ? 'current' : (ranks[i] ?? 0) < focus ? 'past' : 'future';
          const isFirst = i === view.lines.findIndex((l) => l.text.trim() !== '');
          return (
            <div key={i} ref={isActive ? activeRef : isFirst ? firstRef : undefined}>
              <LyricLine
                text={line.text}
                translation={line.translation}
                language={line.language}
                state={state}
                direction={direction}
                mode={mode}
                pending={translating}
                blank={isBlank}
                tap={tap}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
