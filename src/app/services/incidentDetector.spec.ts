import { describe, it, expect } from 'vitest';
import { IncidentDetector } from './incidentDetector';
import type {
  CarIncidentState,
  IncidentThresholds,
} from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import type { Incident } from '../../types/raceControl';
import { TrackLocation, GlobalFlags, SessionState } from '../irsdk/types/enums';

// A short duration that a third consecutive frame clears but a second does
// not, at the 0.04-0.05s steps these fixtures feed. Just under 0.08 so float
// error in the session-time subtraction cannot land the third frame on the
// wrong side of the comparison.
const SHORT_DEBOUNCE_S = 0.07;

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowDurationSeconds: 0.4,
  impactDecelKmhPerSec: 150,
  impactMinSpeed: 20,
  offTrackDurationSeconds: SHORT_DEBOUNCE_S,
  pitEntryDurationSeconds: SHORT_DEBOUNCE_S,
  cooldownSeconds: 5,
};

const makeTelemetry = (
  overrides: Partial<{
    sessionTime: number;
    sessionNum: number;
    sessionState: number;
    replayFrameNum: number;
    carIdxLapDistPct: number[];
    carIdxLap: number[];
    carIdxTrackSurface: number[];
    carIdxSessionFlags: number[];
    carIdxOnPitRoad: boolean[];
  }> = {}
) => ({
  sessionTime: 100,
  sessionNum: 0,
  sessionState: SessionState.Racing,
  replayFrameNum: 6000,
  carIdxLapDistPct: [0.5],
  carIdxLap: [3],
  carIdxTrackSurface: [TrackLocation.OnTrack],
  carIdxSessionFlags: [0],
  carIdxOnPitRoad: [false],
  ...overrides,
});

// A one-car Race session. Detection is no longer gated on session type, so
// this is just a convenient roster rather than a precondition.
const raceSession = () => ({
  SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
  DriverInfo: {
    Drivers: [
      {
        CarIdx: 0,
        UserName: 'Test',
        CarNumber: '99',
        TeamName: '',
        CarIsPaceCar: 0,
      },
    ],
  },
});

/**
 * Drives a car through a speed profile, advancing lapDistPct so the detector
 * derives the speeds given. Speeds are km/h, one per frame. A seed frame is
 * emitted first so there is prev state to measure against.
 */
const drive = (
  detector: IncidentDetector,
  speeds: number[],
  opts: {
    startTime?: number;
    step?: number;
    startPct?: number;
    trackLengthM?: number;
    surface?: number;
  } = {}
) => {
  const step = opts.step ?? 0.05;
  const trackLengthM = opts.trackLengthM ?? 5000;
  const surface = opts.surface ?? TrackLocation.OnTrack;
  let pct = opts.startPct ?? 0.2;
  let t = opts.startTime ?? 100;

  detector.processTelemetry(
    makeTelemetry({
      carIdxLapDistPct: [pct],
      carIdxTrackSurface: [surface],
      sessionTime: t,
    }),
    trackLengthM
  );
  for (const kmh of speeds) {
    pct += ((kmh / 3.6) * step) / trackLengthM;
    t += step;
    detector.processTelemetry(
      makeTelemetry({
        carIdxLapDistPct: [pct],
        carIdxTrackSurface: [surface],
        sessionTime: t,
      }),
      trackLengthM
    );
  }
};

/** A constant-rate deceleration, in km/h per second, sampled every `step`. */
const decelProfile = (
  from: number,
  to: number,
  ratePerSecond: number,
  step = 0.05
) => {
  const speeds: number[] = [];
  for (let v = from; v > to; v -= ratePerSecond * step) speeds.push(v);
  speeds.push(to);
  return speeds;
};

/**
 * Steady frames at `kmh`, prepended to a profile so the speed baseline is
 * populated before the interesting part. Speed is measured across half a
 * second and deceleration across two of those, so a car has no reading at all
 * for its first half second and no deceleration for its first full second.
 */
const warmUp = (kmh: number, seconds = 1.5, step = 0.05) =>
  new Array(Math.ceil(seconds / step)).fill(kmh) as number[];

/**
 * The detector's private car-state map. Reached through a narrow typed view
 * rather than `any`, so a change to CarIncidentState breaks these tests instead
 * of silently passing.
 */
interface DetectorInternals {
  carStates: Map<number, CarIncidentState>;
}
const internals = (detector: IncidentDetector): DetectorInternals =>
  detector as unknown as DetectorInternals;

