import { useCallback, useMemo } from 'react';
import type { SpotifyTrack } from '@shared/types/domain';
import type { OverlaySettings } from '@shared/types/settings';
import { EmptyState } from '../components/EmptyState';
import { OverlayToolbar } from '../components/OverlayToolbar';
import { PlainLyrics } from '../components/PlainLyrics';
import { SyncedLyrics } from '../components/SyncedLyrics';
import { Toast } from '../components/Toast';
import { TrackHeader } from '../components/TrackHeader';
import { resolveOverlayContent, type OverlayContent } from '../hooks/overlayContent';
import { useAppSelector } from '../hooks/useAppState';
import { useSyncEngine } from '../hooks/useSyncEngine';
import { useWindowDrag } from '../hooks/useWindowDrag';

const ACTION_LABEL = { connect: 'Open Settings', settings: 'Open Settings', retry: 'Try again' } as const;

export function OverlayPage() {
  const overlay = useAppSelector((s) => s.settings.overlay);
  const playback = useAppSelector((s) => s.playback);
  const lyrics = useAppSelector((s) => s.lyrics);
  const spotify = useAppSelector((s) => s.spotify);
  const demo = useAppSelector((s) => s.demo);
  const notice = useAppSelector((s) => s.notice);

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
      {...drag}
    >
      {artwork && <div className="panel__art" style={{ backgroundImage: `url("${artwork}")` }} />}
      <header className="panel__header">
        {overlay.compact ? <div className="meta" /> : <TrackHeader track={track} status={headerStatus} />}
        {!overlay.clickThrough && <OverlayToolbar overlay={overlay} onPatch={patch} onOpenSettings={openSettings} />}
      </header>
      <main className="panel__body">
        <Body content={content} overlay={overlay} activeIndex={sync.activeIndex} track={track} onAction={onAction} />
      </main>
      {view?.note && !overlay.compact && content.kind === 'lyrics' && <div className="panel__note">{view.note}</div>}
      {paused && overlay.compact && content.kind === 'lyrics' && <div className="panel__paused">Paused</div>}
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
}

function Body({ content, overlay, activeIndex, track, onAction }: BodyProps) {
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
    />
  ) : (
    <PlainLyrics view={view} mode={overlay.displayMode} translating={translating} />
  );
}
