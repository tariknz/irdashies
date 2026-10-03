import { describe, expect, it } from 'vitest';
import { TrackLocation, type RadarHazard } from '@irdashies/types';
import { RADAR_HAZARD_MAX_M, RadarHazardTracker } from './radarHazards';

const TRACK_M = 4000;
const HZ = 25;

/**
 * A small field on a 4 km lap: we (car 0) and car 1 drive on, car 2 runs
 * ahead of us with whatever speed and surface `script` gives it.
 */
class Field {
  readonly tracker = new RadarHazardTracker();
  time = 0;
  pcts = [0, 0.5, 0.05];
  speeds = [50, 50, 50];
  surfaces = [
    TrackLocation.OnTrack,
    TrackLocation.OnTrack,
    TrackLocation.OnTrack,
  ];
  onPitRoad = [false, false, false];
  quiet = false;
  last: RadarHazard[] = [];

  constructor() {
    this.tracker.setTrackLength(TRACK_M);
  }

  run(seconds: number, car2?: { speed?: number; surface?: TrackLocation }) {
    if (car2?.speed !== undefined) this.speeds[2] = car2.speed;
    if (car2?.surface !== undefined) this.surfaces[2] = car2.surface;
    for (let tick = 0; tick < seconds * HZ; tick += 1) {
      this.time += 1 / HZ;
      for (let car = 0; car < this.pcts.length; car += 1) {
        this.pcts[car] = (this.pcts[car] + this.speeds[car] / HZ / TRACK_M) % 1;
      }
      this.last = this.tracker.update({
        time: this.time,
        focus: 0,
        playerPct: this.pcts[0],
        pcts: this.pcts,
        speeds: this.speeds,
        surfaces: this.surfaces,
        onPitRoad: this.onPitRoad,
        excluded: new Set(),
        quiet: this.quiet,
      });
    }
    return this.last;
  }

  /** Every car laps a few times, so the whole profile is learnt. */
  learnLaps(laps: number) {
    this.run((laps * TRACK_M) / 50);
  }
}

describe('RadarHazardTracker', () => {
  it('reports nothing while the field drives normally', () => {
    const field = new Field();
    expect(field.run(10)).toEqual([]);
  });

  it('calls a sudden stop a crash, with its distance ahead', () => {
    const field = new Field();
    field.run(5);
    const hazards = field.run(0.5, { speed: 2 });
    expect(hazards).toHaveLength(1);
    expect(hazards[0]).toMatchObject({ carIdx: 2, kind: 'crash', speed: 2 });
    expect(hazards[0].dist).toBeGreaterThan(150);
    expect(hazards[0].dist).toBeLessThan(250);
  });

  it('ignores a single slow reading', () => {
    const field = new Field();
    field.run(5);
    field.run(0.1, { speed: 2 });
    expect(field.run(1, { speed: 50 })).toEqual([]);
  });

  it('judges slow against what the field does at that spot', () => {
    const field = new Field();
    field.learnLaps(3);
    expect(field.tracker.expectedSpeed(field.pcts[2])).toBeCloseTo(50, 0);
    // Gradually down to 25 m/s: no sudden drop, but half the field's speed.
    for (let speed = 45; speed >= 25; speed -= 5) field.run(1, { speed });
    expect(field.run(1.5)).toEqual([
      expect.objectContaining({ carIdx: 2, kind: 'slow' }),
    ]);
  });

  it('leaves a moderately slow car alone until the profile is learnt', () => {
    const field = new Field();
    for (let speed = 45; speed >= 25; speed -= 5) field.run(1, { speed });
    expect(field.run(2)).toEqual([]);
  });

  it('clears once the car is back up to speed', () => {
    const field = new Field();
    field.run(5);
    expect(field.run(2, { speed: 0 })).toHaveLength(1);
    expect(field.run(0.2, { speed: 50 })).toEqual([]);
  });

  it('shows an excursion, then the rejoin, then nothing', () => {
    const field = new Field();
    field.run(5);
    expect(field.run(0.3, { surface: TrackLocation.OffTrack })).toEqual([]);
    expect(field.run(0.5)[0]?.kind).toBe('off');
    expect(
      field.run(1, { surface: TrackLocation.OnTrack, speed: 10 })[0]?.kind
    ).toBe('rejoin');
    expect(field.run(0.5, { speed: 50 })).toEqual([]);
  });

  it('does not count a quick dip over the kerb', () => {
    const field = new Field();
    field.run(5);
    field.run(0.2, { surface: TrackLocation.OffTrack });
    expect(field.run(1, { surface: TrackLocation.OnTrack })).toEqual([]);
  });

  it('forgets a car that goes to the pits', () => {
    const field = new Field();
    field.run(5);
    field.run(2, { speed: 0 });
    field.onPitRoad[2] = true;
    expect(field.run(0.1)).toEqual([]);
  });

  it('stays quiet under a full-course caution', () => {
    const field = new Field();
    field.run(5);
    field.quiet = true;
    expect(field.run(2, { speed: 0 })).toEqual([]);
  });

  it('does not flag the field still at pace speed when the green comes', () => {
    const field = new Field();
    field.learnLaps(3);
    field.quiet = true;
    field.speeds = [25, 25, 25];
    field.run(10);
    field.quiet = false;
    expect(field.run(2)).toEqual([]);
    field.speeds = [50, 50, 50];
    expect(field.run(5)).toEqual([]);
  });

  it('still reports a car stalled after the green', () => {
    const field = new Field();
    field.speeds[0] = 10;
    field.quiet = true;
    field.run(10, { speed: 0 });
    field.quiet = false;
    expect(field.run(7).map((h) => h.kind)).toEqual(['crash']);
  });

  it('only reports cars within range ahead', () => {
    const field = new Field();
    field.pcts[2] = (RADAR_HAZARD_MAX_M + 200) / TRACK_M;
    field.run(5);
    expect(field.run(2, { speed: 0 })).toEqual([]);
  });

  it('judges nobody while speeds settle', () => {
    const field = new Field();
    field.run(5);
    field.speeds[2] = 0;
    const hazards = field.tracker.update({
      time: field.time + 2,
      focus: 0,
      playerPct: field.pcts[0],
      pcts: field.pcts,
      speeds: field.speeds,
      surfaces: field.surfaces,
      onPitRoad: field.onPitRoad,
      excluded: new Set(),
      settling: true,
      quiet: false,
    });
    expect(hazards).toEqual([]);
  });
});
