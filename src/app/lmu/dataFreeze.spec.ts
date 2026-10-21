import { describe, expect, it } from 'vitest';
import { FREEZE_AFTER_MS, createLmuDataFreeze } from './dataFreeze';
import { mapLmuTelemetry } from './mapTelemetry';
import { fixture } from './rawFixture';

describe('createLmuDataFreeze', () => {
  it('is not frozen while the sim is writing', () => {
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 1, currentET: 10 }, 0);
    expect(freeze.observe({ scoringUpdates: 2, currentET: 10.2 }, 1000)).toBe(
      false
    );
    expect(freeze.observe({ scoringUpdates: 3, currentET: 10.4 }, 5000)).toBe(
      false
    );
  });

  it('freezes once nothing has moved for the grace period', () => {
    // What ending a practice session looks like: the block stays readable and
    // stops being written.
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 9, currentET: 500 }, 0);
    expect(freeze.observe({ scoringUpdates: 9, currentET: 500 }, 1999)).toBe(
      false
    );
    expect(
      freeze.observe({ scoringUpdates: 9, currentET: 500 }, FREEZE_AFTER_MS)
    ).toBe(true);
  });

  it('does not freeze a paused session the sim is still writing', () => {
    // The clock standing still is not enough. A session held in the garage has
    // a still clock and a live sim, and only the counter tells them apart.
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 9, currentET: 500 }, 0);
    expect(freeze.observe({ scoringUpdates: 10, currentET: 500 }, 3000)).toBe(
      false
    );
    expect(freeze.observe({ scoringUpdates: 11, currentET: 500 }, 9000)).toBe(
      false
    );
  });

  it('freezes on a still counter even if the clock is absent', () => {
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 4 }, 0);
    expect(freeze.observe({ scoringUpdates: 4 }, 2500)).toBe(true);
  });

  it('thaws on the first write after a freeze', () => {
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 1, currentET: 5 }, 0);
    expect(freeze.observe({ scoringUpdates: 1, currentET: 5 }, 3000)).toBe(
      true
    );
    expect(freeze.observe({ scoringUpdates: 2, currentET: 5.2 }, 3100)).toBe(
      false
    );
  });

  it('reports the transition once, not on every observation', () => {
    // So the log carries one line per boundary rather than one per tick.
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 1 }, 0);
    freeze.observe({ scoringUpdates: 1 }, 3000);
    expect(freeze.justChanged()).toBe(true);
    freeze.observe({ scoringUpdates: 1 }, 3100);
    expect(freeze.justChanged()).toBe(false);
    expect(freeze.frozen()).toBe(true);
  });

  it('does not freeze on its very first observation', () => {
    // Nothing has had a chance to move yet, whatever the clock says.
    const freeze = createLmuDataFreeze();
    expect(freeze.observe({ scoringUpdates: 7, currentET: 1 }, 1_000_000)).toBe(
      false
    );
  });

  it('starts over after a reset', () => {
    const freeze = createLmuDataFreeze();
    freeze.observe({ scoringUpdates: 1 }, 0);
    freeze.observe({ scoringUpdates: 1 }, 3000);
    expect(freeze.frozen()).toBe(true);
    freeze.reset();
    expect(freeze.frozen()).toBe(false);
    expect(freeze.observe({ scoringUpdates: 1 }, 3100)).toBe(false);
  });
});

describe('mapLmuTelemetry while frozen', () => {
  it('reports the player out of the car, despite a realtime snapshot', () => {
    // The live case: ending a practice session leaves mInRealtime true and a
    // valid player slot in a block the sim has stopped writing, so every
    // widget gated on IsOnTrack stayed on screen.
    const raw = fixture();
    expect(raw.inRealtime).toBe(true);
    expect(mapLmuTelemetry(raw).IsOnTrack.value[0]).toBe(true);

    const frozen = mapLmuTelemetry(
      raw,
      undefined,
      undefined,
      undefined,
      undefined,
      true
    );
    expect(frozen.IsOnTrack.value[0]).toBe(false);
    expect(frozen.IsInGarage.value[0]).toBe(false);
    expect(frozen.IsGarageVisible.value[0]).toBe(false);
  });

  it('counts the ignition as being in the car before realtime begins', () => {
    // The other half of TinyPedal's OR: sitting in the car with the engine on
    // and the session not yet live is still being in the car.
    const raw = { ...fixture(), inRealtime: false, ignitionStarter: 1 };
    expect(mapLmuTelemetry(raw).IsOnTrack.value[0]).toBe(true);
  });

  it('reports out of the car with neither realtime nor ignition', () => {
    const raw = { ...fixture(), inRealtime: false, ignitionStarter: 0 };
    expect(mapLmuTelemetry(raw).IsOnTrack.value[0]).toBe(false);
  });
});
