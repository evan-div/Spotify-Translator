import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OverlayPage } from './pages/OverlayPage';
import { SettingsPage } from './pages/SettingsPage';
import { appStore } from './stores/appStore';
import { useAppSelector } from './hooks/useAppState';
import './styles/tokens.css';
import './styles/overlay.css';
import './styles/settings.css';

type Page = 'overlay' | 'settings';

function currentPage(): Page {
  return window.location.hash.startsWith('#/settings') ? 'settings' : 'overlay';
}

function App() {
  const ready = useAppSelector((s) => s.ready);
  const platform = useAppSelector((s) => s.platform);
  const theme = useAppSelector((s) => s.settings.overlay.theme);
  const page = currentPage();
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.platform = platform;
  document.documentElement.dataset.page = page;
  if (!ready) return null;
  return page === 'overlay' ? <OverlayPage /> : <SettingsPage />;
}

void appStore.init().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
