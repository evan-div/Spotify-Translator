import { memo } from 'react';
import { partsForLine, type DisplayModeSetting } from '../hooks/overlayContent';

export type LineState = 'active' | 'near' | 'far';

interface Props {
  text: string;
  translation: string | null;
  state: LineState;
  direction: 'past' | 'future' | 'current';
  mode: DisplayModeSetting;
  /** Show a shimmer placeholder for the translation (active line only). */
  pending: boolean;
  blank: boolean;
}

/** One lyric line (original + optional translation). Memoised: only re-renders when its own state changes. */
export const LyricLine = memo(function LyricLine({ text, translation, state, direction, mode, pending, blank }: Props) {
  if (blank) {
    return (
      <div className="line line--gap" data-state={state} data-dir={direction} aria-hidden={state !== 'active'}>
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }
  const { primary, secondary } = partsForLine(text, translation, mode);
  return (
    <div className="line" data-state={state} data-dir={direction}>
      <div className="line__primary">{primary}</div>
      {secondary && <div className="line__secondary">{secondary}</div>}
      {!secondary && pending && state === 'active' && mode === 'both' && (
        <div className="line__secondary line__secondary--pending" aria-label="Translating">
          Translating…
        </div>
      )}
    </div>
  );
});
