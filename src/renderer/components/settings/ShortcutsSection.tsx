import { DEFAULT_SETTINGS } from '@shared/constants/defaults';
import { formatAccelerator, isDisabledAccelerator, normalizeAccelerator } from '@shared/utils/accelerator';
import type { ShortcutAction, ShortcutState } from '@shared/types/settings';
import { useShortcutRecorder } from '../../hooks/useShortcutRecorder';
import { useAppSelector } from '../../hooks/useAppState';
import { Group, Row } from './controls';

const LABELS: Record<ShortcutAction, string> = {
  toggleOverlay: 'Show / hide lyrics',
  toggleClickThrough: 'Toggle click-through',
  increaseFont: 'Larger text',
  decreaseFont: 'Smaller text',
};
const ORDER: ShortcutAction[] = ['toggleOverlay', 'toggleClickThrough', 'increaseFont', 'decreaseFont'];

const PROBLEMS: Partial<Record<ShortcutState, string>> = {
  'in-use': 'Already used by macOS or another app. Choose a different combination.',
  duplicate: 'Another Lyric Lens shortcut already uses this combination.',
  invalid: "This combination isn't valid.",
};

const MODIFIER_GLYPHS: Record<string, { mac: string; other: string }> = {
  CommandOrControl: { mac: '⌘', other: 'Ctrl' },
  Control: { mac: '⌃', other: 'Ctrl' },
  Alt: { mac: '⌥', other: 'Alt' },
  Shift: { mac: '⇧', other: 'Shift' },
  Super: { mac: '⌘', other: 'Win' },
};

function ShortcutRow({ action, isMac }: { action: ShortcutAction; isMac: boolean }) {
  const accelerator = useAppSelector((s) => s.settings.shortcuts[action]);
  const status = useAppSelector((s) => s.shortcutStatus[action]);
  const others = useAppSelector((s) => s.settings.shortcuts);
  const defaultValue = DEFAULT_SETTINGS.shortcuts[action];

  const commit = (value: string) => {
    const normalized = normalizeAccelerator(value);
    const clash = ORDER.find((a) => a !== action && normalized && normalizeAccelerator(others[a]) === normalized);
    if (clash) {
      // Swap rather than silently double-booking; the other shortcut is disabled.
      void window.lyricLens.updateSettings({ shortcuts: { [action]: value, [clash]: '' } });
    } else {
      void window.lyricLens.updateSettings({ shortcuts: { [action]: value } });
    }
  };
  const recorder = useShortcutRecorder(isMac, commit);
  const { recording, held, error } = recorder.state;

  const disabled = isDisabledAccelerator(accelerator);
  const problem = !recording ? PROBLEMS[status] : undefined;
  const preview = held.map((m) => MODIFIER_GLYPHS[m]?.[isMac ? 'mac' : 'other'] ?? m).join(isMac ? '' : '+');

  return (
    <Row
      label={LABELS[action]}
      hint={
        recording ? (
          <span className={error ? 'text-danger' : undefined}>{error ?? 'Press the new shortcut. Esc cancels, Delete turns it off.'}</span>
        ) : problem ? (
          <span className="text-danger">{problem}</span>
        ) : undefined
      }
    >
      <div className="shortcut">
        <button
          type="button"
          className={`shortcut__key${recording ? ' shortcut__key--recording' : ''}${problem ? ' shortcut__key--problem' : ''}`}
          onClick={() => (recording ? recorder.stop() : recorder.start())}
          aria-label={`${LABELS[action]} shortcut. Click to change`}
        >
          {recording ? (preview || 'Type shortcut…') : disabled ? 'Off' : formatAccelerator(accelerator, isMac)}
        </button>
        {!recording && accelerator !== defaultValue && (
          <button type="button" className="shortcut__reset" title="Reset to default" aria-label="Reset to default" onClick={() => commit(defaultValue)}>
            ↺
          </button>
        )}
      </div>
    </Row>
  );
}

export function ShortcutsSection() {
  const platform = useAppSelector((s) => s.platform);
  const isMac = platform === 'darwin';
  const shortcuts = useAppSelector((s) => s.settings.shortcuts);
  const isDefault = ORDER.every((a) => shortcuts[a] === DEFAULT_SETTINGS.shortcuts[a]);

  return (
    <Group
      title="Keyboard shortcuts"
      footer={
        <>
          Global shortcuts work from any app. Click one to record a new combination.{' '}
          {!isDefault && (
            <button type="button" className="link link--plain" onClick={() => void window.lyricLens.updateSettings({ shortcuts: DEFAULT_SETTINGS.shortcuts })}>
              Reset all
            </button>
          )}
        </>
      }
    >
      {ORDER.map((action) => (
        <ShortcutRow key={action} action={action} isMac={isMac} />
      ))}
    </Group>
  );
}

