import { describe, expect, it } from 'vitest';
import {
  lmuInCar,
  lmuInSession,
  parseLmuGameState,
  readLmuGameStateFailure,
  type LmuGameState,
} from './gameState';
import { mapLmuTelemetry } from './mapTelemetry';
import { fixture } from './rawFixture';

/** The answers recorded from LMU, trimmed to the fields that matter. */
const MONITOR = {
  MultiStintState: 'MONITOR_MENU',
  inControlOfVehicle: true,
  inMonitor: true,
  playerVehicleLoaded: true,
  gamePhase: 'GPHASE_GREEN',
  PitState: 'EXITING',
};
const DRIVING = { ...MONITOR, MultiStintState: 'DRIVING', inMonitor: false };
const PAUSED = { ...MONITOR, MultiStintState: 'PAUSED', inMonitor: false };
const END_OF_RACE_GRACE = {
  ...MONITOR,
  MultiStintState: 'END_OF_RACE_GRACE',
  inMonitor: false,
  gamePhase: 'GPHASE_CHECKERED',
  PitState: 'REQUEST',
  raceFinished: false,
};
const UNAVAILABLE = {
  status: 'unavailable',
  reason: 'Game is not in an active session',
  gameState: 'Setup',
};

describe('parseLmuGameState', () => {
  it('reads the three in-session states', () => {
    expect(parseLmuGameState(DRIVING)).toEqual({ state: 'driving' });
    expect(parseLmuGameState(PAUSED)).toEqual({ state: 'paused' });
    expect(parseLmuGameState(MONITOR)).toEqual({ state: 'monitor' });
  });

  it('reads the grace after the checkered flag as still driving', () => {
    expect(parseLmuGameState(END_OF_RACE_GRACE)).toEqual({ state: 'driving' });
  });

  it('reads the unavailable answer as out of any session', () => {
    expect(parseLmuGameState(UNAVAILABLE)).toEqual({ state: 'notInSession' });
  });

  it('reads a state it does not know as no state, and says what it was', () => {
    // A guess would be wrong one way or the other -- END_OF_RACE_GRACE read
    // as the monitor took a driving player out of the car -- so shared memory
    // decides instead.
    expect(parseLmuGameState({ MultiStintState: 'SPECTATING' })).toEqual({
      state: undefined,
      unrecognised: 'MultiStintState "SPECTATING"',
    });
  });

  it('reads any other answer as no state, never leaving the last one up', () => {
    // A value every time, so the poller writes it over the state before.
    for (const payload of [
      null,
      undefined,
      42,
      'text',
      [],
      {},
      { status: 1 },
      { status: 'loading' },
    ]) {
      const parsed = parseLmuGameState(payload);
      expect(parsed.state).toBeUndefined();
      expect(parsed.unrecognised).toBeTruthy();
    }
    expect(parseLmuGameState(undefined).unrecognised).toBe(
      'answer that is not JSON'
    );
    expect(parseLmuGameState({ status: 'loading' }).unrecognised).toBe(
      'answer with status'
    );
  });
});

describe('readLmuGameStateFailure', () => {
  it('reads a 404 as out of any game', () => {
    expect(readLmuGameStateFailure({ status: 404, body: '' })).toEqual({
      state: 'notInGame',
    });
  });

  it('reads an unavailable body as out of any session, whatever its status', () => {
    expect(
      readLmuGameStateFailure({
        status: 503,
        body: JSON.stringify(UNAVAILABLE),
      })
    ).toEqual({ state: 'notInSession' });
  });

  it('says nothing about any other failure', () => {
    expect(readLmuGameStateFailure({})).toBeUndefined();
    expect(readLmuGameStateFailure({ status: 500, body: '' })).toBeUndefined();
    expect(
      readLmuGameStateFailure({ status: 500, body: '<html>' })
    ).toBeUndefined();
    // An in-session body on an error status is not believed.
    expect(
      readLmuGameStateFailure({ status: 500, body: JSON.stringify(DRIVING) })
    ).toBeUndefined();
  });
});

describe('lmuInSession and lmuInCar', () => {
  it.each<[LmuGameState, boolean, boolean]>([
    ['driving', true, true],
    ['paused', true, true],
    ['monitor', true, false],
    ['notInSession', false, false],
    ['notInGame', false, false],
  ])('%s: in session %s, in the car %s', (state, inSession, inCar) => {
    expect(lmuInSession(state)).toBe(inSession);
    expect(lmuInCar(state)).toBe(inCar);
  });
});

