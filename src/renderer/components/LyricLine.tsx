import { memo } from 'react';
import type { LineLanguage } from '@shared/types/domain';
import { partsForLine, type DisplayModeSetting } from '../hooks/overlayContent';
import { TappableText, type TapConfig } from './TappableText';

export type LineState = 'active' | 'near' | 'far';

interface Props {
  text: string;
  translation: string | null;
  language?: LineLanguage;
  state: LineState;
  direction: 'past' | 'future' | 'current';
  mode: DisplayModeSetting;
  /** Show a shimmer placeholder for the translation (active line only). */
  pending: boolean;
  blank: boolean;
  /** Word tapping; only offered on visible, non-English lines that show the original text. */
  tap: TapConfig | null;
}

/** One lyric line (original + optional translation). Memoised: only re-renders when its own state changes. */
export const LyricLine = memo(function LyricLine({ text, translation, language, state, direction, mode, pending, blank, tap }: Props) {
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
  const showsOriginal = mode !== 'translation' || translation === null;
  const lineTap = tap && showsOriginal && language !== 'en' && state !== 'far' ? tap : null;
  return (
    <div className="line" data-state={state} data-dir={direction}>
      <div className="line__primary">
        <TappableText text={primary} line={text} translation={translation} language={language} tap={lineTap} />
      </div>
      {secondary && <div className="line__secondary">{secondary}</div>}
      {!secondary && pending && state === 'active' && mode === 'both' && (
        <div className="line__secondary line__secondary--pending" aria-label="Translating">
          Translating…
        </div>
      )}
    </div>
  );
});
