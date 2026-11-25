import { describe, expect, it } from 'vitest';
import { lmuCorners, lmuTurnLabels } from './lmuTurnLabels';
import type { TrackDrawing } from './trackDrawing';

const CENTRE = { x: 960, y: 540 };
const RADIUS = 400;

const circle: TrackDrawing = {
  active: {
    inside: '',
    outside: '',
    trackPathPoints: Array.from({ length: 513 }, (_, index) => {
      const angle = (index / 512) * 2 * Math.PI;
      return {
        x: CENTRE.x + RADIUS * Math.cos(angle),
        y: CENTRE.y - RADIUS * Math.sin(angle),
      };
    }),
    totalLength: 512,
  },
  startFinish: {},
};

const distanceFromCentre = (point: { x?: number; y?: number }) =>
  Math.hypot((point.x ?? 0) - CENTRE.x, (point.y ?? 0) - CENTRE.y);

describe('lmuTurnLabels', () => {
  it('puts the number outside the bend, at the corner on the lap', () => {
    const [label] = lmuTurnLabels(circle, [{ marker: 0.25 }]);

    expect(label.content).toBe('1');
    expect(distanceFromCentre(label)).toBeGreaterThan(RADIUS + 30);
    expect(distanceFromCentre(label)).toBeLessThan(RADIUS + 70);
    expect(label.x).toBeCloseTo(CENTRE.x, 0);
    expect(label.y).toBeLessThan(CENTRE.y - RADIUS);
  });

  it('moves a label aside rather than over the one before it', () => {
    const [first, second] = lmuTurnLabels(circle, [
      { marker: 0.25 },
      { marker: 0.252 },
    ]);

    expect(
      Math.hypot(
        (first.x ?? 0) - (second.x ?? 0),
        (first.y ?? 0) - (second.y ?? 0)
      )
    ).toBeGreaterThan(40);
    expect(distanceFromCentre(second)).toBeGreaterThan(RADIUS);
  });

  it('reads the number from a name that is only a turn number', () => {
    const labels = lmuTurnLabels(circle, [{ name: 'Turn 9', marker: 0.1 }]);

    expect(labels.map((label) => label.content)).toEqual(['9']);
  });

  it('adds the name beside the number, further from the track', () => {
    const labels = lmuTurnLabels(circle, [
      { number: 7, name: 'Parabolica', start: 0.7, end: 0.8 },
    ]);

    expect(labels.map((label) => label.content)).toEqual(['7', 'Parabolica']);
    expect(distanceFromCentre(labels[1])).toBeGreaterThan(
      distanceFromCentre(labels[0])
    );
  });

  it('places a corner across the line between its start and end', () => {
    const [label] = lmuTurnLabels(circle, [{ start: 0.95, end: 0.05 }]);

    expect(label.y).toBeCloseTo(CENTRE.y, 0);
    expect(label.x).toBeGreaterThan(CENTRE.x + RADIUS);
  });

  it('numbers corners in order, skips a name that only repeats the number, and drops a corner with no position', () => {
    const labels = lmuTurnLabels(circle, [
      { name: 'T1', marker: 0.1 },
      { name: 'Turn 2' },
      { name: 'Turn 3', marker: 0.3 },
    ]);

    expect(labels.map((label) => label.content)).toEqual(['1', '3']);
  });

  it('gives nothing for a drawing without a path', () => {
    expect(
      lmuTurnLabels({ active: { inside: '', outside: '' }, startFinish: {} }, [
        { marker: 0.5 },
      ])
    ).toEqual([]);
  });
});

describe('lmuCorners', () => {
  it('finds the corners of LMU tracks in either dataset', () => {
    expect(lmuCorners('Circuit de la Sarthe').length).toBeGreaterThan(0);
    expect(
      lmuCorners('WeatherTech Raceway Laguna Seca').length
    ).toBeGreaterThan(0);
  });

  it('gives nothing for a track it does not know', () => {
    expect(lmuCorners('Unknown Test Circuit')).toEqual([]);
    expect(lmuCorners(undefined)).toEqual([]);
  });
});
