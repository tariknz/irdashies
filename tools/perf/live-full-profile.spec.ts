// @vitest-environment node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const script = readFileSync(
  path.join(root, 'tools/perf/live-full-profile.cjs'),
  'utf8'
);

function controller(command = 'run', manifestFailure = false) {
  const out = path.join(root, 'perf-results');
  const files = new Map<string, string>([
    [path.join(out, 'control-addon.node'), 'stale native addon'],
    [path.join(root, 'build/Release/irsdk_node.node'), 'current native addon'],
    [
      path.join(root, '.vite/build/Release/irsdk_node.node'),
      'app native addon',
    ],
    [path.join(out, 'full-profile-seed/config.json'), '{}'],
  ]);
  const state = {
    IsReplayPlaying: 1,
    ReplayPlaySpeed: 0,
    ReplayFrameNum: 129269,
    SessionNum: 2,
    CamCarIdx: 37,
    CamGroupNumber: 9,
    CamCameraNumber: 1,
  };
  if (command === 'run')
    files.set(path.join(out, 'full-start.json'), JSON.stringify(state));
  let rejectSnapshot = false;
  let interval: (() => void) | undefined;
  let stopped!: () => void;
  const done = new Promise<void>((resolve) => {
    stopped = resolve;
  });
  const sdk = {
    startSDK: vi.fn(() => true),
    stopSDK: vi.fn(() => stopped()),
    waitForData: vi.fn(() => {
      if (rejectSnapshot) throw new Error('SDK disconnected');
    }),
    getTelemetryData: () =>
      Object.fromEntries(
        Object.entries(state).map(([key, value]) => [
          key,
          {
            varType: 5,
            value: new Float64Array([value]).buffer,
          },
        ])
      ),
    broadcast: vi.fn((type: number, arg1: number, arg2: number) => {
      if (type === 3) state.ReplayPlaySpeed = arg1;
      if (type === 4) state.ReplayFrameNum = arg2;
    }),
  };
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    pid: 123,
    exitCode: null as number | null,
    kill: vi.fn(),
  });
  const execFileSync = vi.fn((name: string, args: string[]) => {
    if (name === 'git') return 'a'.repeat(40);
    if (name === 'taskkill') {
      expect(args).toEqual(['/pid', '123', '/t', '/f']);
      child.exitCode = 1;
      queueMicrotask(() => child.emit('close', 1));
      return '';
    }
    throw new Error('Unexpected process');
  });
  const spawn = vi.fn(() => child);
  const streams: Writable[] = [];
  const copyFileSync = vi.fn((from: string, to: string) => {
    files.set(to, files.get(from) ?? '');
  });
  const fakeFs = {
    mkdirSync: vi.fn(),
    cpSync: vi.fn(),
    copyFileSync,
    existsSync: (file: string) => files.has(file),
    readFileSync: (file: string) => {
      if (!files.has(file)) throw new Error('File missing');
      return files.get(file) ?? '';
    },
    writeFileSync: (file: string, contents: string) =>
      files.set(file, contents),
    readdirSync: () => {
      if (manifestFailure) throw new Error('Build manifest unavailable');
      return [];
    },
    createWriteStream: (file: string) => {
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          files.set(file, (files.get(file) ?? '') + chunk.toString());
          callback();
        },
      });
      streams.push(stream);
      return stream;
    },
  };
  const fakeProcess = {
    argv: ['node', 'live-full-profile.cjs', command, 'review-test', '420'],
    platform: 'win32',
    version: 'test-node',
    exitCode: undefined as number | undefined,
    stdout: { write: vi.fn() },
    stderr: { write: vi.fn() },
  };
  const clearInterval = vi.fn(() => {
    interval = undefined;
  });
  const context = {
    __dirname: path.join(root, 'tools/perf'),
    process: fakeProcess,
    setTimeout: (callback: () => void) => queueMicrotask(callback),
    setInterval: (callback: () => void) => {
      interval = callback;
      return 1;
    },
    clearInterval,
    require: (name: string) => {
      if (name === 'node:fs') return fakeFs;
      if (name === 'node:path') return path;
      if (name === 'node:crypto') return crypto;
      if (name === 'node:child_process') return { spawn, execFileSync };
      if (name === 'node:stream/promises') return { finished };
      if (name.endsWith('control-addon.node'))
        return {
          iRacingSdkNode: function () {
            return sdk;
          },
        };
      if (name.endsWith('package.json')) return { version: 'test' };
      throw new Error('Unexpected module');
    },
  };
  return {
    files,
    out,
    state,
    sdk,
    child,
    spawn,
    streams,
    fakeProcess,
    done,
    copyFileSync,
    clearInterval,
    execFileSync,
    start: () => vm.runInNewContext(script, context),
    disconnect: () => {
      rejectSnapshot = true;
    },
    tick: () => interval?.(),
    hasInterval: () => interval !== undefined,
    provenance: () =>
      JSON.parse(
        files.get(path.join(out, 'review-test.provenance.json')) ?? 'null'
      ),
  };
}

