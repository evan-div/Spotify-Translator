import type { WordDefinition } from '@shared/types/library';
import type { LookupState } from '../hooks/useWordLookup';
import { Icon } from './Icon';

interface Props {
  lookup: LookupState;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

const SOURCE_LABEL: Record<WordDefinition['source'], string> = {
  wiktionary: 'Wiktionary',
  machine: 'Machine translation',
  demo: 'Demo dictionary',
};

function Body({ lookup }: { lookup: LookupState }) {
  const { result } = lookup;
  if (!result) return <div className="sheet__status sheet__status--loading">Looking up…</div>;
  if (result.status === 'error') return <div className="sheet__status">{result.message}</div>;
  if (result.status === 'not-found') {
    return <div className="sheet__status">No definition found for “{lookup.word}”. It may be slang or a name.</div>;
  }
  const { definition } = result;
  return (
    <>
      {definition.lemma && (
        <div className="sheet__form">
          <span className="sheet__arrow">→</span> {definition.lemma}
          {definition.formNote && <span className="sheet__note"> · {definition.formNote}</span>}
        </div>
      )}
      <ol className="sheet__senses">
        {definition.senses.slice(0, 3).map((sense, i) => (
          <li key={i}>
            {sense.partOfSpeech && <span className="sheet__pos">{sense.partOfSpeech}</span>}
            <span>{sense.meanings.slice(0, 3).join('; ')}</span>
          </li>
        ))}
      </ol>
      <div className="sheet__source">
        {SOURCE_LABEL[definition.source]}
        {definition.source === 'machine' && ' · approximate'}
      </div>
    </>
  );
}

/** Definition card that slides up over the lyrics when a word is tapped. */
export function WordSheet({ lookup, saved, onToggleSave, onClose }: Props) {
  const canSave = lookup.result !== null;
  return (
    <aside className="sheet" data-nodrag role="dialog" aria-label={`Definition of ${lookup.word}`}>
      <div className="sheet__head">
        <div className="sheet__word">{lookup.word}</div>
        <div className="sheet__actions">
          <button
            type="button"
            className="tool"
            data-active={saved}
            aria-pressed={saved}
            disabled={!canSave}
            title={saved ? 'Saved to vocabulary (click to remove)' : 'Save to vocabulary'}
            onClick={onToggleSave}
          >
            <Icon name="star" fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="tool" title="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>
      <Body lookup={lookup} />
    </aside>
  );
}
