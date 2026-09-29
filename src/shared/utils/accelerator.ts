/** Renders an Electron accelerator ("CommandOrControl+Alt+Shift+L") as macOS-style glyphs ("⌥⇧⌘L"). */
export function formatAccelerator(accelerator: string, isMac: boolean): string {
  const parts = accelerator.split('+');
  const key = parts.pop() ?? '';
  const has = (...names: string[]) => parts.some((p) => names.includes(p));
  const keyLabel =
    ({ Up: '↑', Down: '↓', Left: '←', Right: '→', Plus: '+', Space: 'Space' } as Record<string, string>)[key] ??
    key.toUpperCase();
  if (isMac) {
    return [
      has('Control', 'Ctrl') ? '⌃' : '',
      has('Alt', 'Option') ? '⌥' : '',
      has('Shift') ? '⇧' : '',
      has('Command', 'Cmd', 'CommandOrControl', 'CmdOrCtrl', 'Super') ? '⌘' : '',
      keyLabel,
    ].join('');
  }
  return [
    has('Control', 'Ctrl', 'CommandOrControl', 'CmdOrCtrl') ? 'Ctrl' : '',
    has('Alt', 'Option') ? 'Alt' : '',
    has('Shift') ? 'Shift' : '',
    keyLabel,
  ]
    .filter(Boolean)
    .join('+');
}
