import { afterEach, describe, expect, it, vi } from 'vitest';
import { perfMetrics } from './perfMetrics';

const originalBridge = Object.getOwnPropertyDescriptor(
  window,
  'rendererPerfBridge'
);

afterEach(() => {
  vi.restoreAllMocks();
  if (originalBridge) {
    Object.defineProperty(window, 'rendererPerfBridge', originalBridge);
  } else {
    Reflect.deleteProperty(window, 'rendererPerfBridge');
  }
});

describe('renderer measure breakdowns', () => {
  it('records one elapsed duration under the total and breakdown names', () => {
    const recordMeasure = vi.fn();
    Object.defineProperty(window, 'rendererPerfBridge', {
      configurable: true,
      value: { recordMeasure },
    });
    const now = vi
      .spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(12.5);
    const draw = vi.fn(() => 'drawn');

    expect(
      perfMetrics.measure('trackMapAnimationFrame', draw, 'trackMapRafDraw')
    ).toBe('drawn');

    expect(draw).toHaveBeenCalledTimes(1);
    expect(now).toHaveBeenCalledTimes(2);
    expect(recordMeasure.mock.calls).toEqual([
      ['trackMapAnimationFrame', 2.5],
      ['trackMapRafDraw', 2.5],
    ]);
  });

  it('finishes both measures when drawing throws', () => {
    const recordMeasure = vi.fn();
    Object.defineProperty(window, 'rendererPerfBridge', {
      configurable: true,
      value: { recordMeasure },
    });
    vi.spyOn(performance, 'now')
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(11);
    const failure = new Error('draw failed');

    expect(() =>
      perfMetrics.measure(
        'trackMapAnimationFrame',
        () => {
          throw failure;
        },
        'trackMapCommitDraw'
      )
    ).toThrow(failure);
    expect(recordMeasure.mock.calls).toEqual([
      ['trackMapAnimationFrame', 1],
      ['trackMapCommitDraw', 1],
    ]);
  });

  it('bypasses timing when instrumentation is disabled', () => {
    Object.defineProperty(window, 'rendererPerfBridge', {
      configurable: true,
      value: undefined,
    });
    const now = vi.spyOn(performance, 'now');
    const draw = vi.fn(() => 42);

    expect(
      perfMetrics.measure('trackMapAnimationFrame', draw, 'trackMapRafDraw')
    ).toBe(42);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(now).not.toHaveBeenCalled();
  });
});