const seedCarState = (
  overrides: Partial<CarIncidentState> = {}
): CarIncidentState => ({
  prevTrackSurface: TrackLocation.OnTrack,
  prevSessionFlags: 0,
  prevOnPitRoad: false,
  prevLapDistPct: 0,
  prevSessionTime: 0,
  lastPositionChangeSessionTime: 0,
  currentAvgSpeed: 0,
  recentPositions: [],
  recentPeakSpeed: 0,
  impactPendingSince: null,
  slowSinceSessionTime: null,
  offTrackSinceSessionTime: null,
  onPitRoadSinceSessionTime: null,
  pitEntryReported: false,
  offTrackReported: false,
  slowReported: false,
  lastIncidentTime: {},
  hasPrevFrame: false,
  ...overrides,
});

describe('session transitions', () => {
  const makeDrivers = () => ({
    DriverInfo: {
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Test',
          CarNumber: '99',
          TeamName: '',
          CarIsPaceCar: 0,
        },
      ],
    },
  });

  it('clears car states on first updateSession (initial load)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    internals(detector).carStates.set(
      0,
      seedCarState({ slowSinceSessionTime: 5 })
    );
    detector.updateSession({
      WeekendInfo: { SubSessionID: 111 },
      ...makeDrivers(),
    });
    expect(internals(detector).carStates.size).toBe(0);
  });

  it('PRESERVES car states when same session YAML is re-published (no change)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );
    // Seed state via processTelemetry
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    const stateBefore = internals(detector).carStates.get(0);
    expect(stateBefore).toBeDefined();

    // Session YAML re-published with identical SubSessionID + SessionNum
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );

    const stateAfter = internals(detector).carStates.get(0);
    expect(stateAfter).toBe(stateBefore);
    expect(stateAfter?.hasPrevFrame).toBe(true);
  });

  it('RESETS car states when SessionNum changes (phase transition Practice → Race)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0 // Practice
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    expect(internals(detector).carStates.size).toBe(1);

    // Phase change within same SubSessionID
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      2 // Race
    );
    expect(internals(detector).carStates.size).toBe(0);
  });

  it('resets when SessionNum first resolves after the initial YAML update', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const session = { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() };
    detector.updateSession(session);
    detector.processTelemetry(makeTelemetry(), 5000);
    expect(internals(detector).carStates.size).toBe(1);

    detector.updateSession(session, 2);

    expect(internals(detector).carStates.size).toBe(0);
  });

  it('RESETS car states when SubSessionID changes', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 222 }, ...makeDrivers() },
      0
    );
    expect(internals(detector).carStates.size).toBe(0);
  });
});

describe('first-frame speed guard', () => {
  it('does not emit an impact crash on the first processed frame', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(
      {
        WeekendInfo: { SubSessionID: 111 },
        DriverInfo: {
          Drivers: [
            {
              CarIdx: 0,
              UserName: 'Test',
              CarNumber: '99',
              TeamName: '',
              CarIsPaceCar: 0,
            },
          ],
        },
      },
      0
    );

    // Repro of the live bug: prevLapDistPct=0, currLapDistPct=0.5 on a 5km
    // track = 18,000 km/h "speed" on first frame, then real 0 km/h on next
    // tick → previously fired a false impact Crash.
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // Subsequent stationary frames
    for (let i = 1; i < 5; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 + i * 0.04 }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });
});

