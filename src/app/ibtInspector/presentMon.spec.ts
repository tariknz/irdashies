import { expect, it, vi } from 'vitest';
import { PresentMonFrames } from './presentMon';
vi.mock('../perfMetrics', () => ({ getActivePerfMetrics: () => null }));

it('computes frame time and lows from the slowest frames of the main swap chain', () => {
  const frames = new PresentMonFrames();
  frames.accept(
    'Application,ProcessID,SwapChainAddress,MsBetweenPresents,MsCPUBusy,MsGPUTime'
  );
  for (let i = 0; i < 100; i++)
    frames.accept(`iRacingSim64DX11.exe,1,0x1,${i < 5 ? 50 : 10},4,8`);
  frames.accept('iRacingSim64DX11.exe,1,0x2,100,40,80');
  frames.accept('other.exe,2,0x3,1000,400,800');
  const sample = frames.sample();
  expect(sample?.frames).toBe(100);
  expect(sample?.frameTimeMs).toBe(12);
  expect(sample?.fps).toBeCloseTo(83.333);
  expect(sample?.low5Fps).toBe(20);
  expect(sample?.low1Fps).toBe(20);
  expect(sample?.p95FrameTimeMs).toBe(10);
  expect(sample?.p99FrameTimeMs).toBe(50);
  expect(sample?.cpuBusyMs).toBe(4);
  expect(sample?.gpuTimeMs).toBe(8);
  expect(frames.sample()).toBeNull();
});

it('handles older CSV fields, missing timings, invalid durations and small samples', () => {
  const frames = new PresentMonFrames();
  frames.accept('Application,ProcessID,SwapChainAddress,msBetweenPresents');
  for (const value of ['NA', '0', '-1', 'Infinity'])
    frames.accept(`iRacingSim64DX11.exe,1,0,${value}`);
  expect(frames.sample()).toBeNull();
  frames.accept('"iRacingSim64DX11.exe",1,0,20');
  expect(frames.sample()).toMatchObject({
    fps: 50,
    low5Fps: null,
    low1Fps: null,
    cpuBusyMs: null,
    gpuTimeMs: null,
  });
});

it('labels older 2.x CPU frame cadence separately from presented FPS', () => {
  const frames = new PresentMonFrames();
  frames.accept(
    'Application,ProcessID,SwapChainAddress,FrameTime,CPUBusy,GPUTime'
  );
  frames.accept('iRacingSim64DX11.exe,1,0,10,3,7');
  expect(frames.sample()).toMatchObject({
    timingSource: 'cpu-frame',
    fps: 100,
    cpuBusyMs: 3,
    gpuTimeMs: 7,
  });
});
