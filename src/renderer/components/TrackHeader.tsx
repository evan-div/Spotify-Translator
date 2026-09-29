import type { SpotifyTrack } from '@shared/types/domain';

interface Props {
  track: SpotifyTrack | null;
  status?: string | null;
}

export function TrackHeader({ track, status }: Props) {
  if (!track) return <div className="meta" />;
  return (
    <div className="meta" title={`${track.title} — ${track.artists.join(', ')}`}>
      <div className="meta__title">{track.title}</div>
      <div className="meta__artist">
        {track.artists.join(', ')}
        {status && <span className="meta__status"> · {status}</span>}
      </div>
    </div>
  );
}
