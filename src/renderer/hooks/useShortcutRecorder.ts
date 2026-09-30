import { useCallback, useEffect, useState } from 'react';
import {
  acceleratorFromKeyEvent,
  isDisabledAccelerator,
  isModifierCode,
  modifiersFromEvent,
  validateAccelerator,
} from '@shared/utils/accelerator';

export interface RecorderState {
  recording: boolean;
  /** Modifiers currently held while recording (live preview). */
  held: string[];
  error: string | null;
}

/**
 * Captures one global-shortcut combination. Global shortcuts are suspended in the main process
 * while recording, otherwise pressing an existing shortcut would trigger its action instead.
 */
export function useShortcutRecorder(isMac: boolean, onCommit: (accelerator: string) => void) {
  const [state, setState] = useState<RecorderState>({ recording: false, held: [], error: null });

  const stop = useCallback(() => {
    setState({ recording: false, held: [], error: null });
    void window.lyricLens.perform('shortcuts.resume');
  }, []);

  const start = useCallback(() => {
    void window.lyricLens.perform('shortcuts.suspend');
    setState({ recording: true, held: [], error: null });
  }, []);

  useEffect(() => {
    if (!state.recording) return;

    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      if (isModifierCode(event.code)) {
        setState((s) => ({ ...s, held: modifiersFromEvent(event, isMac), error: null }));
        return;
      }
      const noModifiers = modifiersFromEvent(event, isMac).length === 0;
      if (event.code === 'Escape' && noModifiers) return stop();
      if ((event.code === 'Backspace' || event.code === 'Delete') && noModifiers) {
        onCommit('');
        return stop();
      }
      const accelerator = acceleratorFromKeyEvent(event, isMac);
      if (!accelerator) return setState((s) => ({ ...s, error: "That key isn't supported." }));
      const check = validateAccelerator(accelerator);
      if (!check.ok) return setState((s) => ({ ...s, held: [], error: check.reason }));
      onCommit(accelerator);
      stop();
    };
    const onKeyUp = (event: KeyboardEvent) => setState((s) => ({ ...s, held: modifiersFromEvent(event, isMac) }));

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('blur', stop);
    };
  }, [state.recording, isMac, onCommit, stop]);

  // Never leave shortcuts suspended if the page goes away mid-recording.
  useEffect(() => () => void window.lyricLens.perform('shortcuts.resume'), []);

  return { state, start, stop, isDisabled: isDisabledAccelerator };
}
