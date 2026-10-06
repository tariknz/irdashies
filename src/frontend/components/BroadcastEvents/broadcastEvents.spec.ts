import { describe, expect, it } from 'vitest';
import { GlobalFlags, IncidentType, type Incident } from '@irdashies/types';
import { demoEvent, eventFromIncident, flagKind } from './broadcastEvents';

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
      kind: 'slowdown',
      carIdx: 6,
    });
  });

  it('gives a full course yellow no car', () => {
    expect(demoEvent(4, [1], {})).toMatchObject({
      kind: 'caution',
      carIdx: undefined,
    });
  });

  it('returns nothing when every kind is off', () => {
    const off = {
      crash: false,
      offTrack: false,
      slowdown: false,
      blackFlag: false,
      yellow: false,
      caution: false,
    };
    expect(demoEvent(0, [1], off)).toBe(undefined);
  });
});
