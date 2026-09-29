import type { DemoCommand } from '@shared/types/ipc';
import { useAppSelector } from '../hooks/useAppState';
import { Button, Row } from '../components/settings/controls';

const send = (command: DemoCommand) => void window.lyricLens.demoCommand(command);

/** DEMO MODE ONLY: drives the simulated player so every UI state can be exercised. */
export function DemoControls() {
  const playback = useAppSelector((s) => s.playback);
  return (
    <Row stacked label="Simulated player" hint={playback.track ? `${playback.track.title} · ${playback.status}` : playback.mediaType === 'ad' ? 'Ad · ' + playback.status : playback.status}>
      <div className="button-row button-row--start">
        <Button onClick={() => send('previous')}>⏮ Previous</Button>
        <Button onClick={() => send('toggle-pause')}>{playback.status === 'playing' ? '⏸ Pause' : '▶︎ Play'}</Button>
        <Button onClick={() => send('next')}>Next ⏭</Button>
      </div>
      <div className="button-row button-row--start">
        <Button onClick={() => send('seek-back')}>−15 s</Button>
        <Button onClick={() => send('seek-forward')}>+15 s</Button>
      </div>
    </Row>
  );
}
