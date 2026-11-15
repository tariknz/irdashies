import { expect, it } from 'vitest';
import { replayWidgetCoverage } from './replayCoverage';

it('distinguishes missing fields, baseline presence and unaudited widgets', () => {
  expect(
    replayWidgetCoverage(
      ['Throttle', 'Brake', 'SteeringWheelAngle'],
      ['input', 'radar', 'new-widget', 'input']
    )
  ).toEqual([
    { widget: 'input', status: 'fields-present', missing: [] },
    {
      widget: 'radar',
      status: 'missing-fields',
      missing: ['CarIdxLapDistPct', 'CarIdxTrackSurface', 'PlayerCarIdx'],
    },
    { widget: 'new-widget', status: 'unknown', missing: [] },
  ]);
});
