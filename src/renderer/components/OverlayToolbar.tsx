import { OVERLAY_LIMITS } from '@shared/constants/defaults';
import type { DisplayMode, OverlaySettings } from '@shared/types/settings';
import { Icon } from './Icon';

interface Props {
  overlay: OverlaySettings;
  onPatch: (patch: Partial<OverlaySettings>) => void;
  onOpenSettings: () => void;
}

const MODE_ORDER: DisplayMode[] = ['both', 'translation', 'original'];
const MODE_LABEL: Record<DisplayMode, string> = { both: 'ES + EN', translation: 'EN', original: 'ES' };
const MODE_TITLE: Record<DisplayMode, string> = {
  both: 'Showing Spanish and English',
  translation: 'Showing English only',
  original: 'Showing Spanish only',
};

/** Hover-revealed controls. Deliberately not a player: no play/skip/volume. */
export function OverlayToolbar({ overlay, onPatch, onOpenSettings }: Props) {
  const nextMode = MODE_ORDER[(MODE_ORDER.indexOf(overlay.displayMode) + 1) % MODE_ORDER.length] ?? 'both';
  const font = (delta: number) =>
    onPatch({ fontSize: Math.min(OVERLAY_LIMITS.fontMax, Math.max(OVERLAY_LIMITS.fontMin, overlay.fontSize + delta)) });

  return (
    <div className="toolbar" data-nodrag role="toolbar" aria-label="Overlay controls">
      <button type="button" title="Smaller text" onClick={() => font(-OVERLAY_LIMITS.fontStep)} className="tool tool--text">
        A<small>−</small>
      </button>
      <button type="button" title="Larger text" onClick={() => font(OVERLAY_LIMITS.fontStep)} className="tool tool--text">
        A<small>+</small>
      </button>
      <span className="toolbar__sep" />
      <button type="button" title={`${MODE_TITLE[overlay.displayMode]} (click to change)`} onClick={() => onPatch({ displayMode: nextMode })} className="tool tool--label">
        {MODE_LABEL[overlay.displayMode]}
      </button>
      <button type="button" title={overlay.compact ? 'Expand' : 'Compact mode'} aria-pressed={overlay.compact} onClick={() => onPatch({ compact: !overlay.compact })} className="tool">
        <Icon name="compact" />
      </button>
      <span className="toolbar__sep" />
      <button type="button" title={overlay.locked ? 'Unlock position' : 'Lock position'} aria-pressed={overlay.locked} onClick={() => onPatch({ locked: !overlay.locked })} className="tool">
        <Icon name={overlay.locked ? 'lock' : 'unlock'} />
      </button>
      <button type="button" title="Click-through mode (turn off from the menu bar)" aria-pressed={overlay.clickThrough} onClick={() => onPatch({ clickThrough: !overlay.clickThrough })} className="tool">
        <Icon name="pointer" />
      </button>
      <span className="toolbar__sep" />
      <button type="button" title="Settings" onClick={onOpenSettings} className="tool">
        <Icon name="gear" />
      </button>
      <button type="button" title="Hide lyrics" onClick={() => onPatch({ visible: false })} className="tool">
        <Icon name="eye-off" />
      </button>
    </div>
  );
}
