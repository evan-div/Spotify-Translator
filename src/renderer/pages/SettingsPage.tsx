import { useEffect, useState } from 'react';
import { SETTINGS_TABS, type SettingsTab } from '@shared/types/ipc';
import { AboutSection } from '../components/settings/AboutSection';
import { HistoryTab } from '../components/settings/HistoryTab';
import { OverlaySection } from '../components/settings/OverlaySection';
import { SpotifySection } from '../components/settings/SpotifySection';
import { TranslationSection } from '../components/settings/TranslationSection';
import { VocabularyTab } from '../components/settings/VocabularyTab';
import { Toast } from '../components/Toast';
import { useAppSelector } from '../hooks/useAppState';
import { Onboarding } from './Onboarding';

/** `#/settings/vocabulary` opens straight onto that tab (used by the menu bar). */
function tabFromHash(): SettingsTab {
  const requested = window.location.hash.split('/')[2];
  return (SETTINGS_TABS as readonly string[]).includes(requested ?? '') ? (requested as SettingsTab) : 'settings';
}

const LABELS: Record<SettingsTab, string> = { settings: 'Settings', vocabulary: 'Vocabulary', history: 'History' };

export function SettingsPage() {
  const onboardingCompleted = useAppSelector((s) => s.settings.onboardingCompleted);
  const notice = useAppSelector((s) => s.notice);
  const vocabularyCount = useAppSelector((s) => s.library.vocabulary.length);
  const favoriteCount = useAppSelector((s) => s.library.history.filter((h) => h.favorite).length);
  const [tab, setTab] = useState<SettingsTab>(tabFromHash);

  useEffect(() => window.lyricLens.onNavigate(setTab), []);

  const counts: Record<SettingsTab, number> = { settings: 0, vocabulary: vocabularyCount, history: favoriteCount };

  return (
    <div className="settings">
      <div className="settings__titlebar" />
      <div className="settings__scroll">
        {onboardingCompleted ? (
          <>
            <h1 className="settings__heading">Lyric Lens</h1>
            <nav className="tabs" role="tablist">
              {SETTINGS_TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} className="tabs__item" onClick={() => setTab(t)}>
                  {LABELS[t]}
                  {counts[t] > 0 && <span className="tabs__count">{counts[t]}</span>}
                </button>
              ))}
            </nav>
            {tab === 'settings' && (
              <>
                <SpotifySection />
                <TranslationSection />
                <OverlaySection />
                <AboutSection />
              </>
            )}
            {tab === 'vocabulary' && <VocabularyTab />}
            {tab === 'history' && <HistoryTab />}
          </>
        ) : (
          <Onboarding />
        )}
      </div>
      <Toast notice={notice} />
    </div>
  );
}