describe('impact detection', () => {
  it('fires for a car that hits something at speed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Approach at 200, then stopped inside 0.15s. The trailing frames matter:
    // the drop takes a moment to work through the baseline, and the reading
    // must then hold for IMPACT_CONFIRM_S before anything is reported.
    drive(detector, [...warmUp(200), 120, 40, 10, ...new Array(14).fill(5)]);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('impact');
  });

  it('does not fire for threshold braking', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Measured from a real Clio Cup stop: 129 -> 29 km/h at 43 km/h/s (1.2g).
    // The old from/to/window gate reported this as a crash, because those three
    // settings only ever express an average rate and 43 sat above it.
    drive(detector, decelProfile(148, 29, 43));

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });

  it('does not fire for high-downforce braking, which is harder still', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // 2.5g from 250 km/h — about as hard as any car can brake.
    drive(detector, decelProfile(250, 60, 90));

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });

  it('catches an impact after a spin has already scrubbed the speed off', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Spins down to 60, then hits the wall. A from/to/window gate could never
    // see this: peak speed never exceeded its from-speed once the spin began.
    drive(detector, [
      ...warmUp(200),
      ...decelProfile(200, 100, 100),
      50,
      ...new Array(20).fill(2),
    ]);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('impact');
  });

  it('reports a high-speed crash once, not an impact plus a sustained-slow', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Hits the wall at 250, then sits for 8s — past the 5s cooldown. The
    // impact fires at once, but the peak speed has not decayed below the slow
    // threshold by the time the cooldown lapses, so sustained-slow would add a
    // second Crash unless the impact latches it.
    drive(detector, [...warmUp(250), 120, 40, 10, ...new Array(160).fill(0)]);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('impact');
  });

  it('ignores a low-speed nudge below the minimum speed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Sharp stop, but from 18 km/h — under impactMinSpeed of 20.
    drive(detector, [...warmUp(18), 2, 1, ...new Array(14).fill(1)]);

    expect(incidents.filter((i) => i.debug?.trigger === 'impact')).toEqual([]);
  });

  it('does not report an impact gentler than the measurement can resolve', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Speed is averaged across half a second, which smears a short impact.
    // A car stopped from 60 km/h measures about 100 km/h/s, under the 150
    // threshold, so it is not reported as an impact. This is a deliberate
    // floor, not an oversight: a car that hits something below roughly
    // 90 km/h and stays put is reported by sustained-slow instead, and
    // lowering the threshold to reach it would put it inside the range of
    // hard braking in a high-downforce car.
    drive(detector, [...warmUp(60), 30, ...new Array(20).fill(2)]);

    expect(incidents.filter((i) => i.debug?.trigger === 'impact')).toEqual([]);
  });

  it('does not report a crash from a position that lags the session clock', () => {
    // The reported false positive. A car holding a steady speed, where one
    // frame advances sessionTime by 0.0667s but its position by only 0.05s
    // worth of travel - the CarIdx arrays lagging by one 60Hz sim tick.
    // Measured frame to frame this read as 239 km/h/s and fired a crash.
    const run = (kmh: number) => {
      const detector = new IncidentDetector(defaultThresholds, false);
      const incidents: Incident[] = [];
      detector.onIncident((i) => incidents.push(i));
      detector.updateSession(raceSession());

      const trackLengthM = 2336; // the track it was reported on
      let t = 100;
      let pct = 0.1;
      const advance = (clockSeconds: number, travelSeconds: number) => {
        t += clockSeconds;
        pct += ((kmh / 3.6) * travelSeconds) / trackLengthM;
        detector.processTelemetry(
          makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
          trackLengthM
        );
      };

      for (let i = 0; i < 60; i++) advance(0.05, 0.05);
      advance(0.0667, 0.05); // the lagging frame
      for (let i = 0; i < 40; i++) advance(0.05, 0.05);

      return incidents.filter((i) => i.type === IncidentType.Crash);
    };

    expect(run(108)).toEqual([]);
    expect(run(250)).toEqual([]);
  });

  it('does not report a crash when the position lag persists then catches up', () => {
    // The lag here persists for three frames and is then repaid in one step,
    // so the position feed dips and spikes rather than glitching once.
    //
    // Both guards are needed for this to hold: reverting the baseline to a
    // frame-to-frame measurement AND removing the confirm delay makes it fire.
    // Either one alone is enough, because a lag is a step change and a
    // deceleration is a derivative, so the apparent drop only lasts one frame.
    // The baseline is what keeps the noise floor an order of magnitude below
    // the threshold; speedBaseline.spec pins that separately by showing the
    // same glitch exceeds the threshold at a 0.1s baseline and not at 0.5s.
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    const trackLengthM = 2336;
    const kmh = 108;
    let t = 100;
    let pct = 0.1;
    const advance = (clockSeconds: number, travelSeconds: number) => {
      t += clockSeconds;
      pct += ((kmh / 3.6) * travelSeconds) / trackLengthM;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        trackLengthM
      );
    };

    for (let i = 0; i < 60; i++) advance(0.05, 0.05);
    // Three frames where the clock outruns the position by one sim tick each.
    for (let i = 0; i < 3; i++) advance(0.0667, 0.05);
    // The position catches up all of the accumulated debt at once.
    advance(0.05, 0.1);
    for (let i = 0; i < 40; i++) advance(0.05, 0.05);

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });

  it('reports a wall impact in a solo test drive, which never goes green', () => {
    // A test drive has no Race session type and never reaches SessionState
    // Racing. Gating impact on either one disabled crash detection entirely
    // for it, while off-tracks and pit entries carried on working - which is
    // what made the gap hard to spot.
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
      SessionInfo: {
        Sessions: [{ SessionNum: 0, SessionType: 'Offline Testing' }],
      },
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 0,
            UserName: 'Test',
            CarNumber: '99',
            TeamName: '',
            CarIsPaceCar: 0,
          },
        ],
      },
    });

    let t = 100;
    let pct = 0.2;
    const at = (kmh: number) => {
      t += 0.05;
      pct += ((kmh / 3.6) * 0.05) / 5000;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: t,
          sessionState: SessionState.Warmup,
        }),
        5000
      );
    };

    for (let i = 0; i < 40; i++) at(180);
    at(90);
    for (let i = 0; i < 20; i++) at(2);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('impact');
  });

  it('does not report a crash when a car is towed or reset to the pits', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Being lifted and set down elsewhere is not one continuous trajectory.
    // Measuring across the join would invent an enormous deceleration.
    let t = 100;
    let pct = 0.5;
    const at = (nextPct: number) => {
      t += 0.05;
      pct = nextPct;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    };

    for (let i = 0; i < 40; i++) at(pct + ((200 / 3.6) * 0.05) / 5000);
    at(0.05); // lifted to the pit lane
    for (let i = 0; i < 40; i++) at(0.05); // sitting in the box

    // A car left motionless on track is a sustained-slow incident in its own
    // right, which is correct. What must not happen is an impact reported from
    // measuring across the jump.
    expect(incidents.filter((i) => i.debug?.trigger === 'impact')).toEqual([]);
  });

  it('reports nothing until there is enough history to measure speed', () => {
    // A car that has just appeared - joining mid-race, or re-seeded after a
    // replay rewind - has no speed reading for its first half second and no
    // deceleration for its first full second. Nothing may be inferred from
    // that gap.
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    drive(detector, new Array(12).fill(200));

    expect(incidents).toEqual([]);
  });

  it('does not fire when cars are gridded after a practice/qualifying to race change', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Session time runs forward throughout: the pre-race session state is what
    // must suppress this, not a clock that appears to go backwards.
    let t = 100;
    let pct = 0.5;
    const frame = (sessionState: number, kmh: number) => {
      t += 0.05;
      pct += ((kmh / 3.6) * 0.05) / 5000;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: t,
          sessionState,
        }),
        5000
      );
    };

    // Circulating at speed near the end of the previous session.
    for (let i = 0; i < 40; i++) frame(SessionState.Racing, 225);

    // Changeover: iRacing lifts the car off the track and sets it down on the
    // grid. That is a jump in lapDistPct, not a drive, and it is followed by
    // the car sitting stationary - which read as a crash before.
    t += 0.05;
    pct = 0.9235;
    detector.processTelemetry(
      makeTelemetry({
        carIdxLapDistPct: [pct],
        sessionTime: t,
        sessionState: SessionState.GetInCar,
      }),
      5000
    );
    for (let i = 0; i < 40; i++) frame(SessionState.GetInCar, 0);

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });
});

