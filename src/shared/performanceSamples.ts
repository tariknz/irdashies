import type { NumericSampleStats } from '@irdashies/types';

export class FixedSampleBuffer {
  private readonly values: Float64Array;
  private writeIndex = 0;
  private sampleCount = 0;

  constructor(size = 2048) {
    this.values = new Float64Array(size);
  }

  add(value: number | undefined): void {
    if (value === undefined || !Number.isFinite(value)) return;

    this.values[this.writeIndex] = value;
    this.writeIndex = (this.writeIndex + 1) % this.values.length;
    if (this.sampleCount < this.values.length) {
      this.sampleCount++;
    }
  }

  summarize(): NumericSampleStats {
    if (this.sampleCount === 0) {
      return {
        count: 0,
        avg: 0,
        min: 0,
        max: 0,
        p1: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const samples = new Float64Array(this.sampleCount);
    if (this.sampleCount < this.values.length) {
      samples.set(this.values.subarray(0, this.sampleCount));
    } else {
      const tailLength = this.values.length - this.writeIndex;
      samples.set(this.values.subarray(this.writeIndex), 0);
      samples.set(this.values.subarray(0, this.writeIndex), tailLength);
    }
    samples.sort();

    let sum = 0;
    for (const sample of samples) {
      sum += sample;
    }

    const percentile = (fraction: number): number => {
      const index = Math.min(
        Math.floor(samples.length * fraction),
        samples.length - 1
      );
      return samples[index];
    };

    return {
      count: samples.length,
      avg: sum / samples.length,
      min: samples[0],
      max: samples[samples.length - 1],
      p1: percentile(0.01),
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
    };
  }

  reset(): void {
    this.writeIndex = 0;
    this.sampleCount = 0;
  }
}
