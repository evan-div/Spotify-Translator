import { useEffect, useMemo, useRef, useState } from 'react';
import type { LyricsView } from '@shared/types/domain';
import type { HistoryEntry } from '@shared/types/library';
import { formatRelativeTime } from '@shared/utils/csv';
import { Icon } from '../Icon';
import { useAppSelector } from '../../hooks/useAppState';
import { Group, Segmented } from './controls';

const LANGUAGE_LABEL: Record<HistoryEntry['language'], string> = {
  spanish: 'Spanish',
  english: 'English',
  mixed: 'Mixed',
  other: 'Other',
  unknown: '',
};

function Artwork({ url }: { url: string | null }) {
  return url ? <img className="art" src={url} alt="" /> : <div className="art art--empty"><Icon name="music" size={16} /></div>;
}

function SongLyrics({ trackKey }: { trackKey: string }) {
  const [view, setView] = useState<LyricsView | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    void window.lyricLens.library.getSong(trackKey).then((v) => !cancelled && setView(v));
    return () => {
      cancelled = true;
    };
  }, [trackKey]);

  if (view === undefined) return <div className="song-lyrics text-faint">Loading…</div>;
  if (view === null) return <div className="song-lyrics text-faint">These lyrics are no longer cached. Play the song again to fetch them.</div>;
  return (
    <div className="song-lyrics">
      {view.lines.map((line, i) =>
        line.text.trim() === '' ? (
          <div className="song-lyrics__break" key={i} />
        ) : (
          <div className="song-lyrics__pair" key={i}>
            <div>{line.text}</div>
            {line.translation && <div className="song-lyrics__translation">{line.translation}</div>}
          </div>
        ),
      )}
    </div>
  );
}

function SongRow({ entry, open, onToggle }: { entry: HistoryEntry; open: boolean; onToggle: () => void }) {
  return (
    <div className={`item item--song${open ? ' item--open' : ''}`}>
      <div className="item__row">
        <button type="button" className="item__hit" onClick={onToggle} aria-expanded={open}>
          <Artwork url={entry.artworkUrl} />
          <div className="item__main">
            <div className="item__title">{entry.title}</div>
            <div className="item__meaning">{entry.artists.join(', ')}</div>
            <div className="item__meta">
              {LANGUAGE_LABEL[entry.language] && <span className="chip">{LANGUAGE_LABEL[entry.language]}</span>}
              {entry.translated && <span className="chip chip--accent">Translated</span>}
              <span className="text-faint">
                {entry.playCount > 0 ? `Played ${entry.playCount}× · ${formatRelativeTime(entry.lastPlayedAt)}` : 'Favorited'}
              </span>
            </div>
          </div>
        </button>
        <div className="item__side">
          <button
            type="button"
            className={`icon-button icon-button--star${entry.favorite ? ' is-on' : ''}`}
            aria-pressed={entry.favorite}
            title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
            onClick={() => void window.lyricLens.library.setFavorite(entry.trackKey, !entry.favorite)}
          >
            <Icon name="star" size={16} fill={entry.favorite ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className="icon-button" title="Remove from history" aria-label={`Remove ${entry.title}`} onClick={() => void window.lyricLens.library.removeHistory(entry.trackKey)}>
            <Icon name="trash" size={15} />
          </button>
        </div>
      </div>
      {open && <SongLyrics trackKey={entry.trackKey} />}
    </div>
  );
}

export function HistoryTab() {
  const history = useAppSelector((s) => s.library.history);
  const recording = useAppSelector((s) => s.settings.library.recordHistory);
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const favorites = history.filter((h) => h.favorite).length;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history
      .filter((h) => filter === 'all' || h.favorite)
      .filter((h) => !q || `${h.title} ${h.artists.join(' ')}`.toLowerCase().includes(q));
  }, [history, filter, query]);

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 3500);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    void window.lyricLens.library.clearHistory();
  };

  if (history.length === 0) {
    return (
      <div className="tab-empty">
        <div className="tab-empty__icon"><Icon name="music" size={22} /></div>
        <h2>No songs yet</h2>
        <p>{recording ? 'Songs you listen to with lyrics show up here, so you can read them again or mark favorites. Hover the overlay and tap the star to favorite the current song.' : 'History is turned off. Turn it on in Settings → Behavior.'}</p>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar-row">
        <input className="input" type="search" placeholder={`Search ${history.length} songs`} aria-label="Search history" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Segmented
          value={filter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'favorites', label: `Favorites${favorites ? ` ${favorites}` : ''}` },
          ]}
          onChange={setFilter}
        />
      </div>
      <Group
        footer={
          <>
            Stored only on this Mac. Favorites are kept when you clear history.{' '}
            {history.some((h) => !h.favorite) && (
              <button type="button" className="link link--plain" onClick={clear}>
                {confirming ? 'Click again to confirm' : 'Clear history'}
              </button>
            )}
          </>
        }
      >
        {visible.length === 0 ? (
          <div className="row"><span className="text-faint">{filter === 'favorites' && !query ? 'No favorites yet. Tap the star on a song.' : 'No songs match.'}</span></div>
        ) : (
          visible.map((entry) => <SongRow key={entry.trackKey} entry={entry} open={openKey === entry.trackKey} onToggle={() => setOpenKey(openKey === entry.trackKey ? null : entry.trackKey)} />)
        )}
      </Group>
    </>
  );
}

