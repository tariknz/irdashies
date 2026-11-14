import { describe, expect, it } from 'vitest';
import { CLIO_PIT_PROFILE, type PitServiceProfile } from '@irdashies/types';
import { estimatePitService, pitServiceOptions } from './serviceEstimate';

const withFuelUse: PitServiceProfile = { ...CLIO_PIT_PROFILE, fuelPerLap: 2 };

const stop = { kind: 'pit' as const, stallTime: 100, fastRepairs: 0 };

const estimate = (
  stallSeconds: number,
  {
    driverChanged = false,
    stintLaps = 0,
    profile = CLIO_PIT_PROFILE as PitServiceProfile | null,
    stopOverrides = {},
  } = {}
) =>
  estimatePitService({
    stop: { ...stop, ...stopOverrides },
    stallSeconds,
    driverChanged,
    stintLaps,
    profile: profile ?? undefined,
  });

describe('pitServiceOptions', () => {
  it('splits a stop between tyres and fuel', () => {
    const options = pitServiceOptions(60, CLIO_PIT_PROFILE);
    expect(options.map((option) => option.label)).toEqual([
      'Fuel 59 L',
      'Fuel 37 L + front tyres',
      'Fuel 37 L + rear tyres',
      'Fuel 20 L + 4 tyres',
    ]);
  });

  it('treats a stop the length of a tyre change as tyres only', () => {
    const labels = pitServiceOptions(40.8, CLIO_PIT_PROFILE).map(
      (option) => option.label
    );
    expect(labels).toContain('4 tyres only');
  });

  it('rules out more fuel than the tank holds', () => {
    const options = pitServiceOptions(78, CLIO_PIT_PROFILE);
    expect(options.some((option) => option.tyres === null)).toBe(false);
    expect(options.map((option) => option.label)).toContain(
      'Fuel 37 L + 4 tyres'
    );
  });

  it('skips tyre changes the car does not offer', () => {
    const labels = pitServiceOptions(30, CLIO_PIT_PROFILE).map(
      (option) => option.label
    );
    expect(labels.some((label) => label.includes('left'))).toBe(false);
  });
});

describe('estimatePitService', () => {
  it('matches the Clio table for fuel and four tyres', () => {
    const result = estimate(78, { stintLaps: 18, profile: withFuelUse });
    expect(result.label).toBe('Fuel 37 L + 4 tyres');
    expect(result.confident).toBe(true);
  });

  it('uses the stint length to choose between fuel and tyres', () => {
    // 60 s fits ~59 L alone or ~37 L with an axle. 18 laps at 2 L is 36 L.
    const result = estimate(60, { stintLaps: 18, profile: withFuelUse });
    expect(result.best?.tyres).toBe('front');
    expect(result.alternatives.map((option) => option.tyres)).toContain('rear');
  });

  it('is not confident without a fuel use to compare with', () => {
    expect(estimate(60).confident).toBe(false);
  });

  it('reports a swap with no longer service as a driver change', () => {
    const result = estimate(29, { driverChanged: true });
    expect(result.kind).toBe('driver-change');
    expect(result.label).toBe('Driver change');
  });

  it('reads the service behind a swap when the stop runs longer', () => {
    const result = estimate(78, {
      driverChanged: true,
      stintLaps: 18,
      profile: withFuelUse,
    });
    expect(result.label).toBe('Driver change, Fuel 37 L + 4 tyres');
  });

  it('names drive-throughs, tows and empty stops', () => {
    expect(estimate(0, { stopOverrides: { stallTime: null } }).label).toBe(
      'Drive-through'
    );
    expect(estimate(90, { stopOverrides: { kind: 'tow' } }).kind).toBe('tow');
    expect(estimate(1.5).kind).toBe('no-service');
  });

  it('flags a fast repair and drops confidence', () => {
    const result = estimate(78, {
      stintLaps: 18,
      profile: withFuelUse,
      stopOverrides: { fastRepairs: 1 },
    });
    expect(result.label).toMatch(/^Fast repair, /);
    expect(result.confident).toBe(false);
  });

  it('gives a plain label for a car with no profile', () => {
    const result = estimate(60, { profile: null });
    expect(result.kind).toBe('unknown');
    expect(result.best).toBeNull();
  });
});
