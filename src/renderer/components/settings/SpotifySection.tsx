import { useState } from 'react';
import { useAppSelector } from '../../hooks/useAppState';
import { Button, Group, Row, StatusPill, TextField } from './controls';

const DASHBOARD_URL = 'https://developer.spotify.com/dashboard';

export function SpotifyConnect({ compact }: { compact?: boolean }) {
  const spotify = useAppSelector((s) => s.spotify);
  const providers = useAppSelector((s) => s.providers);
  const clientId = useAppSelector((s) => s.settings.spotifyClientId);
  const demo = useAppSelector((s) => s.demo);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const connect = async () => {
    setError(null);
    const result = await window.lyricLens.perform('spotify.connect');
    if (!result.ok) setError(result.message ?? 'Could not connect to Spotify.');
  };
  const copy = async () => {
    await navigator.clipboard.writeText(providers.spotify.redirectUri).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const connected = spotify.status === 'connected';
  const connecting = spotify.status === 'connecting';
  const needsClientId = providers.spotify.clientIdSource === 'missing';
  const message = error ?? spotify.message;

  return (
    <>
      <Row label="Status" hint={message && !connected ? <span className="text-danger">{message}</span> : undefined}>
        {demo ? (
          <StatusPill tone="idle">Demo mode</StatusPill>
        ) : connected ? (
          <StatusPill tone="ok">Connected{spotify.userName ? ` as ${spotify.userName}` : ''}</StatusPill>
        ) : connecting ? (
          <StatusPill tone="warn">Waiting for browser…</StatusPill>
        ) : (
          <StatusPill tone="idle">Not connected</StatusPill>
        )}
      </Row>
      {!demo && providers.spotify.clientIdSource !== 'environment' && (
        <Row
          stacked
          label="Client ID"
          hint={
            <>
              Create a free app in the{' '}
              <a href={DASHBOARD_URL} target="_blank" rel="noreferrer">
                Spotify Developer Dashboard
              </a>{' '}
              and paste its Client ID. Add this Redirect URI to the app:{' '}
              <button type="button" className="link" onClick={() => void copy()}>
                {copied ? 'Copied!' : providers.spotify.redirectUri}
              </button>
            </>
          }
        >
          <TextField
            label="Spotify Client ID"
            value={clientId}
            placeholder="32-character Client ID"
            monospace
            onCommit={(value) => void window.lyricLens.updateSettings({ spotifyClientId: value })}
          />
        </Row>
      )}
      {!demo && (
        <Row label={compact ? 'Spotify account' : 'Account'}>
          <div className="button-row">
            {!connected && (
              <Button kind="primary" onClick={() => void connect()} disabled={connecting || needsClientId}>
                {spotify.needsReconnect ? 'Reconnect Spotify' : 'Connect Spotify'}
              </Button>
            )}
            {connected && <Button onClick={() => void connect()}>Reconnect</Button>}
            {connected && (
              <Button kind="danger" onClick={() => void window.lyricLens.perform('spotify.disconnect')}>
                Disconnect
              </Button>
            )}
          </div>
        </Row>
      )}
    </>
  );
}

export function SpotifySection() {
  return (
    <Group title="Spotify">
      <SpotifyConnect />
    </Group>
  );
}
