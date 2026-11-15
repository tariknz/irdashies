import { afterEach, expect, it } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectLiveTape } from './importIbt';
let directory: string | undefined;
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
it('reads native live recordings and rejects incomplete records before playback', async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'live-tape-'));
  const file = path.join(directory, 'live.irdt');
  const header = Buffer.alloc(96 + 112 + 144);
  header.write('IRDTRCE\0');
  header.writeUInt32LE(1, 8);
  header.writeUInt32LE(96, 16);
  header.writeUInt32LE(112, 20);
  header.writeUInt32LE(144, 24);
  header.writeUInt32LE(1, 28);
  header.writeBigUInt64LE(1000n, 40);
  header.writeInt32LE(60, 104);
  header.write('Speed', 96 + 112 + 16);
  const frame = Buffer.alloc(44);
  frame.writeUInt32LE(1);
  frame.writeUInt32LE(40, 4);
  frame.writeUInt32LE(4, 8);
  frame.writeBigUInt64LE(1000n, 16);
  const end = Buffer.alloc(40);
  end.writeUInt32LE(5);
  end.writeUInt32LE(40, 4);
  end.writeBigUInt64LE(2000n, 16);
  await writeFile(file, Buffer.concat([header, frame, end]));
  expect(await inspectLiveTape(file)).toMatchObject({
    format: 'irdt',
    frames: 1,
    durationSeconds: 2,
    tickRate: 60,
    variables: ['Speed'],
  });
  await writeFile(file, Buffer.concat([header, frame]));
  await expect(inspectLiveTape(file)).rejects.toThrow('unfinished');
  await writeFile(file, Buffer.concat([header, frame.subarray(0, 42)]));
  await expect(inspectLiveTape(file)).rejects.toThrow(
    'Invalid live telemetry record'
  );
});
