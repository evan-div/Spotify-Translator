import type { SpotifyTrack } from '@shared/types/domain';
import { Icon } from './Icon';

interface Props {
  track: SpotifyTrack | null;
  status?: string | null;
  favorite?: boolean;
}

export function TrackHeader({ track, status, favorite }: Props) {
  if (!track) return <div className="meta" />;
  return (
    <div className="meta" title={`${track.title} — ${track.artists.join(', ')}`}>
      <div className="meta__title">
        {favorite && <Icon name="star" size={11} fill="currentColor" className="meta__star" />}
        {track.title}
      </div>
      <div className="meta__artist">
        {track.artists.join(', ')}
        {status && <span className="meta__status"> · {status}</span>}
      </div>
    </div>
  );
}
