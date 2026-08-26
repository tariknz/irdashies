import { describe, it, expect } from 'vitest';
import { StandingsProcessor } from './StandingsProcessor';
import {
  classesIn,
  replayThrough,
  toSession,
  type ReplayFixture,
} from '../../testing/replayFixture';
import multiclassRace from '../../../test-data/fixtures/multiclass-road-america.json';

const fixture = multiclassRace as unknown as ReplayFixture;

/**
 * Exercises the processor against a real multiclass field rather than
 * hand-written arrays. Hand-written fixtures only cover the cases the author
 * thought of; a real capture brings the field's actual class layout, position
 * spread and pit state along with it.
 */
/**
 * These two guard the fixture, not the processor: they fail if a fixture is
 * re-cut from a window that no longer contains a real field. They deliberately
 * survive mutations of the processor, which is why they are kept apart from the
 * tests below rather than counted alongside them.
 */
describe('multiclass fixture integrity', () => {
  it('was taken from a window with a real field in it', () => {
    expect(fixture.meta.anonymised).toBe(true);
    expect(classesIn(fixture).sort()).toEqual([
      'Dallara P217',
      'GTP',
      'IMSA23',
    ]);
    expect(fixture.drivers.length).toBeGreaterThan(40);

    // A racing field, not a roster: an entry list can be large while nobody is
    // on track, which makes for a fixture that asserts nothing.
    const onTrack = (
      fixture.frames.at(-1)?.CarIdxTrackSurface as number[]
    ).filter((surface) => surface > -1);
    expect(onTrack.length).toBeGreaterThan(40);
  });

  it('runs forward in time without gaps or resets', () => {
    const times = fixture.frames.map((f) => f.SessionTime as number);

    expect(times.at(-1)).toBeGreaterThan(times[0]);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });
});

describe('StandingsProcessor over a real multiclass capture', () => {
  it('publishes a snapshot for every frame', () => {
    const snapshots = replayThrough(fixture, new StandingsProcessor(), (s) => ({
      ...s,
      carIdxPosition: [...s.carIdxPosition],
      carIdxClassPosition: [...s.carIdxClassPosition],
      carIdxTrackSurface: [...s.carIdxTrackSurface],
      carIdxOnPitRoad: [...s.carIdxOnPitRoad],
    }));

    expect(snapshots).toHaveLength(fixture.meta.frames);
    expect(snapshots.at(-1)?.sessionNum).toBe(fixture.meta.sessionNum);
  });

  it('gives placed cars a unique position and a class position', () => {
    const snapshots = replayThrough(fixture, new StandingsProcessor(), (s) => ({
      ...s,
      carIdxPosition: [...s.carIdxPosition],
      carIdxClassPosition: [...s.carIdxClassPosition],
      carIdxTrackSurface: [...s.carIdxTrackSurface],
    }));
    const last = snapshots.at(-1);
    if (!last) throw new Error('no snapshots');

    // Not every car in the world has a position: the capture includes cars
    // that have joined but not yet been placed, which is why this asserts over
    // placed cars rather than running ones.
    const placed = last.carIdxPosition
      .map((position, carIdx) => ({ position, carIdx }))
      .filter(({ position }) => position > 0);

    expect(placed.length).toBeGreaterThan(30);

    const positions = placed.map((p) => p.position);
    expect(new Set(positions).size).toBe(positions.length);

    for (const { carIdx } of placed) {
      expect(last.carIdxClassPosition[carIdx]).toBeGreaterThan(0);
    }
  });

  it('never reports a class position beyond the size of that class', () => {
    // A regression the hand-written fixtures could not catch: class positions
    // have to stay within their own class, whatever the field looks like.
    const session = toSession(fixture);
    const classSizes = new Map<number, number>();
    for (const driver of session.DriverInfo.Drivers) {
      if (driver.CarIsPaceCar) continue;
      classSizes.set(
        driver.CarClassID,
        (classSizes.get(driver.CarClassID) ?? 0) + 1
      );
    }
    const classByCarIdx = new Map(
      session.DriverInfo.Drivers.map((d) => [d.CarIdx, d.CarClassID])
    );

    const snapshots = replayThrough(fixture, new StandingsProcessor(), (s) => ({
      ...s,
      carIdxClassPosition: [...s.carIdxClassPosition],
      carIdxTrackSurface: [...s.carIdxTrackSurface],
    }));
    const last = snapshots.at(-1);
    if (!last) throw new Error('no snapshots');

    // Without this the loop below passes trivially on an empty snapshot.
    const placed = last.carIdxClassPosition.filter((p) => p > 0);
    expect(placed.length).toBeGreaterThan(30);

    last.carIdxClassPosition.forEach((classPosition, carIdx) => {
      if (classPosition <= 0) return;
      if ((last.carIdxTrackSurface[carIdx] ?? -1) <= -1) return;
      const classId = classByCarIdx.get(carIdx);
      if (classId === undefined) return;
      expect(classPosition).toBeLessThanOrEqual(classSizes.get(classId) ?? 0);
    });
  });
});
