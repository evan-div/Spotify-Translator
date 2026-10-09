import { useCallback, useEffect, useRef, useState } from 'react';
import type { WordLookupResult } from '@shared/types/library';
import type { SourceLanguageCode } from '@shared/types/domain';
import { normalizeWord, vocabularyId } from '@shared/utils/words';

export interface LookupState {
  /** Word as tapped (display form). */
  word: string;
  /** Vocabulary id ("es:querer"); matches vocabulary entry ids. */
  id: string;
  language: SourceLanguageCode;
  line: string;
  translation: string | null;
  result: WordLookupResult | null;
}

/** Tap-a-word state: opens a lookup, ignores stale answers, and closes when the song changes. */
export function useWordLookup(trackKey: string | null) {
  const [lookup, setLookup] = useState<LookupState | null>(null);
  const requestId = useRef(0);

  const close = useCallback(() => {
    requestId.current += 1;
    setLookup(null);
  }, []);

  const open = useCallback((word: string, line: string, translation: string | null, language: SourceLanguageCode) => {
    const normalized = normalizeWord(word);
    if (!normalized) return;
    const id = vocabularyId(language, normalized);
    const current = ++requestId.current;
    setLookup({ word, id, language, line, translation, result: null });
    void window.lyricLens.library.lookupWord({ word, line, translation, language }).then((result) => {
      if (requestId.current === current) setLookup((s) => (s && s.id === id ? { ...s, result } : s));
    });
  }, []);

  // A different song must never leave the previous song's word card on screen.
  useEffect(() => {
    requestId.current += 1;
    setLookup(null);
  }, [trackKey]);

  return { lookup, open, close };
}
