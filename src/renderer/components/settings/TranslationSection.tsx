import { useState } from 'react';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES, TRANSLATION_PROVIDERS } from '@shared/constants/defaults';
import type { TranslationProviderId } from '@shared/types/settings';
import { useAppSelector } from '../../hooks/useAppState';
import { Button, Group, Row, Segmented, Select, TextField } from './controls';

const KEY_LINKS: Partial<Record<TranslationProviderId, { label: string; url: string }>> = {
  deepl: { label: 'DeepL API key', url: 'https://www.deepl.com/pro-api' },
  google: { label: 'Google Cloud Translation key', url: 'https://cloud.google.com/translate/docs/setup' },
  openai: { label: 'OpenAI API key', url: 'https://platform.openai.com/api-keys' },
};

export function TranslationProviderFields() {
  const translation = useAppSelector((s) => s.settings.translation);
  const status = useAppSelector((s) => s.providers.translation);
  const demo = useAppSelector((s) => s.demo);
  const [key, setKey] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const update = (patch: Parameters<typeof window.lyricLens.updateSettings>[0]) => void window.lyricLens.updateSettings(patch);
  const provider = translation.provider !== 'none' ? translation.provider : status.provider;
  const link = KEY_LINKS[provider];

  const save = async () => {
    setBusy(true);
    const result = await window.lyricLens.setTranslationApiKey(key);
    setBusy(false);
    setFeedback({ ok: result.ok, text: result.ok ? 'Key saved securely.' : (result.message ?? 'Could not save the key.') });
    if (result.ok) setKey('');
  };
  const test = async () => {
    setBusy(true);
    setFeedback(null);
    const result = await window.lyricLens.testTranslation();
    setBusy(false);
    setFeedback({ ok: result.ok, text: result.message ?? (result.ok ? 'Working.' : 'Failed.') });
  };

  const keyHint =
    status.keySource === 'stored'
      ? 'A key is stored in your macOS Keychain.'
      : status.keySource === 'environment'
        ? 'Using the key from your environment (TRANSLATION_API_KEY).'
        : link
          ? (
              <>
                Get one from{' '}
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
                . It never leaves this Mac except to reach the provider.
              </>
            )
          : 'Choose a provider to add its API key.';

  return (
    <>
      <Row label="Provider" hint={demo ? 'Demo mode uses a built-in demo translator.' : undefined}>
        <Select
          label="Translation provider"
          value={translation.provider}
          options={TRANSLATION_PROVIDERS.map((p) => ({ value: p.id, label: p.label }))}
          onChange={(value) => update({ translation: { provider: value } })}
        />
      </Row>
      {provider !== 'none' && (
        <Row stacked label="API key" hint={keyHint}>
          <div className="input-row">
            <input
              className="input input--mono"
              aria-label="Translation API key"
              type="password"
              value={key}
              placeholder={status.configured ? '••••••••••••••••' : 'Paste your API key'}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && key.trim() && void save()}
            />
            <Button kind="primary" onClick={() => void save()} disabled={busy || key.trim().length === 0}>
              Save
            </Button>
          </div>
          {(status.keySource === 'stored' || status.configured) && (
            <div className="button-row button-row--start">
              <Button onClick={() => void test()} disabled={busy}>
                Test
              </Button>
              {status.keySource === 'stored' && (
                <Button kind="danger" onClick={() => void window.lyricLens.clearTranslationApiKey()}>
                  Remove key
                </Button>
              )}
            </div>
          )}
          {feedback && <div className={feedback.ok ? 'feedback feedback--ok' : 'feedback feedback--error'}>{feedback.text}</div>}
        </Row>
      )}
      {translation.provider === 'openai' && (
        <>
          <Row label="Model" hint="Any chat model your endpoint supports.">
            <TextField label="Model" value={translation.model} onCommit={(value) => update({ translation: { model: value } })} />
          </Row>
          <Row label="API base URL" hint="Change to use Azure, OpenRouter, or a local server.">
            <TextField label="API base URL" value={translation.baseUrl} monospace onCommit={(value) => update({ translation: { baseUrl: value } })} />
          </Row>
        </>
      )}
    </>
  );
}

export function TranslationSection() {
  const translation = useAppSelector((s) => s.settings.translation);
  return (
    <Group title="Translation">
      <Row label="Source language">
        <Segmented
          value={translation.sourceLanguage}
          options={SOURCE_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          onChange={(value) => void window.lyricLens.updateSettings({ translation: { sourceLanguage: value } })}
        />
      </Row>
      <Row label="Target language">
        <Select
          label="Target language"
          value={translation.targetLanguage}
          options={TARGET_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
          onChange={() => undefined}
          disabled={TARGET_LANGUAGES.length < 2}
        />
      </Row>
      <TranslationProviderFields />
    </Group>
  );
}
