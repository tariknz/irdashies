import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSyntheticTape,
  SYNTHETIC_SECOND_FRAME_PAYLOAD_OFFSET,
} from './fixture';
import { validateReplay, type ReplayProbe } from './validator';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

async function tapePath(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'irdashies-replay-'));
  temporaryDirectories.push(directory);
  const result = path.join(directory, 'synthetic.irdt');
  await writeFile(result, createSyntheticTape());
  return result;
}

const probe: ReplayProbe<{ fuel: number; sessionTime: number }> = {
  name: 'synthetic-fuel',
  schemaVersion: 1,
  variables: ['SessionTime', 'FuelLevel'],
  onFrame(frame) {
    return {
      fuel: frame.FuelLevel as number,
      sessionTime: frame.SessionTime as number,
    };
  },
};

describe('headless telemetry replay validator', () => {
  it('streams requested fields and applies session data on tape time', async () => {
    const result = await validateReplay({
      path: await tapePath(),
      probes: [probe],
      expected: { recordCount: 4, frameCount: 2, sessionUpdateCount: 1 },
    });

    expect(result.appliedSessionUpdateCount).toBe(1);
    expect(result.endCount).toBe(1);
    expect(result.probes[0]).toMatchObject({
      name: 'synthetic-fuel',
      schemaVersion: 1,
      frameCount: 2,
      checkpoints: {
        firstFrame: { fuel: 20, sessionTime: 1 },
        lastFrame: { fuel: expect.closeTo(19.9), sessionTime: 1.5 },
      },
    });
    expect(result.probes[0].rollingHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rejects probes that request fields outside the tape schema', async () => {
    await expect(
      validateReplay({
        path: await tapePath(),
        probes: [{ ...probe, variables: ['MissingField'] }],
      })
    ).rejects.toThrow('Replay probe requested unknown variable: MissingField');
  });

  it('isolates each probe from fields requested by other probes', async () => {
    const frameProbe: ReplayProbe<Record<string, unknown>> = {
      name: 'session-time-frame',
      schemaVersion: 1,
      variables: ['SessionTime'],
      onFrame: (frame) => frame,
    };
    const alone = await validateReplay({
      path: await tapePath(),
      probes: [frameProbe],
    });
    const withFuelProbe = await validateReplay({
      path: await tapePath(),
      probes: [frameProbe, probe],
    });

    expect(withFuelProbe.probes[0]).toEqual(alone.probes[0]);
    expect(withFuelProbe.probes[0].checkpoints.firstFrame).toEqual({
      SessionTime: 1,
    });
  });

  it('rejects a corrupted record payload', async () => {
    const tape = createSyntheticTape();
    tape[SYNTHETIC_SECOND_FRAME_PAYLOAD_OFFSET] ^= 0xff;
    const directory = await mkdtemp(path.join(tmpdir(), 'irdashies-replay-'));
    temporaryDirectories.push(directory);
    const corruptPath = path.join(directory, 'corrupt.irdt');
    await writeFile(corruptPath, tape);

    await expect(
      validateReplay({ path: corruptPath, probes: [probe] })
    ).rejects.toThrow('Telemetry tape record checksum mismatch');
  });
});