describe('crash detection - off the racing surface', () => {
  it('fires Crash for a car that comes to rest in the gravel', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Runs wide onto the gravel, straddling the edge (surface flickers
    // OnTrack/OffTrack) while scrubbing speed off at a plausible rate, then
    // stays put. The old fixture dropped 75 km/h in one 0.05s frame - about
    // 115g - so it fired the impact detector, not the sustained-slow one this
    // test sits under.
    let pct = 0.806;
    let t = 479;
    const feedGravel = (surface: number, kmh: number) => {
      t += 0.05;
      pct += ((kmh / 3.6) * 0.05) / 20832;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [surface],
          sessionTime: t,
        }),
        20832
      );
    };

    for (let i = 0; i < 30; i++) feedGravel(TrackLocation.OnTrack, 90);
    // Straddling the edge as it runs wide, slowing at about 1.4g.
    const edge = [
      TrackLocation.OnTrack,
      TrackLocation.OffTrack,
      TrackLocation.OnTrack,
      TrackLocation.OffTrack,
      TrackLocation.OffTrack,
    ];
    let v = 90;
    for (let i = 0; i < 36; i++) {
      v = Math.max(0, v - 2.5);
      feedGravel(edge[Math.min(i, edge.length - 1)], v);
    }
    // Buried in the gravel against the barrier, not moving.
    for (let i = 0; i < 40; i++) feedGravel(TrackLocation.OffTrack, 0);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('sustained-slow');
  });

  it('does not fire Crash for a car stationary in its pit stall', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    let pct = 0.1;
    let t = 100;
    for (let i = 0; i < 10; i++) {
      pct += 0.0000005;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.InPitStall],
          sessionTime: t,
        }),
        20832
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });
});

