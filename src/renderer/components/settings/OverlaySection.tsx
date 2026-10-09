import { OVERLAY_LIMITS } from '@shared/constants/defaults';
import { formatAccelerator } from '@shared/utils/accelerator';
import { ShortcutsSection } from './ShortcutsSection';
import type { OverlaySettings } from '@shared/types/settings';
import { useAppSelector } from '../../hooks/useAppState';
import { Button, Group, Row, Segmented, Slider, Toggle } from './controls';

export function OverlaySection() {
  const overlay = useAppSelector((s) => s.settings.overlay);
  const shortcuts = useAppSelector((s) => s.settings.shortcuts);
  const platform = useAppSelector((s) => s.platform);
  const recordHistory = useAppSelector((s) => s.settings.library.recordHistory);
  const isMac = platform === 'darwin';
  const patch = (p: Partial<OverlaySettings>) => void window.lyricLens.updateSettings({ overlay: p });

  return (
    <>
      <Group title="Lyrics overlay">
        <Row label="Appearance">
          <Segmented
            value={overlay.theme}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            onChange={(theme) => patch({ theme })}
          />
        </Row>
        <Row label="Show">
          <Segmented
            value={overlay.displayMode}
            options={[
              { value: 'both', label: 'Both' },
              { value: 'translation', label: 'English' },
              { value: 'original', label: 'Original' },
            ]}
            onChange={(displayMode) => patch({ displayMode })}
          />
        </Row>
        <Row label="Text size">
          <Slider label="Text size" value={overlay.fontSize} min={OVERLAY_LIMITS.fontMin} max={OVERLAY_LIMITS.fontMax} step={1} onChange={(fontSize) => patch({ fontSize })} format={(v) => `${v} pt`} />
        </Row>
        <Row label="Opacity">
          <Slider label="Opacity" value={overlay.opacity} min={OVERLAY_LIMITS.opacityMin} max={OVERLAY_LIMITS.opacityMax} step={0.01} onChange={(opacity) => patch({ opacity })} format={(v) => `${Math.round(v * 100)}%`} />
        </Row>
        <Row label="Previous & next lines">
          <Toggle label="Show previous and next lines" checked={overlay.showContext} onChange={(showContext) => patch({ showContext })} />
        </Row>
        <Row label="Album art backdrop" hint="A soft blurred cover behind the lyrics.">
          <Toggle label="Album art backdrop" checked={overlay.albumArtBackground} onChange={(albumArtBackground) => patch({ albumArtBackground })} />
        </Row>
        <Row label="Compact mode" hint="Just the current line.">
          <Toggle label="Compact mode" checked={overlay.compact} onChange={(compact) => patch({ compact })} />
        </Row>
      </Group>

      <Group title="Behavior">
        <Row label="Lock position" hint="Prevents moving and resizing.">
          <Toggle label="Lock position" checked={overlay.locked} onChange={(locked) => patch({ locked })} />
        </Row>
        <Row label="Click-through" hint={`Mouse clicks pass through to the app underneath. Turn off from the menu bar or with ${formatAccelerator(shortcuts.toggleClickThrough, isMac)}.`}>
          <Toggle label="Click-through" checked={overlay.clickThrough} onChange={(clickThrough) => patch({ clickThrough })} />
        </Row>
        <Row label="Tap words for definitions" hint="Click a word in the overlay to see what it means and save it.">
          <Toggle label="Tap words for definitions" checked={overlay.tapWords} onChange={(tapWords) => patch({ tapWords })} />
        </Row>
        <Row label="Remember listening history" hint="Keeps a list of songs on this Mac so you can revisit them and mark favorites.">
          <Toggle label="Remember listening history" checked={recordHistory} onChange={(value) => void window.lyricLens.updateSettings({ library: { recordHistory: value } })} />
        </Row>
        <Row label="Lyric timing" hint="Nudge if lyrics feel early or late.">
          <Slider label="Lyric timing offset" value={overlay.syncOffsetMs} min={-2000} max={2000} step={50} onChange={(syncOffsetMs) => patch({ syncOffsetMs })} format={(v) => (v === 0 ? 'On time' : `${v > 0 ? '+' : ''}${v} ms`)} />
        </Row>
        <Row label="Overlay position">
          <Button onClick={() => void window.lyricLens.perform('overlay.resetPosition')}>Reset position</Button>
        </Row>
      </Group>

      <ShortcutsSection />
    </>
  );
}
