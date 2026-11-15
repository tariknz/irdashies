import { expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { RendererHeapSampler } from './rendererHeapSampler';

const windowFor = (options: {
  id: number;
  pid: number;
  url: string;
  attached?: boolean;
  heap?: { usedSize: number; totalSize: number };
}) => {
  let attached = options.attached ?? false;
  const debuggerApi = {
    isAttached: vi.fn(() => attached),
    attach: vi.fn(() => {
      attached = true;
    }),
    detach: vi.fn(() => {
      attached = false;
    }),
    sendCommand: vi.fn(async (method: string) =>
      method === 'Runtime.getHeapUsage' ? (options.heap ?? {}) : {}
    ),
  };
  const webContents = {
    id: options.id,
    isDestroyed: () => false,
    getURL: () => options.url,
    getOSProcessId: () => options.pid,
    debugger: debuggerApi,
  };
  const window = {
    isDestroyed: () => false,
    webContents,
  } as unknown as BrowserWindow;
  return { window, debuggerApi };
};

it('samples renderer V8 usage and detaches only its own debugger targets', async () => {
  const overlay = windowFor({
    id: 2,
    pid: 20,
    url: 'http://localhost:5173/#/overlay-widget',
    heap: { usedSize: 40 * 1024 * 1024, totalSize: 80 * 1024 * 1024 },
  });
  const devtoolsOwned = windowFor({
    id: 3,
    pid: 30,
    url: 'http://localhost:5173/#/settings',
    attached: true,
  });
  const inspector = windowFor({
    id: 4,
    pid: 40,
    url: 'http://localhost:5173/#/ibt-inspector',
  });
  const tapeReplay = windowFor({
    id: 5,
    pid: 50,
    url: 'http://localhost:5173/#/tape-replay',
  });
  const sampler = new RendererHeapSampler(() => [
    overlay.window,
    devtoolsOwned.window,
    inspector.window,
    tapeReplay.window,
  ]);

  expect(sampler.start()).toEqual({ attachedTargets: 1, skippedTargets: 1 });
  expect(overlay.debuggerApi.attach).toHaveBeenCalledWith('1.3');
  expect(devtoolsOwned.debuggerApi.attach).not.toHaveBeenCalled();
  expect(inspector.debuggerApi.attach).not.toHaveBeenCalled();
  expect(tapeReplay.debuggerApi.attach).not.toHaveBeenCalled();
  await expect(sampler.sample()).resolves.toEqual([
    {
      key: '20:2',
      pid: 20,
      route: '/overlay-widget',
      usedHeapMB: 40,
      totalHeapMB: 80,
    },
  ]);
  await sampler.collectGarbageAndSample();
  await sampler.collectGarbageAndSample();
  expect(
    overlay.debuggerApi.sendCommand.mock.calls.map(([method]) => method)
  ).toEqual([
    'Runtime.getHeapUsage',
    'HeapProfiler.enable',
    'HeapProfiler.collectGarbage',
    'Runtime.getHeapUsage',
    'HeapProfiler.collectGarbage',
    'Runtime.getHeapUsage',
  ]);

  sampler.stop();
  expect(overlay.debuggerApi.detach).toHaveBeenCalledOnce();
  expect(devtoolsOwned.debuggerApi.detach).not.toHaveBeenCalled();
});