describe('contact detection', () => {
  const twoCars = {
    // Without SessionInfo the detector cannot resolve the session type, which
    // silently disables sustained-slow for every test in this block.
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
    DriverInfo: {
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Driver A',
          CarNumber: '15',
          TeamName: '',
          CarIsPaceCar: 0,
        },
        {
          CarIdx: 1,
          UserName: 'Driver B',
          CarNumber: '23',
          TeamName: '',
          CarIsPaceCar: 0,
        },
      ],
    },
  };

  // Puts one car off the road at a given place and time. Surfaces are fed
  // one frame at a time so each car's debounce trips independently.
  //
  // Only safe for negative assertions or a single call: the idle car holds a
  // fixed position, so a second call at a different position makes it appear
  // to jump, which fabricates a speed spike and then a speed loss. Tests that
  // depend on speed should drive both cars continuously instead.
  const runOffTrack = (
    detector: IncidentDetector,
    carIdx: number,
    pct: number,
    startTime: number
  ) => {
    const surfaces = [TrackLocation.OnTrack, TrackLocation.OnTrack];
    const both = [TrackLocation.OnTrack, TrackLocation.OnTrack];
    // 2 on-track seed frames, then 3 off-track — enough elapsed time at this
    // step to clear offTrackDurationSeconds.
    for (let i = 0; i < 5; i++) {
      const s = i < 2 ? surfaces[i] : TrackLocation.OffTrack;
      const lap = [pct, pct];
      const surf = [...both];
      lap[carIdx] = pct + i * 0.00002;
      surf[carIdx] = s;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: lap,
          carIdxTrackSurface: surf,
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: startTime + i * 0.05,
        }),
        20832
      );
    }
  };

  it('upgrades an off-track to a Crash when another car is in trouble alongside', () => {
    // isDev so the debug snapshot (and its evidence string) is populated.
    const detector = new IncidentDetector(defaultThresholds, true);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Car A is hit and slows sharply; car B runs on and leaves the road ~2s
    // later, ~25m away — the spacing seen in the logged collision. Positions
    // advance every tick for both so no artificial speed spike is introduced.
    const FAST = 0.0000753; // ~113 km/h on a 20.8km track at 20Hz
    const pct = [0.5655, 0.5653];
    let t = 790;
    for (let i = 0; i < 30; i++) {
      // Car A is hit at tick 10 and loses most of its speed. Car B is
      // unaffected and keeps its pace, leaving the road shortly after.
      pct[0] += i < 10 ? FAST : FAST * 0.15;
      pct[1] += FAST;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct[0], pct[1]],
          carIdxTrackSurface: [
            i >= 12 && i <= 16 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
            i >= 20 && i <= 24 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
          ],
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: t,
        }),
        20832
      );
    }

    const forB = incidents.filter((i) => i.carIdx === 1);
    expect(forB.some((i) => i.type === IncidentType.Crash)).toBe(true);
    expect(
      forB.find((i) => i.type === IncidentType.Crash)?.debug?.evidence
    ).toContain('#15');
  });

  it('does not pair two cars that run wide at the same corner without losing speed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Both cars miss the apex at a steady ~113 km/h and carry straight on at
    // unchanged pace — close together and moments apart, but nobody was hit.
    // Positions advance every tick for both cars so no artificial speed spike
    // is introduced.
    const STEP = 0.0000753; // ~113 km/h on a 20.8km track at 20Hz
    const pct = [0.2263, 0.2255];
    let t = 329;
    for (let i = 0; i < 30; i++) {
      pct[0] += STEP;
      pct[1] += STEP;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct[0], pct[1]],
          carIdxTrackSurface: [
            i >= 10 && i <= 14 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
            i >= 18 && i <= 22 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
          ],
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: t,
        }),
        20832
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack).length
    ).toBe(2);
  });

  it('leaves a lone off-track as an OffTrack incident', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    runOffTrack(detector, 0, 0.5655, 790.5);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
    expect(incidents.some((i) => i.type === IncidentType.OffTrack)).toBe(true);
  });

  it('does not pair cars that go off far apart on track', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Same moment, but opposite sides of the circuit.
    runOffTrack(detector, 0, 0.1, 790.5);
    runOffTrack(detector, 1, 0.6, 790.6);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('does not pair cars whose incidents are far apart in time', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Same corner, but a lap apart.
    runOffTrack(detector, 0, 0.5655, 790.5);
    runOffTrack(detector, 1, 0.5658, 890.5);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });
});

