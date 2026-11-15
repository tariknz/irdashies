import { ipcMain } from 'electron';
import type { IrSdkSourceBridge, TapeReplayCommand } from '@irdashies/types';

export function isTapeReplayCommand(
  value: unknown
): value is TapeReplayCommand {
  if (!value || typeof value !== 'object') return false;
  const command = value as Record<string, unknown>;
  switch (command.type) {
    case 'step':
      return true;
    case 'loop': {
      if (command.range === null) return true;
      if (!command.range || typeof command.range !== 'object') return false;
      const range = command.range as Record<string, unknown>;
      return (
        typeof range.start === 'number' &&
        Number.isFinite(range.start) &&
        range.start >= 0 &&
        typeof range.end === 'number' &&
        Number.isFinite(range.end) &&
        range.end > range.start
      );
    }
    case 'pause':
      return typeof command.paused === 'boolean';
    case 'seek':
      return (
        typeof command.seconds === 'number' &&
        Number.isFinite(command.seconds) &&
        command.seconds >= 0
      );
    case 'speed':
      return (
        typeof command.speed === 'number' &&
        Number.isFinite(command.speed) &&
        command.speed >= 0.25 &&
        command.speed <= 100
      );
    default:
      return false;
  }
}

/** Control-plane requests; telemetry continues through existing channels. */
export function setupTapeReplayBridge(
  getBridge: () =>
    | Pick<IrSdkSourceBridge, 'getTapeReplayStatus' | 'controlTapeReplay'>
    | undefined
) {
  ipcMain.handle(
    'tapeReplay:status',
    () => getBridge()?.getTapeReplayStatus?.() ?? null
  );
  ipcMain.handle('tapeReplay:command', (_event, command: unknown) => {
    if (!isTapeReplayCommand(command)) {
      throw new Error('Invalid tape replay command');
    }
    const bridge = getBridge();
    if (!bridge?.controlTapeReplay) {
      throw new Error('Tape replay is not active');
    }
    return bridge.controlTapeReplay(command);
  });
}
