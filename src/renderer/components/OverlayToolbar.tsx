import { OVERLAY_LIMITS } from '@shared/constants/defaults';
import { LANGUAGE_BADGE, LANGUAGE_NAMES } from '@shared/constants/languages';
import type { SourceLanguageCode } from '@shared/types/domain';
import type { DisplayMode, OverlaySettings } from '@shared/types/settings';
import { Icon } from './Icon';

interface Props {
  overlay: OverlaySettings;
  onPatch: (patch: Partial<OverlaySettings>) => void;
  onOpenSettings: () => void;
  /** null = nothing favouritable is playing. */
  favorite: boolean | null;
  onToggleFavorite: () => void;
  /** Language of the current lyrics, for the Original/English badge. */
  sourceLanguage: SourceLanguageCode | null;
}

const MODE_ORDER: DisplayMode[] = ['both', 'translation', 'original'];
const modeLabel = (mode: DisplayMode, source: SourceLanguageCode): string =>
  mode === 'both' ? `${LANGUAGE_BADGE[source]} + EN` : mode === 'translation' ? 'EN' : LANGUAGE_BADGE[source];
const modeTitle = (mode: DisplayMode, source: SourceLanguageCode): string =>
  mode === 'both'
    ? `Showing ${LANGUAGE_NAMES[source]} and English`
    : mode === 'translation'
      ? 'Showing English only'
      : `Showing ${LANGUAGE_NAMES[source]} only`;

/** Hover-revealed controls. Deliberately not a player: no play/skip/volume. */
export function OverlayToolbar({ overlay, onPatch, onOpenSettings, favorite, onToggleFavorite, sourceLanguage }: Props) {
  const source = sourceLanguage ?? 'es';
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
      <button type="button" title={`${modeTitle(overlay.displayMode, source)} (click to change)`} onClick={() => onPatch({ displayMode: nextMode })} className="tool tool--label">
        {modeLabel(overlay.displayMode, source)}
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
      {favorite !== null && (
        <>
          <span className="toolbar__sep" />
          <button type="button" title={favorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={favorite} onClick={onToggleFavorite} className="tool tool--star">
            <Icon name="star" fill={favorite ? 'currentColor' : 'none'} />
          </button>
        </>
      )}
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
