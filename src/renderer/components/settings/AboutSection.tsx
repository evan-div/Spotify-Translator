import { useAppSelector } from '../../hooks/useAppState';
import { Button, Group, Row, Toggle } from './controls';
import { DemoControls } from '../../demo/DemoControls';

export function AboutSection() {
  const demo = useAppSelector((s) => s.demo);
  const demoMode = useAppSelector((s) => s.settings.demoMode);
  const version = useAppSelector((s) => s.appVersion);
  const lyrics = useAppSelector((s) => s.providers.lyrics);

  return (
    <>
      <Group title="Demo & maintenance">
        <Row label="Demo mode" hint="Simulated songs, lyrics and translations. No Spotify or API keys needed.">
          <Toggle label="Demo mode" checked={demo || demoMode} onChange={(value) => void window.lyricLens.updateSettings({ demoMode: value })} />
        </Row>
        {demo && <DemoControls />}
        <Row label="Current song" hint="Re-fetch lyrics and translation, bypassing the cache.">
          <Button onClick={() => void window.lyricLens.perform('song.refresh')}>Refresh</Button>
        </Row>
      </Group>
      <Group>
        <Row label="Lyrics source">{lyrics.label}</Row>
        <Row label="Version">{version}</Row>
        <Row label="Quit Lyric Lens">
          <Button onClick={() => void window.lyricLens.perform('app.quit')}>Quit</Button>
        </Row>
      </Group>
    </>
  );
}
