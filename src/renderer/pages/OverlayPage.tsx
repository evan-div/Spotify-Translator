import { useCallback, useMemo } from 'react';
import type { MouseEvent } from 'react';
import type { SpotifyTrack } from '@shared/types/domain';
import type { OverlaySettings } from '@shared/types/settings';
import { EmptyState } from '../components/EmptyState';
import { OverlayToolbar } from '../components/OverlayToolbar';
import { PlainLyrics } from '../components/PlainLyrics';
import { SyncedLyrics } from '../components/SyncedLyrics';
import { Toast } from '../components/Toast';
import { TrackHeader } from '../components/TrackHeader';
import type { TapConfig } from '../components/TappableText';
import { WordSheet } from '../components/WordSheet';
import { resolveOverlayContent, type OverlayContent } from '../hooks/overlayContent';
import { useAppSelector } from '../hooks/useAppState';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useWordLookup } from '../hooks/useWordLookup';
import { useWindowDrag } from '../hooks/useWindowDrag';

const ACTION_LABEL = { connect: 'Open Settings', settings: 'Open Settings', retry: 'Try again' } as const;

export function OverlayPage() {
  const overlay = useAppSelector((s) => s.settings.overlay);
  const playback = useAppSelector((s) => s.playback);
  const lyrics = useAppSelector((s) => s.lyrics);
  const spotify = useAppSelector((s) => s.spotify);
  const demo = useAppSelector((s) => s.demo);
  const notice = useAppSelector((s) => s.notice);
  const library = useAppSelector((s) => s.library);

  const content = useMemo(
    () => resolveOverlayContent({ connection: spotify, playback, lyrics, demo }),
    [spotify, playback, lyrics, demo],
  );
  const view = content.kind === 'lyrics' ? content.view : null;
  const sync = useSyncEngine(view, playback, overlay.syncOffsetMs);
  const drag = useWindowDrag(!overlay.locked && !overlay.clickThrough);

  const patch = useCallback((p: Partial<OverlaySettings>) => void window.lyricLens.updateSettings({ overlay: p }), []);
  const openSettings = useCallback(() => void window.lyricLens.perform('settings.open'), []);
  const onAction = useCallback(
    (action: 'connect' | 'settings' | 'retry') =>
      void window.lyricLens.perform(action === 'retry' ? 'song.refresh' : 'settings.open'),
    [],
  );

  const paused = playback.status === 'paused';
  const track = playback.mediaType === 'track' ? playback.track : null;

  const { lookup, open: openWord, close: closeWord } = useWordLookup(track?.key ?? null);
  const savedWords = useMemo(() => new Set(library.vocabulary.map((v) => v.id)), [library.vocabulary]);
  const canTap = overlay.tapWords && !overlay.clickThrough && view !== null && view.language !== 'english';
  const tap = useMemo<TapConfig | null>(
    () => (canTap ? { saved: savedWords, fallbackLanguage: view?.sourceLanguage ?? 'es', onTap: openWord } : null),
    [canTap, savedWords, openWord, view?.sourceLanguage],
  );
  const favorite = track ? (library.history.find((h) => h.trackKey === track.key)?.favorite ?? false) : null;
  const toggleFavorite = useCallback(() => {
    if (track) void window.lyricLens.library.setFavorite(track.key, !favorite);
  }, [track, favorite]);
  const toggleSaved = useCallback(() => {
    if (!lookup) return;
    if (savedWords.has(lookup.id)) void window.lyricLens.library.removeWord(lookup.id);
    else void window.lyricLens.library.saveWord({ word: lookup.word, line: lookup.line, translation: lookup.translation, language: lookup.language });
  }, [lookup, savedWords]);
  // Clicking empty space dismisses the card; words, the card and the toolbar handle their own clicks.
  const onPanelClick = useCallback(
    (event: MouseEvent) => {
      if (lookup && !(event.target as HTMLElement).closest('.word, .sheet, .toolbar')) closeWord();
    },
    [lookup, closeWord],
  );
  const headerStatus = paused ? 'Paused' : null;
  const artwork = overlay.albumArtBackground && track?.artworkUrl ? track.artworkUrl : null;

  return (
    <div
      className="panel"
      data-compact={overlay.compact}
      data-locked={overlay.locked}
      data-paused={paused}
      data-clickthrough={overlay.clickThrough}
      style={{ ['--fs' as string]: `${overlay.fontSize}px` }}
      onClick={onPanelClick}
      {...drag}
    >
      {artwork && <div className="panel__art" style={{ backgroundImage: `url("${artwork}")` }} />}
      <header className="panel__header">
        {overlay.compact ? <div className="meta" /> : <TrackHeader track={track} status={headerStatus} favorite={favorite === true} />}
        {!overlay.clickThrough && <OverlayToolbar overlay={overlay} onPatch={patch} onOpenSettings={openSettings} favorite={favorite} onToggleFavorite={toggleFavorite} sourceLanguage={view?.sourceLanguage ?? null} />}
      </header>
      <main className="panel__body">
        <Body content={content} overlay={overlay} activeIndex={sync.activeIndex} track={track} onAction={onAction} tap={tap} />
      </main>
      {view?.note && !overlay.compact && content.kind === 'lyrics' && <div className="panel__note">{view.note}</div>}
      {paused && overlay.compact && content.kind === 'lyrics' && <div className="panel__paused">Paused</div>}
      {lookup && (
        <WordSheet lookup={lookup} saved={savedWords.has(lookup.id)} onToggleSave={toggleSaved} onClose={closeWord} />
      )}
      <Toast notice={notice} />
    </div>
  );
}

interface BodyProps {
  content: OverlayContent;
  overlay: OverlaySettings;
  activeIndex: number;
  track: SpotifyTrack | null;
  onAction: (action: 'connect' | 'settings' | 'retry') => void;
  tap: TapConfig | null;
}

function Body({ content, overlay, activeIndex, track, onAction, tap }: BodyProps) {
  if (content.kind === 'loading') {
    return (
      <div className="loading" role="status">
        {overlay.compact && track ? <div className="loading__title">{track.title}</div> : null}
        <div className="loading__message">{content.message}</div>
      </div>
    );
  }
  if (content.kind === 'empty') {
    return (
      <EmptyState
        icon={content.icon}
        title={content.title}
        message={content.message}
        actionLabel={content.action ? ACTION_LABEL[content.action] : undefined}
        onAction={content.action ? () => onAction(content.action!) : undefined}
      />
    );
  }
  const { view, translating } = content;
  return view.synced ? (
    <SyncedLyrics
      view={view}
      activeIndex={activeIndex}
      mode={overlay.displayMode}
      showContext={overlay.showContext && !overlay.compact}
      translating={translating}
      fontSize={overlay.fontSize}
      tap={tap}
    />
  ) : (
    <PlainLyrics view={view} mode={overlay.displayMode} translating={translating} tap={tap} />
  );
}