describe('actual replay capture controller', () => {
  it('refreshes a stale native controller copy before loading the SDK', async () => {
    const c = controller('status');
    c.start();
    await c.done;
    expect(c.files.get(path.join(c.out, 'control-addon.node'))).toBe(
      'current native addon'
    );
    expect(c.copyFileSync).toHaveBeenCalledOnce();
    expect(c.sdk.stopSDK).toHaveBeenCalledOnce();
  });

  it('saves separate original and paused benchmark snapshots', async () => {
    for (const command of ['save-original', 'save-start']) {
      const c = controller(command);
      c.start();
      await c.done;
      const name =
        command === 'save-original' ? 'full-original.json' : 'full-start.json';
      expect(
        JSON.parse(c.files.get(path.join(c.out, name)) ?? 'null')
      ).toMatchObject(c.state);
      expect(c.sdk.broadcast).not.toHaveBeenCalled();
    }
  });

  it('refuses to save a playing benchmark start or overwrite the original', async () => {
    const playing = controller('save-start');
    playing.state.ReplayPlaySpeed = 1;
    playing.start();
    await playing.done;
    expect(playing.fakeProcess.exitCode).toBe(1);
    expect(playing.files.has(path.join(playing.out, 'full-start.json'))).toBe(
      false
    );
    const original = controller('save-original');
    original.files.set(
      path.join(original.out, 'full-original.json'),
      'preserved'
    );
    original.start();
    await original.done;
    expect(
      original.files.get(path.join(original.out, 'full-original.json'))
    ).toBe('preserved');
    expect(original.fakeProcess.exitCode).toBe(1);
  });

  it.each(['manifest', 'timed sample'] as const)(
    'cleans up after a %s failure',
    async (failure) => {
      const c = controller('run', failure === 'manifest');
      c.start();
      await vi.waitFor(() => expect(c.spawn).toHaveBeenCalledOnce());
      expect(() =>
        c.child.stdout.emit('data', Buffer.from('[PerfRunOrigin:JSON] {}'))
      ).not.toThrow();
      if (failure === 'timed sample') {
        expect(c.hasInterval()).toBe(true);
        c.disconnect();
        expect(() => c.tick()).not.toThrow();
      }
      await c.done;
      expect(c.provenance().captureError).toMatch(/manifest|disconnected/);
      expect(c.provenance().ended).toBeDefined();
      expect(c.fakeProcess.exitCode).toBe(1);
      expect(c.hasInterval()).toBe(false);
      expect(c.execFileSync).toHaveBeenCalledWith(
        'taskkill',
        ['/pid', '123', '/t', '/f'],
        { stdio: 'ignore' }
      );
      expect(c.sdk.stopSDK).toHaveBeenCalledOnce();
      expect(c.state.ReplayPlaySpeed).toBe(0);
      expect(c.streams.every((s) => s.writableFinished)).toBe(true);
    }
  );
  it('finishes a successful capture with the controller fingerprint and no kill', async () => {
    const c = controller();
    c.start();
    await vi.waitFor(() => expect(c.spawn).toHaveBeenCalledOnce());
    c.child.stdout.emit('data', Buffer.from('[PerfRunOrigin:JSON] {}'));
    expect(c.hasInterval()).toBe(true);
    c.child.exitCode = 0;
    c.child.emit('close', 0);
    await c.done;
    expect(c.provenance().controllerAddonSha256).toBe(
      crypto.createHash('sha256').update('current native addon').digest('hex')
    );
    expect(c.provenance().exitCode).toBe(0);
    expect(c.provenance().captureError).toBeUndefined();
    expect(c.fakeProcess.exitCode).toBeUndefined();
    expect(
      c.execFileSync.mock.calls.some(([name]) => name === 'taskkill')
    ).toBe(false);
    expect(c.sdk.stopSDK).toHaveBeenCalledOnce();
    expect(c.hasInterval()).toBe(false);
  });

  it('records stream errors and closes the capture instead of orphaning it', async () => {
    const c = controller();
    c.start();
    await vi.waitFor(() => expect(c.spawn).toHaveBeenCalledOnce());
    c.streams[0].emit('error', new Error('Capture disk full'));
    await c.done;
    expect(c.provenance().captureError).toBe('Capture disk full');
    expect(c.fakeProcess.exitCode).toBe(1);
    expect(c.sdk.stopSDK).toHaveBeenCalledOnce();
    expect(c.streams.every((s) => s.writableFinished)).toBe(true);
  });
});
