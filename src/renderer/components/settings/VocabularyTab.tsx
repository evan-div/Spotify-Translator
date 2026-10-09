import { useMemo, useState } from 'react';
import type { VocabularyEntry } from '@shared/types/library';
import { formatRelativeTime, vocabularyToCsv } from '@shared/utils/csv';
import { LANGUAGE_BADGE } from '@shared/constants/languages';
import { Icon } from '../Icon';
import { useAppSelector } from '../../hooks/useAppState';
import { Button, Group } from './controls';

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const matches = (entry: VocabularyEntry, query: string): boolean =>
  [entry.word, entry.lemma ?? '', entry.meaning, entry.language].some((field) => field.toLowerCase().includes(query));

function WordRow({ entry }: { entry: VocabularyEntry }) {
  const context = entry.contexts[0];
  return (
    <div className="item">
      <div className="item__main">
        <div className="item__title">
          {entry.word}
          {entry.lemma && <span className="item__lemma"> → {entry.lemma}</span>}
          {entry.partOfSpeech && <span className="chip">{entry.partOfSpeech}</span>}
          <span className="chip">{LANGUAGE_BADGE[entry.language]}</span>
        </div>
        <div className="item__meaning">
          {entry.meaning || <span className="text-faint">No definition saved</span>}
          {entry.meaning && entry.source === 'machine' && <span className="text-faint"> (approximate)</span>}
        </div>
        {context && (
          <div className="item__context">
            “{context.line}”
            <span className="text-faint"> · {context.title}{context.artist ? `, ${context.artist}` : ''}</span>
          </div>
        )}
      </div>
      <div className="item__side">
        <span className="text-faint">{formatRelativeTime(entry.savedAt)}</span>
        <button type="button" className="icon-button" title="Remove word" aria-label={`Remove ${entry.word}`} onClick={() => void window.lyricLens.library.removeWord(entry.id)}>
          <Icon name="trash" size={15} />
        </button>
      </div>
    </div>
  );
}

export function VocabularyTab() {
  const vocabulary = useAppSelector((s) => s.library.vocabulary);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? vocabulary.filter((e) => matches(e, q)) : vocabulary;
  }, [vocabulary, query]);

  if (vocabulary.length === 0) {
    return (
      <div className="tab-empty">
        <div className="tab-empty__icon"><Icon name="book" size={22} /></div>
        <h2>No saved words yet</h2>
        <p>While a song plays, tap any word in the overlay to see what it means, then tap the star to save it here.</p>
      </div>
    );
  }
  return (
    <>
      <div className="toolbar-row">
        <input className="input" type="search" placeholder={`Search ${vocabulary.length} words`} aria-label="Search vocabulary" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button onClick={() => download('lyric-lens-vocabulary.csv', vocabularyToCsv(vocabulary))}>Export CSV</Button>
      </div>
      <Group footer="Export as CSV to import into Anki, Quizlet or a spreadsheet.">
        {visible.length === 0 ? <div className="row"><span className="text-faint">No words match “{query}”.</span></div> : visible.map((entry) => <WordRow key={entry.id} entry={entry} />)}
      </Group>
    </>
  );
}