describe('tick-rate independence', () => {
  // Drives a car onto pit road at a fixed frame rate and returns how much
  // session time passed between the first on-pit frame and the incident.
  const pitEntryDelayAtStep = (step: number) => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDurationSeconds: 0.5 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false], sessionTime: 100 }),
      5000
    );

    const entryStart = 100 + step;
    for (let n = 1; n <= Math.ceil(2 / step); n++) {
      const t = 100 + n * step;
      detector.processTelemetry(
        makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: t }),
        5000
      );
      if (incidents.length > 0) return t - entryStart;
    }
    throw new Error(`no pit entry reported at a ${step}s step`);
  };

  it('reports after the same elapsed time at 60Hz and at 10Hz', () => {
    // The reason durations are seconds rather than frames: a 3-frame debounce
    // means 0.05s at 60Hz but 0.3s at 10Hz, so the same setting behaved
    // differently as the tick rate moved under load.
    const fast = pitEntryDelayAtStep(1 / 60);
    const slow = pitEntryDelayAtStep(0.1);

    // Each reports on the first tick at or after the threshold, so the delay
    // lands within one tick of 0.5s at either rate.
    expect(fast).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(fast).toBeLessThan(0.5 + 1 / 60);
    expect(slow).toBeGreaterThanOrEqual(0.5 - 1e-9);
    expect(slow).toBeLessThan(0.5 + 0.1);
  });
});

describe('pit entry detection', () => {
  it('does not emit incidents for spectators', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession({
      ...raceSession(),
      DriverInfo: {
        Drivers: [
          {
            ...raceSession().DriverInfo.Drivers[0],
            IsSpectator: 1,
          },
        ],
      },
    });

    detector.processTelemetry(makeTelemetry(), 5000);
    for (let i = 0; i < 4; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 101 + i }),
        5000
      );
    }

    expect(incidents).toEqual([]);
  });

  it('fires PitEntry once the car has been on pit road for pitEntryDurationSeconds', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame (not on pit road)
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    expect(incidents).toHaveLength(0);

    // 2 frames on pit road — below debounce, should not fire yet
    for (let i = 0; i < 2; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [true],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents).toHaveLength(0);

    // 3rd consecutive frame — fires
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.12 }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.PitEntry);
  });

  it('does not fire PitEntry for a single-frame OnPitRoad blip', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed, then one blip on pit road, then back off
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.04 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false], sessionTime: 100.08 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(0);
  });
});

describe('off-track detection', () => {
  it('does not fire on first off-track frame', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // 1 off-track frame, debounce is 3 → no incident
    detector.processTelemetry(
      makeTelemetry({ carIdxTrackSurface: [TrackLocation.OffTrack] }),
      5000
    );
    expect(incidents).toHaveLength(0);
  });

  it('fires OffTrack once the car has been off the surface for offTrackDurationSeconds', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, offTrackDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame (on-track) so detector has prev state before we count
    // off-track frames for the debounce.
    detector.processTelemetry(
      makeTelemetry({
        carIdxTrackSurface: [TrackLocation.OnTrack],
        sessionTime: 100,
      }),
      5000
    );
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.OffTrack)).toBe(true);
  });
});

describe('debounce cooldown recovery', () => {
  it('emits a pit entry after cooldown even when its threshold frame was suppressed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());
    detector.processTelemetry(makeTelemetry(), 5000);

    // First visit clears the debounce and reports, starting the cooldown.
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.1 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.2 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(1);

    // Leaving pit road releases the latch.
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false], sessionTime: 101 }),
      5000
    );

    // Second visit clears the debounce while still inside the 5s cooldown, so
    // the frame that crosses the threshold is suppressed.
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 102 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 102.1 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(1);

    // The car is still on pit road, so it reports once the cooldown expires
    // rather than being lost with the suppressed frame.
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 106 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(2);
  });

  it('emits an off-track after cooldown even when its threshold frame was suppressed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());
    detector.processTelemetry(makeTelemetry(), 5000);

    // First excursion clears the debounce and reports, starting the cooldown.
    for (const t of [100.1, 100.2]) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        5000
      );
    }
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack)
    ).toHaveLength(1);

    // Back on the surface, releasing the latch.
    detector.processTelemetry(makeTelemetry({ sessionTime: 101 }), 5000);

    // Second excursion clears the debounce inside the 5s cooldown, so the
    // frame that crosses the threshold is suppressed.
    for (const t of [102, 102.1]) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        5000
      );
    }
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack)
    ).toHaveLength(1);

    // Still off the surface, so it reports once the cooldown expires.
    detector.processTelemetry(
      makeTelemetry({
        carIdxTrackSurface: [TrackLocation.OffTrack],
        sessionTime: 106,
      }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack)
    ).toHaveLength(2);
  });
});

