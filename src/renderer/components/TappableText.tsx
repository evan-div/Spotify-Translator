import { memo, useMemo } from 'react';
import { normalizeWord, segmentText } from '@shared/utils/words';

export interface TapConfig {
  /** Normalised ids of words the user has saved (drawn with a subtle underline). */
  saved: ReadonlySet<string>;
  /** Called with the tapped word and the lyric line (and its translation) it was tapped in. */
  onTap: (word: string, line: string, translation: string | null) => void;
}

interface Props {
  text: string;
  /** The full original line, and its translation, reported with every tap. */
  line: string;
  translation: string | null;
  /** null = render plain text (translation lines, English lines, taps disabled). */
  tap: TapConfig | null;
}

/** Renders a lyric line with each word tappable for its definition. */
export const TappableText = memo(function TappableText({ text, line, translation, tap }: Props) {
  const segments = useMemo(() => (tap ? segmentText(text) : []), [text, tap]);
  if (!tap) return <>{text}</>;
  return (
    <>
      {segments.map((segment, i) => {
        if (!segment.isWord) return segment.text;
        const id = normalizeWord(segment.text);
        const saved = id !== null && tap.saved.has(id);
        return (
          <span key={i} className={saved ? 'word word--saved' : 'word'} onClick={() => tap.onTap(segment.text, line, translation)}>
            {segment.text}
          </span>
        );
      })}
    </>
  );
});
