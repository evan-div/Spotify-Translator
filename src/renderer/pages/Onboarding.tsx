import type { ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Button } from '../components/settings/controls';
import { SpotifyConnect } from '../components/settings/SpotifySection';
import { TranslationProviderFields } from '../components/settings/TranslationSection';
import { useAppSelector } from '../hooks/useAppState';

function Step({ index, title, done, children }: { index: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <section className="step">
      <div className="step__badge" data-done={done}>
        {done ? <Icon name="check" size={14} /> : index}
      </div>
      <div className="step__content">
        <h3 className="step__title">{title}</h3>
        <div className="group__body">{children}</div>
      </div>
    </section>
  );
}

export function Onboarding() {
  const spotify = useAppSelector((s) => s.spotify);
  const demo = useAppSelector((s) => s.demo);
  const translationReady = useAppSelector((s) => s.providers.translation.configured);
  const lyrics = useAppSelector((s) => s.providers.lyrics);

  const finish = async () => {
    await window.lyricLens.updateSettings({ onboardingCompleted: true });
    window.close();
  };
  const tryDemo = () => void window.lyricLens.updateSettings({ demoMode: true });

  return (
    <div className="onboarding">
      <header className="onboarding__hero">
        <div className="logo" aria-hidden="true">
          <span>あ</span>
          <span>A</span>
        </div>
        <h1>Translate your Spotify lyrics while you listen.</h1>
        <p>A quiet floating subtitle for the music you love: original lyrics on top, natural English beneath.</p>
      </header>

      <Step index={1} title="Connect Spotify" done={demo || spotify.status === 'connected'}>
        <SpotifyConnect compact />
      </Step>
      <Step index={2} title="Lyrics provider" done>
        <div className="row">
          <div className="row__label">
            <div>{lyrics.label}</div>
            <div className="row__hint">Free synced lyrics. Nothing to set up.</div>
          </div>
        </div>
      </Step>
      <Step index={3} title="Translation provider" done={translationReady}>
        <TranslationProviderFields />
        {!translationReady && <p className="step__skip">You can skip this. Songs will show their original lyrics until you add a provider.</p>}
      </Step>
      <Step index={4} title="Start listening">
        <div className="row">
          <div className="row__label">
            <div>Play a Spanish song in Spotify</div>
            <div className="row__hint">The overlay lives in your menu bar and follows along automatically.</div>
          </div>
          <div className="row__control">
            <Button kind="primary" onClick={() => void finish()}>
              Start listening
            </Button>
          </div>
        </div>
      </Step>

      {!demo && (
        <p className="onboarding__demo">
          Just looking around? <button type="button" className="link" onClick={tryDemo}>Try the demo</button> with simulated songs.
        </p>
      )}
    </div>
  );
}
