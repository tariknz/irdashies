// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  frameDistribution,
  parseGameCsv,
  summarizeGameFrames,
} from './analyze-game';

const header =
  'Application,ProcessID,SwapChainAddress,TimeInSeconds,MsBetweenPresents,MsBetweenDisplayChange,PresentMode,FrameType';
const row = (
  time: number,
  present: string | number,
  display: string | number = 'NA',
  swap = 'main'
) =>
  `iRacingSim64DX11.exe,1,${swap},${time},${present},${display},Composed: Flip,Application`;

describe('PresentMon game-frame analysis', () => {
  it('parses quoted CSV fields, escaped quotes, BOM and Windows newlines', () => {
    const data = parseGameCsv(
      '\uFEFF' + header + ',Note\r\n' + row(0, 10) + ',"a, ""quoted"" note"\r\n'
    );
    expect(data[0].Note).toBe('a, "quoted" note');
  });

  it('does not turn unavailable display intervals into zero-time frames', () => {
    const result = summarizeGameFrames(
      [header, row(0, 10), row(0.01, 10, 20), row(0.02, 10)].join('\n'),
      { startSeconds: 0, endSeconds: 0.03 }
    );
    expect(result.present?.meanFps).toBe(100);
    expect(result.display?.meanFps).toBe(50);
    expect(result.display?.sampleCount).toBe(1);
    expect(result.displayTimingUnavailableRows).toBe(2);
  });

  it('keeps display stutter distinct from smooth presentation timing', () => {
    const result = summarizeGameFrames(
      [header, row(0, 10, 16), row(0.01, 10, 100), row(0.02, 10, 16)].join(
        '\n'
      ),
      { startSeconds: 0, endSeconds: 0.03 }
    );
    expect(
      result.present?.slowFrames.find((s) => s.thresholdMs === 50)?.count
    ).toBe(0);
    expect(
      result.display?.slowFrames.find((s) => s.thresholdMs === 50)?.count
    ).toBe(1);
  });

  it('uses the dominant game swap chain and excludes warmup/shutdown frames', () => {
    const result = summarizeGameFrames(
      [
        header,
        row(0, 500),
        row(1, 10),
        row(2, 10),
        row(3, 500),
        row(1, 1000, 'NA', 'secondary'),
      ].join('\n'),
      { startSeconds: 1, endSeconds: 3 }
    );
    expect(result.primarySwapChain).toBe('1:main');
    expect(result.frameRows).toBe(2);
    expect(result.present?.maximumMs).toBe(10);
    expect(result.evidence.longEnough).toBe(false);
  });

  it('defines low FPS from the slowest frame tail, separately from p99', () => {
    const result = frameDistribution([...Array<number>(99).fill(10), 100], 10);
    expect(result?.p99Ms).toBe(10);
    expect(result?.p999Ms).toBe(100);
    expect(result?.onePercentLowFps).toBe(10);
    expect(result?.meanFps).toBeCloseTo(1000 / 10.9);
  });

  it('selects the swap chain active in the measured window', () => {
    const result = summarizeGameFrames(
      [
        header,
        ...[0, 0.1, 0.2, 0.3, 0.4].map((time) =>
          row(time, 1000, 'NA', 'retired')
        ),
        row(1, 10),
        row(2, 10),
        row(3, 10),
      ].join('\n'),
      { startSeconds: 1, endSeconds: 3 }
    );
    expect(result.primarySwapChain).toBe('1:main');
    expect(result.present?.meanFps).toBe(100);
    expect(result.captureSpanSeconds).toEqual([1, 3]);
    expect(result.evidence.fullAnalysisWindowAvailable).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity])(
    'rejects a nonfinite window %s',
    (time) => {
      const csv = [header, row(0, 10)].join('\n');
      expect(() =>
        summarizeGameFrames(csv, { startSeconds: time, endSeconds: 10 })
      ).toThrow('Invalid analysis window');
      expect(() =>
        summarizeGameFrames(csv, { startSeconds: 0, endSeconds: time })
      ).toThrow('Invalid analysis window');
    }
  );

  it.each([0, -1, NaN, Infinity])('rejects invalid duration %s', (seconds) => {
    expect(() => frameDistribution([10], seconds)).toThrow(
      'Invalid distribution duration'
    );
  });

  it('reports missing distributions and rejects incompatible input', () => {
    expect(frameDistribution([], 350)).toBeNull();
    expect(() => parseGameCsv('Average FPS\n80')).toThrow('Missing CSV column');
    expect(() => parseGameCsv(header + '\nshort,row')).toThrow('row width');
    expect(() => summarizeGameFrames(header)).toThrow('No target game frames');
  });
});
