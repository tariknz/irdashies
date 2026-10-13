import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const addonPath = path.resolve('build/Release/lmu_tape_node.node');
const tapePath = path.resolve('test-data/telemetry/lmu-session.lmudt');
const available =
  fs.existsSync(addonPath) &&
  fs.existsSync(tapePath) &&
  fs.statSync(tapePath).size > 1024;

describe.skipIf(!available)('LMU recorded frame cadence', () => {
  it('keeps telemetry readable when polling faster than the recording', async () => {
    vi.stubEnv('IRDASHIES_LMU_REPLAY', tapePath);
    vi.stubEnv('IRDASHIES_LMU_REPLAY_SPEED', '0.25');
    vi.stubEnv('IRDASHIES_LMU_REPLAY_LOOP', '0');
    const { LmuSdkNode } = createRequire(import.meta.url)(addonPath) as {
      LmuSdkNode: new () => {
        start(): boolean;
        stop(): boolean;
        read(): { running: boolean; trackName?: string };
      };
    };
    const sdk = new LmuSdkNode();
    try {
      expect(sdk.start()).toBe(true);
      const deadline = performance.now() + 2000;
      let frame = sdk.read();
      while (!frame.running && performance.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5));
        frame = sdk.read();
      }
      expect(frame.running).toBe(true);
      for (let i = 0; i < 20; i += 1) {
        const next = sdk.read();
        expect(next.running).toBe(true);
        expect(next.trackName).toBe(frame.trackName);
      }
    } finally {
      sdk.stop();
      vi.unstubAllEnvs();
    }
  });
});
