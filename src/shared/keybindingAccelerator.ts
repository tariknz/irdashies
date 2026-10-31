/** Compare Electron aliases without treating normalization as syntax validation. */
export function normalizeKeyboardAccelerator(
  accelerator: string,
  isMac: boolean
): string {
  const aliases: Record<string, string> = {
    commandorcontrol: isMac ? 'command' : 'control',
    cmdorctrl: isMac ? 'command' : 'control',
    cmd: 'command',
    ctrl: 'control',
    option: 'alt',
    super: isMac ? 'command' : 'meta',
    meta: isMac ? 'command' : 'meta',
    esc: 'escape',
    return: 'enter',
  };
  return accelerator
    .toLowerCase()
    .split('+')
    .map((part) => aliases[part] ?? part)
    .sort()
    .join('+');
}
