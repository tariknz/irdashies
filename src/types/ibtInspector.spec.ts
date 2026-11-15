import { expect, it } from 'vitest';
import { summarizeIbtInspectorTrend } from './ibtInspector';

it('computes descriptive linear slopes only with enough time-series coverage', () => {
  expect(
    summarizeIbtInspectorTrend([
      { elapsedSeconds: 0, value: 100 },
      { elapsedSeconds: 60, value: 102 },
      { elapsedSeconds: 120, value: 104 },
    ])
  ).toMatchObject({
    points: 3,
    durationSeconds: 120,
    first: 100,
    last: 104,
    delta: 4,
    slopePerMinute: 2,
  });
  expect(
    summarizeIbtInspectorTrend([
      { elapsedSeconds: 0, value: 100 },
      { elapsedSeconds: 60, value: 104 },
    ]).slopePerMinute
  ).toBeNull();
  expect(
    summarizeIbtInspectorTrend([
      { elapsedSeconds: 0, value: 100 },
      { elapsedSeconds: 10, value: 101 },
      { elapsedSeconds: 20, value: 102 },
    ]).slopePerMinute
  ).toBeNull();
});
