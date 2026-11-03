import { afterEach, describe, expect, it } from 'vitest';
import { listSimProcesses, parseSimProcessLines } from './simProcesses';

describe('parseSimProcessLines', () => {
  it('reads the sim executables and ignores the iRacing UI', () => {
    expect(
      parseSimProcessLines(
        [
          'iRacingSim64DX11.exe|1000',
          'iRacingUI.exe|500',
          'Le Mans Ultimate.exe|2000',
          '',
        ].join('\n')
      )
    ).toEqual([
      { id: 'iracing', startedAt: 1000 },
      { id: 'lmu', startedAt: 2000 },
    ]);
  });

  it('accepts the iRacing process name without an extension', () => {
    expect(parseSimProcessLines('iRacingSim64DX11|42')).toEqual([
      { id: 'iracing', startedAt: 42 },
    ]);
  });
});

describe('listSimProcesses fake hook', () => {
  afterEach(() => {
    delete process.env.IRDASHIES_FAKE_SIM_PROCESSES;
  });

  it('uses IRDASHIES_FAKE_SIM_PROCESSES instead of a live process list', async () => {
    process.env.IRDASHIES_FAKE_SIM_PROCESSES = 'lmu:1000,iracing:5000';
    await expect(listSimProcesses()).resolves.toEqual([
      { id: 'lmu', startedAt: 1000 },
      { id: 'iracing', startedAt: 5000 },
    ]);
  });
});
