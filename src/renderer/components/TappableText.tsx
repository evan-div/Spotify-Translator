import { memo, useMemo } from 'react';
import type { LineLanguage, SourceLanguageCode } from '@shared/types/domain';
import { normalizeWord, segmentText, vocabularyId } from '@shared/utils/words';

export interface TapConfig {
  /** Language assumed for lines whose own language is unknown (e.g. a short line in a French song). */
  fallbackLanguage: SourceLanguageCode;
  /** Vocabulary ids ("es:querer") of saved words, drawn with a subtle underline. */
  saved: ReadonlySet<string>;
  /** Called with the tapped word and the lyric line (and its translation) it was tapped in. */
  onTap: (word: string, line: string, translation: string | null, language: SourceLanguageCode) => void;
}

interface Props {
  text: string;
  /** The full original line, and its translation, reported with every tap. */
  line: string;
  translation: string | null;
  /** The line's detected language. */
  language?: LineLanguage;
  /** null = render plain text (translation lines, English lines, taps disabled). */
  tap: TapConfig | null;
}

/** Renders a lyric line with each word tappable for its definition. */
export const TappableText = memo(function TappableText({ text, line, translation, language, tap }: Props) {
  const segments = useMemo(() => (tap ? segmentText(text) : []), [text, tap]);
  if (!tap) return <>{text}</>;
  const lang: SourceLanguageCode = language === 'es' || language === 'fr' ? language : tap.fallbackLanguage;
  return (
    <>
      {segments.map((segment, i) => {
        if (!segment.isWord) return segment.text;
        const id = normalizeWord(segment.text);
        const saved = id !== null && tap.saved.has(vocabularyId(lang, id));
        return (
          <span key={i} className={saved ? 'word word--saved' : 'word'} onClick={() => tap.onTap(segment.text, line, translation, lang)}>
            {segment.text}
          </span>
        );
      })}
    </>
  );
});
