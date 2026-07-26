import {
  execFile,
  spawn,
  type ChildProcessWithoutNullStreams,
} from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import type { INativeSDK } from './index';

const execFileAsync = promisify(execFile);
const describeOnWindows =
  process.platform === 'win32' ? describe : describe.skip;

class ProcessOutput {
  private output = '';
  private waiters = new Set<{
    pattern: RegExp;
    resolve: (line: string) => void;
  }>();

  constructor(private readonly child: ChildProcessWithoutNullStreams) {
    const append = (chunk: Buffer): void => {
      this.output += chunk.toString();
      for (const waiter of this.waiters) {
        const match = this.output.match(waiter.pattern);
        if (match) {
          this.waiters.delete(waiter);
          waiter.resolve(match[0]);
        }
      }
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
  }

  waitFor(pattern: RegExp, timeoutMs = 5000): Promise<string> {
    const existing = this.output.match(pattern);
    if (existing) return Promise.resolve(existing[0]);

    return new Promise((resolve, reject) => {
      const waiter = { pattern, resolve };
      this.waiters.add(waiter);
      const timeout = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(
          new Error(
            `Timed out waiting for ${pattern}. Process output:\n${this.output}`
          )
        );
      }, timeoutMs);
      const originalResolve = waiter.resolve;
      waiter.resolve = (line): void => {
        clearTimeout(timeout);
        originalResolve(line);
      };
    });
  }

  all(): string {
    return this.output;
  }
}

const floatValue = (value: unknown): number =>
  new Float32Array(value as ArrayBuffer)[0];

const doubleValue = (value: unknown): number =>
  new Float64Array(value as ArrayBuffer)[0];

const intValue = (value: unknown): number =>
  new Int32Array(value as ArrayBuffer)[0];

const sendCommand = (
  child: ChildProcessWithoutNullStreams,
  command: string
): Promise<void> =>
  new Promise((resolve, reject) => {
    child.stdin.write(`${command}\n`, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

describeOnWindows('iRacing native record/replay boundary', () => {
  let publisher: ChildProcessWithoutNullStreams | undefined;
  let temporaryDirectory: string | undefined;

  afterEach(async () => {
    if (publisher && publisher.exitCode === null) {
      const closed = once(publisher, 'close');
      publisher.kill();
      await closed;
    }
    publisher = undefined;
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
    temporaryDirectory = undefined;
  });

  it(
    'replays raw frames through the isolated N-API test addon',
    { timeout: 20_000 },
    async () => {
      const executable = path.resolve(
        process.cwd(),
        'build',
        'Release',
        'irsdk_replay.exe'
      );
      temporaryDirectory = await mkdtemp(
        path.join(tmpdir(), 'irdashies-irsdk-replay-')
      );
      const tapePath = path.join(temporaryDirectory, 'synthetic.irdt');

      await execFileAsync(executable, ['fixture', '--output', tapePath]);

      publisher = spawn(executable, ['play', '--input', tapePath, '--step'], {
        stdio: 'pipe',
      });
      const output = new ProcessOutput(publisher);
      await output.waitFor(/READY/);

      const require = createRequire(import.meta.url);
      const replayAddon = require(
        path.resolve(
          process.cwd(),
          'build',
          'Release',
          'irsdk_node_replay.node'
        )
      ) as {
        iRacingSdkNode: new () => INativeSDK;
      };
      const sdk = new replayAddon.iRacingSdkNode();
      try {
        expect(sdk.startSDK()).toBe(true);

        // The official client deliberately establishes its tick baseline on
        // the first observed buffer and reports data from the following tick.
        await sendCommand(publisher, 'next');
        expect(sdk.waitForData(1000)).toBe(false);

        await sendCommand(publisher, 'next');
        expect(sdk.waitForData(1000)).toBe(true);

        const telemetry = sdk.getTelemetryData();
        expect(doubleValue(telemetry.SessionTime.value)).toBeCloseTo(
          10 + 1 / 60,
          8
        );
        expect(intValue(telemetry.SessionTick.value)).toBe(101);
        expect(floatValue(telemetry.Speed.value)).toBeCloseTo(51);
        expect(
          Array.from(
            new Float32Array(
              telemetry.CarIdxLapDistPct.value as unknown as ArrayBuffer
            )
          )
        ).toEqual([
          expect.closeTo(0.11, 5),
          expect.closeTo(0.21, 5),
          expect.closeTo(0.31, 5),
        ]);

        const firstSession = sdk.getSessionData();
        expect(firstSession).toContain('TrackName: Replay Test Track');
        expect(sdk.currDataVersion).toBe(1);

        await sendCommand(publisher, 'next');
        expect(sdk.waitForData(1000)).toBe(true);
        expect(floatValue(sdk.getTelemetryData().Speed.value)).toBeCloseTo(52);
        expect(sdk.getSessionData()).toContain('SessionNum: 0');
        expect(sdk.currDataVersion).toBe(2);

        await sendCommand(publisher, 'next');
        await output.waitFor(/DONE 3/);
        expect(sdk.waitForData(100)).toBe(false);
        expect(sdk.isRunning()).toBe(false);
      } catch (error) {
        throw new Error(
          `${String(error)}\nPublisher output:\n${output.all()}`,
          { cause: error }
        );
      } finally {
        sdk.stopSDK();
      }
    }
  );
});