describe('crash detection - sustained slow', () => {
  it('reports a stopped car once, not every time the cooldown lapses', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: 0.5 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Arrives off track under power, then sits for 30s — six times the 5s
    // cooldown. It has to arrive moving: a car that was never above the slow
    // threshold is parked, not stopped, and is deliberately not reported.
    let t = 100;
    let pct = 0.5;
    for (let n = 0; n < 40; n++) {
      t += 0.05;
      pct += ((120 / 3.6) * 0.05) / 5000;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        5000
      );
    }
    for (let n = 0; n < 600; n++) {
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        5000
      );
    }

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      1
    );
  });

  it('does not re-report a stopped car after a replay rewind reseeds it', () => {
    // Shorter cooldown keeps the timing robust; the latch is independent of it.
    const detector = new IncidentDetector(
      { ...defaultThresholds, cooldownSeconds: 1 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    let t = 100;
    let pct = 0.5;
    const tick = (kmh: number) => {
      pct += ((kmh / 3.6) * 0.05) / 5000;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        5000
      );
    };

    // Arrive under power, then a gentle stop (below the impact rate) so the
    // report comes from sustained-slow, not impact. Then sit past the cooldown.
    detector.processTelemetry(
      makeTelemetry({
        carIdxLapDistPct: [pct],
        carIdxTrackSurface: [TrackLocation.OffTrack],
        sessionTime: t,
      }),
      5000
    );
    for (const kmh of warmUp(200)) tick(kmh);
    for (const kmh of decelProfile(200, 0, 60)) tick(kmh);
    for (let i = 0; i < 40; i++) tick(0);

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      1
    );

    // Operator rewinds to review, then resumes. The processor drops the
    // replayed frames and reseeds from the next new one. recentPeakSpeed is
    // preserved, so the car is still "moving" for wasMoving; clearing the
    // slowReported latch here would report the same crash a second time.
    detector.reseedCarStates();
    for (let i = 0; i < 60; i++) tick(0);

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      1
    );
  });

  it('fires Crash after the car stays below the slow threshold for slowDurationSeconds', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Arrives at racing speed then crawls at 5 km/h, well under the 15 km/h
    // threshold. The first half second yields no reading at all while the
    // speed baseline fills.
    drive(detector, [
      ...warmUp(120),
      ...decelProfile(120, 5, 40),
      ...new Array(40).fill(5),
    ]);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('sustained-slow');
  });

  it('does not fire when the session clock is frozen (paused replay)', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // Replay paused: sessionTime and position both frozen. Previously this
    // produced a 0 km/h reading every tick and crashed the whole field.
    for (let i = 0; i < 10; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('does not report a car whose position updates slower than we poll', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // A remote car doing 60 km/h whose networked position refreshes every
    // third tick. The two stale ticks in between must not read as 0 km/h - if
    // they did, the car would be reported as stopped on track.
    let t = 100;
    let pct = 0.5;
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
      5000
    );
    for (let i = 1; i <= 60; i++) {
      t += 0.05;
      if (i % 3 === 0) pct += ((60 / 3.6) * 0.15) / 5000;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    }

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });

  it('does not read a sparse position update as a spike followed by a stop', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());

    // Same sparse refresh, but at racing speed. Measured frame to frame this
    // is the worst case: the refresh tick shows three ticks of travel in one,
    // and the two after it show none, which reads as a huge acceleration
    // followed by a huge deceleration. Across a baseline it is just 200 km/h.
    let t = 100;
    let pct = 0.2;
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
      5000
    );
    for (let i = 1; i <= 60; i++) {
      t += 0.05;
      if (i % 3 === 0) pct += ((200 / 3.6) * 0.15) / 5000;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    }

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });

  it('fires for a racing car that remains completely stationary', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());

    // Arrives on track then stops dead and never moves again. A repeated
    // position is treated as a stale feed rather than a stop until it has
    // held for a full second, so nothing is reported for the first part.
    let t = 100;
    let pct = 0.5;
    const roll = (kmh: number) => {
      t += 0.05;
      pct += ((kmh / 3.6) * 0.05) / 5000;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    };
    // Slowing gently enough that the impact detector has nothing to report.
    for (let i = 0; i < 30; i++) roll(120);
    for (const kmh of decelProfile(120, 0, 40)) roll(kmh);
    for (let i = 0; i < 60; i++) roll(0);

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('sustained-slow');
  });

  it('reports a car that stops on track during a qualifying run', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    // A Qualify session. Detection is not gated on session type, so a car
    // stopped out on track is reported here exactly as it would be in a race.
    detector.updateSession({
      SessionInfo: {
        Sessions: [{ SessionNum: 0, SessionType: 'Open Qualify' }],
      },
      DriverInfo: {
        Drivers: [
          {
            CarIdx: 0,
            UserName: 'Test',
            CarNumber: '99',
            TeamName: '',
            CarIsPaceCar: 0,
          },
        ],
      },
    });

    drive(
      detector,
      [...warmUp(90), ...decelProfile(90, 0, 30), ...new Array(40).fill(0)],
      {
        startTime: 251,
        startPct: 0.5265,
      }
    );

    const crashes = incidents.filter((i) => i.type === IncidentType.Crash);
    expect(crashes).toHaveLength(1);
    expect(crashes[0].debug?.trigger).toBe('sustained-slow');
  });

  it('does not fire while car is on pit road', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [true], // on pit road
          carIdxLapDistPct: [0.5 + i * 0.00001],
          sessionTime: 100 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });

  it('does not fire sustained-slow during formation/pace lap (pre-Racing state)', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame
    detector.processTelemetry(
      makeTelemetry({
        sessionState: SessionState.ParadeLaps,
        carIdxLapDistPct: [0.5],
        sessionTime: 100,
      }),
      5000
    );
    // 3 stationary frames — would fire if sessionState were Racing
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          sessionState: SessionState.ParadeLaps,
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [false],
          carIdxLapDistPct: [0.5 + (i + 1) * 0.00001],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });

  it('does not report a car that has never moved, such as one on the grid', () => {
    // Replaces a green-flag session-state gate. Cars sitting on a pre-race
    // grid must not each emit a crash, but the reason cannot be the session
    // state - that switched detection off in test drives and time trials too.
    // What actually distinguishes them is that they have never been moving.
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowDurationSeconds: SHORT_DEBOUNCE_S },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    let t = 100;
    for (let i = 0; i < 120; i++) {
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [0.5],
          sessionTime: t,
          sessionState: SessionState.ParadeLaps,
        }),
        5000
      );
    }

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toEqual([]);
  });
});

