import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IrSdkSourceBridge } from '@irdashies/types';

const handlers = new Map<string, (...args: unknown[]) => unknown>();
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((name, handler) => handlers.set(name, handler)) },
}));

import { isTapeReplayCommand, setupTapeReplayBridge } from './tapeReplayBridge';

describe('tape replay bridge', () => {
  beforeEach(() => handlers.clear());

  it.each([
    null,
    {},
    { type: 'broadcast' },
    { type: 'pause', paused: 1 },
    { type: 'seek', seconds: -1 },
    { type: 'seek', seconds: Infinity },
    { type: 'speed', speed: NaN },
    { type: 'speed', speed: '2' },
    { type: 'speed', speed: 0 },
    { type: 'speed', speed: 101 },
  ])('rejects invalid command %j', (command) => {
    expect(isTapeReplayCommand(command)).toBe(false);
  });

  it('does not expose replay controls on live sources', () => {
    setupTapeReplayBridge(() => undefined);
    expect(handlers.get('tapeReplay:status')?.()).toBe(null);
    expect(() =>
      handlers.get('tapeReplay:command')?.({}, { type: 'pause', paused: true })
    ).toThrow('Tape replay is not active');
  });

  it('validates commands before dispatching and resolves the current source on each request', () => {
    const status = {
      position: 1,
      duration: 10,
      speed: 1,
      paused: false,
      ended: false,
    };
    const controlTapeReplay = vi.fn(() => status);
    let source:
      | Pick<IrSdkSourceBridge, 'controlTapeReplay' | 'getTapeReplayStatus'>
      | undefined = { controlTapeReplay, getTapeReplayStatus: () => status };
    setupTapeReplayBridge(() => source);
    expect(handlers.get('tapeReplay:status')?.()).toEqual(status);
    for (const command of [
      { type: 'seek', seconds: 5 },
      { type: 'speed', speed: 0.5 },
      { type: 'speed', speed: 100 },
      { type: 'pause', paused: false },
    ]) {
      expect(handlers.get('tapeReplay:command')?.({}, command)).toEqual(status);
      expect(controlTapeReplay).toHaveBeenLastCalledWith(command);
    }
    expect(() =>
      handlers.get('tapeReplay:command')?.(
        {},
        { type: 'speed', speed: Infinity }
      )
    ).toThrow('Invalid tape replay command');
    expect(controlTapeReplay).toHaveBeenCalledTimes(4);
    source = undefined;
    expect(handlers.get('tapeReplay:status')?.()).toBe(null);
  });
});
