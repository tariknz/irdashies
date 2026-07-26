import { describe, expect, it } from 'vitest';
import { FixedSampleBuffer } from './performanceSamples';

describe('FixedSampleBuffer', () => {
  it('summarizes samples and percentiles', () => {
    const buffer = new FixedSampleBuffer(100);
    for (let value = 1; value <= 100; value++) {
      buffer.add(value);
    }

    expect(buffer.summarize()).toEqual({
      count: 100,
      avg: 50.5,
      min: 1,
      max: 100,
      p1: 2,
      p50: 51,
      p95: 96,
      p99: 100,
    });
  });

  it('keeps only the newest samples when full', () => {
    const buffer = new FixedSampleBuffer(3);
    buffer.add(1);
    buffer.add(2);
    buffer.add(3);
    buffer.add(4);

    expect(buffer.summarize()).toMatchObject({
      count: 3,
      avg: 3,
      min: 2,
      max: 4,
    });
  });

  it('resets and ignores non-finite values', () => {
    const buffer = new FixedSampleBuffer();
    buffer.add(Number.NaN);
    buffer.add(Number.POSITIVE_INFINITY);
    buffer.add(10);
    buffer.reset();

    expect(buffer.summarize().count).toBe(0);
  });
});
