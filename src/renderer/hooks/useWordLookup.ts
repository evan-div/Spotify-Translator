import { useCallback, useEffect, useRef, useState } from 'react';
import type { WordLookupResult } from '@shared/types/library';
import { normalizeWord } from '@shared/utils/words';

export interface LookupState {
  /** Word as tapped (display form). */
  word: string;
  /** Normalised id; matches vocabulary entry ids. */
  id: string;
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

  const open = useCallback((word: string, line: string, translation: string | null) => {
    const id = normalizeWord(word);
    if (!id) return;
    const current = ++requestId.current;
    setLookup({ word, id, line, translation, result: null });
    void window.lyricLens.library.lookupWord({ word, line, translation }).then((result) => {
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
