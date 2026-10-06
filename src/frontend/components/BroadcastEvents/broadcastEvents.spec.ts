import { describe, expect, it } from 'vitest';
import { GlobalFlags, IncidentType, type Incident } from '@irdashies/types';
import {
  carEvents,
  demoEvent,
  emptyCarTracker,
  eventFromIncident,
  flagKind,
} from './broadcastEvents';
import type { Standings } from '@irdashies/domain';

const incident = (type: IncidentType) =>
  ({ id: 'a', type, carIdx: 3, carNumber: '7', lapNum: 4 }) as Incident;

describe('eventFromIncident', () => {
  it('maps viewer-facing incidents', () => {
    expect(eventFromIncident(incident(IncidentType.Crash))).toMatchObject({
      kind: 'crash',
      carIdx: 3,
      lap: 4,
    });
    expect(eventFromIncident(incident(IncidentType.BlackFlag))?.kind).toBe(
      'blackFlag'
    );
  });

  it('skips pit entry misses', () => {
    expect(eventFromIncident(incident(IncidentType.PitEntry))).toBe(undefined);
  });
});

describe('flagKind', () => {
  it('fires once when a flag comes out', () => {
    expect(flagKind(0, GlobalFlags.Yellow)).toBe('yellow');
    expect(flagKind(GlobalFlags.Yellow, GlobalFlags.Yellow)).toBe(undefined);
  });

  it('treats a full course caution as its own event', () => {
    expect(flagKind(GlobalFlags.Yellow, GlobalFlags.Caution)).toBe('caution');
    expect(
      flagKind(GlobalFlags.Caution, GlobalFlags.Caution | GlobalFlags.Yellow)
    ).toBe(undefined);
  });
});

describe('demoEvent', () => {
  it('cycles kinds and cars, skipping disabled kinds', () => {
    const enabled = { offTrack: false, yellow: false };
    expect(demoEvent(0, [5, 6], enabled)).toMatchObject({
      kind: 'crash',
      carIdx: 5,
    });
    expect(demoEvent(1, [5, 6], enabled)).toMatchObject({
      kind: 'fastestLap',
      carIdx: 6,
      detail: '1:47.382',
    });
  });

  it('gives field-wide flags no car', () => {
    const only = (kind: string) =>
      Object.fromEntries(
        [
          'crash',
          'offTrack',
          'slowdown',
          'blackFlag',
          'yellow',
          'caution',
          'fastestLap',
          'pitStop',
          'meatball',
          'disqualified',
          'finalLap',
          'checkered',
        ].map((k) => [k, k === kind])
      );
    expect(demoEvent(0, [1], only('caution'))?.carIdx).toBe(undefined);
    expect(demoEvent(0, [1], only('finalLap'))?.carIdx).toBe(undefined);
    expect(demoEvent(0, [1], only('checkered'))?.carIdx).toBe(1);
  });

  it('returns nothing when every kind is off', () => {
    const off = {
      crash: false,
      offTrack: false,
      slowdown: false,
      blackFlag: false,
      yellow: false,
      caution: false,
      fastestLap: false,
      pitStop: false,
      meatball: false,
      disqualified: false,
      finalLap: false,
      checkered: false,
    };
    expect(demoEvent(0, [1], off)).toBe(undefined);
  });
});

describe('flagKind finish flags', () => {
  it('reports the white and checkered flags', () => {
    expect(flagKind(0, GlobalFlags.White)).toBe('finalLap');
    expect(flagKind(GlobalFlags.White, GlobalFlags.Checkered)).toBe(
      'checkered'
    );
  });
});

describe('carEvents', () => {
  const car = (over: Partial<Standings> = {}) =>
    ({
      carIdx: 1,
      lap: 5,
      onPitRoad: false,
      repair: false,
      dnf: false,
      fastestTime: 90,
      carClass: { id: 1 },
      ...over,
    }) as Standings;

  const run = (frames: Partial<Standings>[][], step = 1000) => {
    let tracker = emptyCarTracker();
    const kinds: string[][] = [];
    const details: (string | undefined)[][] = [];
    frames.forEach((frame, i) => {
      const out = carEvents(tracker, frame.map(car), i * step);
      tracker = out.tracker;
      kinds.push(out.events.map((e) => e.kind));
      details.push(out.events.map((e) => e.detail));
    });
    return { kinds, details };
  };

  it('sets a baseline first, so a mid-race open stays quiet', () => {
    const { kinds } = run([[{ repair: true, onPitRoad: true }]]);
    expect(kinds).toEqual([[]]);
  });

  it('times a pit stop from entry to exit', () => {
    const { kinds, details } = run(
      [[{}], [{ onPitRoad: true }], [{ onPitRoad: true }], [{}]],
      10_000
    );
    expect(kinds[3]).toEqual(['pitStop']);
    expect(details[3]).toEqual(['Pit lane 20.0s']);
  });

  it('skips a pit exit whose entry it never saw', () => {
    const { kinds } = run([[{ onPitRoad: true }], [{}]]);
    expect(kinds[1]).toEqual([]);
  });

  it('reports a new class fastest lap, but not the first one', () => {
    const { kinds } = run([
      [{ fastestTime: 0 }],
      [{ fastestTime: 92 }],
      [{ fastestTime: 91 }],
      [{ fastestTime: 91 }],
    ]);
    expect(kinds).toEqual([[], [], ['fastestLap'], []]);
  });

  it('reports a meatball and a disqualification once', () => {
    const { kinds } = run([
      [{}],
      [{ repair: true }],
      [{ repair: true, dnf: true }],
      [{ repair: true, dnf: true }],
    ]);
    expect(kinds).toEqual([[], ['meatball'], ['disqualified'], []]);
  });
});