describe('mapLmuTelemetry with a game state', () => {
  const map = (
    raw: ReturnType<typeof fixture>,
    gameState: LmuGameState | undefined,
    dataFrozen?: boolean
  ) =>
    mapLmuTelemetry(
      raw,
      undefined,
      undefined,
      undefined,
      undefined,
      dataFrozen,
      undefined,
      gameState
    );

  it('puts the player in the car while driving or paused', () => {
    const raw = fixture();
    for (const state of ['driving', 'paused'] as const) {
      const telemetry = map(raw, state);
      expect(telemetry.IsOnTrack.value[0]).toBe(true);
      expect(telemetry.LmuDataStale?.value[0]).toBe(false);
    }
  });

  it('keeps the session live but the player out of the car at the monitor', () => {
    const telemetry = map(fixture(), 'monitor');
    expect(telemetry.IsOnTrack.value[0]).toBe(false);
    expect(telemetry.LmuDataStale?.value[0]).toBe(false);
  });

  it('says the player is out of the car whenever the sim does', () => {
    // The live case: at the monitor, the car left in the pit lane, shared
    // memory still updating. The pit flags stay as reported, and the
    // out-of-car flag is what keeps the driving gate off.
    const raw = fixture();
    raw.vehInPits[raw.playerVehicleIdx] = 1;
    const monitor = map(raw, 'monitor', false);
    expect(monitor.LmuOutOfCar?.value[0]).toBe(true);
    expect(monitor.LmuDataStale?.value[0]).toBe(false);
    expect(monitor.OnPitRoad.value[0]).toBe(true);

    for (const state of ['notInSession', 'notInGame'] as const) {
      expect(map(fixture(), state).LmuOutOfCar?.value[0]).toBe(true);
    }
    for (const state of ['driving', 'paused'] as const) {
      expect(map(fixture(), state).LmuOutOfCar?.value[0]).toBe(false);
    }
    // Unknown is not out: shared memory decides then, frozen or not.
    expect(map(fixture(), undefined).LmuOutOfCar?.value[0]).toBe(false);
    expect(map(fixture(), undefined, true).LmuOutOfCar?.value[0]).toBe(false);
  });

  it('lets a frozen block mark the frame stale at the monitor', () => {
    // A session that ended with the player's car in the pit lane: the last
    // frame keeps `OnPitRoad`, which the driving gate reads as driving unless
    // the frame is stale.
    const raw = fixture();
    raw.vehInPits[raw.playerVehicleIdx] = 1;
    const telemetry = map(raw, 'monitor', true);
    expect(telemetry.OnPitRoad.value[0]).toBe(true);
    expect(telemetry.LmuDataStale?.value[0]).toBe(true);
    // In the car the sim's word still stands over the freeze.
    expect(map(raw, 'driving', true).LmuDataStale?.value[0]).toBe(false);
  });

  it('marks the frame stale outside a session or a game', () => {
    for (const state of ['notInSession', 'notInGame'] as const) {
      const telemetry = map(fixture(), state);
      expect(telemetry.IsOnTrack.value[0]).toBe(false);
      expect(telemetry.LmuDataStale?.value[0]).toBe(true);
    }
  });

  it('decides over the shared-memory inferences it replaces', () => {
    // A paused session stops the writes, so the freeze watch calls it frozen;
    // the sim says the player is still in the car.
    const paused = map(fixture(), 'paused', true);
    expect(paused.IsOnTrack.value[0]).toBe(true);
    expect(paused.LmuDataStale?.value[0]).toBe(false);

    // And a snapshot still claiming realtime is out of the car at the monitor.
    const raw = fixture();
    expect(raw.inRealtime).toBe(true);
    expect(map(raw, 'monitor').IsOnTrack.value[0]).toBe(false);
  });

  it('still needs a player slot to be in the car', () => {
    const raw = { ...fixture(), playerHasVehicle: false, playerVehicleIdx: -1 };
    expect(map(raw, 'driving').IsOnTrack.value[0]).toBe(false);
  });

  it('flags out of a session only on the sim saying so', () => {
    // Outside a game is further out of a session still.
    for (const state of ['notInSession', 'notInGame'] as const) {
      expect(map(fixture(), state).LmuNotInSession?.value[0]).toBe(true);
    }
    for (const state of ['driving', 'paused', 'monitor', undefined] as const) {
      expect(map(fixture(), state).LmuNotInSession?.value[0]).toBe(false);
    }
    // A frozen block is a guess, and not enough to hide widgets on.
    expect(map(fixture(), undefined, true).LmuNotInSession?.value[0]).toBe(
      false
    );
  });

  it('falls back to shared memory when the sim has not said', () => {
    const raw = fixture();
    expect(map(raw, undefined).IsOnTrack.value[0]).toBe(true);
    expect(map(raw, undefined, true).IsOnTrack.value[0]).toBe(false);
    expect(map(raw, undefined, true).LmuDataStale?.value[0]).toBe(true);
  });
});
