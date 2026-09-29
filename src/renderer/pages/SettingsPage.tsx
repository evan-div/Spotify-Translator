import { AboutSection } from '../components/settings/AboutSection';
import { OverlaySection } from '../components/settings/OverlaySection';
import { SpotifySection } from '../components/settings/SpotifySection';
import { TranslationSection } from '../components/settings/TranslationSection';
import { Toast } from '../components/Toast';
import { useAppSelector } from '../hooks/useAppState';
import { Onboarding } from './Onboarding';

export function SettingsPage() {
  const onboardingCompleted = useAppSelector((s) => s.settings.onboardingCompleted);
  const notice = useAppSelector((s) => s.notice);

  return (
    <div className="settings">
      <div className="settings__titlebar" />
      <div className="settings__scroll">
        {onboardingCompleted ? (
          <>
            <h1 className="settings__heading">Lyric Lens</h1>
            <SpotifySection />
            <TranslationSection />
            <OverlaySection />
            <AboutSection />
          </>
        ) : (
          <Onboarding />
        )}
      </div>
      <Toast notice={notice} />
    </div>
  );
}