describe('dev mode debug snapshots', () => {
  const setupDetector = (isDev: boolean) => {
    const detector = new IncidentDetector(defaultThresholds, isDev);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());
    return { detector, incidents };
  };

  const triggerPitEntry = (detector: IncidentDetector, startTime = 100.04) => {
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [true],
          sessionTime: startTime + i * 0.04,
        }),
        5000
      );
    }
  };

  it('attaches debug snapshot when isDev=true', () => {
    const { detector, incidents } = setupDetector(true);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    triggerPitEntry(detector);
    const debug = incidents[0].debug;
    expect(debug).toBeDefined();
    expect(debug?.trigger).toBe('pit-entry');
    expect(debug?.evidence).toContain('Pit entry');
    expect(debug?.thresholds.slowSpeedThreshold).toBe(15);
    expect(debug?.frameHistory).toBeInstanceOf(Array);
  });

  it('still attaches the snapshot when isDev=false, minus the frame trace', () => {
    // The evidence behind a call is needed most in a packaged build, where a
    // false positive actually shows up. Only the per-frame trace, which costs
    // an object per car per frame to retain, stays development-only.
    const { detector, incidents } = setupDetector(false);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    triggerPitEntry(detector);
    const debug = incidents[0].debug;
    expect(debug).toBeDefined();
    expect(debug?.evidence).toContain('Pit entry');
    expect(debug?.thresholds.impactDecelKmhPerSec).toBe(150);
    expect(debug?.frameHistory).toEqual([]);
  });

  it('frameHistory keeps roughly 3 seconds of frames, capped', () => {
    const { detector, incidents } = setupDetector(true);
    // More frames than the cap, so the ceiling is what gets asserted rather
    // than however many happened to be produced.
    for (let i = 0; i < 80; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [false],
          sessionTime: 100 + i * 0.05,
          carIdxLapDistPct: [0.5 + i * 0.001],
        }),
        5000
      );
    }
    triggerPitEntry(detector, 104.5);
    expect(incidents[0].debug?.frameHistory.length).toBe(60);
  });

  it('frameHistory holds fewer frames than the cap early in a session', () => {
    const { detector, incidents } = setupDetector(true);
    for (let i = 0; i < 15; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [false],
          sessionTime: 100 + i * 0.05,
          carIdxLapDistPct: [0.5 + i * 0.001],
        }),
        5000
      );
    }
    triggerPitEntry(detector, 100.8);
    const len = incidents[0].debug?.frameHistory.length ?? 0;
    expect(len).toBeGreaterThan(0);
    expect(len).toBeLessThan(60);
  });
});

describe('flag detection', () => {
  it('fires BlackFlag when Black flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Black flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Black],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.BlackFlag);
  });

  it('fires BlackFlag when Disqualify flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Disqualify flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Disqualify],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.BlackFlag);
  });

  it('fires Slowdown when Furled flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Furled flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Furled],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.Slowdown);
  });
});
