import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import { afterAll, describe, expect, it } from 'vitest';
import { createLmuRestPoller } from './poller';
import { createLmuRestData } from './state';
import { createLmuTapeRestTransport } from './tapeTransport';
import { LMU_REST_TASKS } from './tasks';

/**
 * The whole record-and-replay chain, end to end: a tape written by
 * lmu_replay.exe, read back through the replay addon, served to the real
 * poller, and landing in the state the mappers read.
 *
 * Windows only, like the other native specs -- both artefacts come from a gyp
 * target gated on OS=='win'.
 */
const release = path.resolve(process.cwd(), 'build', 'Release');
const exePath = path.join(release, 'lmu_replay.exe');
const addonPath = path.join(release, 'lmu_tape_node.node');
const built = fs.existsSync(exePath) && fs.existsSync(addonPath);
const describeIfBuilt = built ? describe : describe.skip;

let workDir: string | undefined;

afterAll(() => {
  delete process.env.IRDASHIES_LMU_REPLAY;
  delete process.env.IRDASHIES_LMU_REPLAY_SPEED;
  delete process.env.IRDASHIES_LMU_REPLAY_LOOP;
  if (workDir) fs.rmSync(workDir, { recursive: true, force: true });
});

describeIfBuilt('REST over a tape', () => {
  const openTape = () => {
    workDir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'lmu-rest-'));
    const tape = path.join(workDir, 'rest.lmudt');
    execFileSync(exePath, ['fixture', '--output', tape, '--frames', '200'], {
      encoding: 'utf8',
    });
    process.env.IRDASHIES_LMU_REPLAY = tape;
    process.env.IRDASHIES_LMU_REPLAY_SPEED = '100';
    process.env.IRDASHIES_LMU_REPLAY_LOOP = '1';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module_ = require(addonPath) as {
      LmuSdkNode: new () => {
        start(): boolean;
        stop(): boolean;
        read(): { running?: boolean };
        readRest(p: string): string | null;
      };
    };
    const sdk = new module_.LmuSdkNode();
    sdk.start();
    return { sdk, tape };
  };

  it('records REST responses into the tape and serves them back', () => {
    const { sdk } = openTape();
    const deadline = Date.now() + 5000;
    while (
      Date.now() < deadline &&
      sdk.readRest('/rest/strategy/pitstop-estimate') === null
    ) {
      sdk.read();
    }

    const body = sdk.readRest('/rest/strategy/pitstop-estimate');
    sdk.stop();

    expect(body).not.toBeNull();
    expect(JSON.parse(body as string)).toHaveProperty('total');
  });

  it('feeds the real poller, which lands values where the mappers read them', async () => {
    // The point of the whole exercise: a replay goes through the same poller,
    // hashing and parsers a live session does, not a shortcut around them.
    const { sdk } = openTape();
    const deadline = Date.now() + 5000;
    while (
      Date.now() < deadline &&
      sdk.readRest('/rest/garage/UIScreen/RepairAndRefuel') === null
    ) {
      sdk.read();
    }

    const data = createLmuRestData();
    const poller = createLmuRestPoller({
      data,
      transport: createLmuTapeRestTransport(sdk),
      tasks: LMU_REST_TASKS,
    });
    poller.setActive(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    poller.stop();
    sdk.stop();

    expect(data.cells.pitStopTime?.value[0]).toBeTypeOf('number');
    expect(data.cells.repairTime?.value[0]).toBeTypeOf('number');
    // From the pit menu, parsed out of "+30.xx L" -- so the litre path ran.
    expect(data.cells.refuelTarget?.value[0]).toBeGreaterThan(0);
    expect(data.cells.refuelTargetIsVirtualEnergy?.value[0]).toBe(false);
    // Session-targeted, so it also bumped the revision the bridge watches.
    expect(data.session.maxVirtualEnergy).toBe(100);
    expect(data.revision).toBeGreaterThan(0);
  });

  it('reports a path the recording never covered as absent', () => {
    const { sdk } = openTape();
    sdk.read();
    const body = sdk.readRest('/rest/sessions/weather');
    sdk.stop();

    expect(body).toBeNull();
  });
});
