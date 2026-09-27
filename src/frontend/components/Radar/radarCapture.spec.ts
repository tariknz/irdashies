import { describe, expect, it } from 'vitest';
import type { RadarSnapshot } from '@irdashies/types';
import tracks from '../../assets/data/tracks.json';
import type { TrackDrawing } from '@irdashies/domain/trackGeometry';
import {
  computeRadarBlips,
  emptyTargetState,
  type RadarBlip,
} from './radarBlips';
import { overlapFromCarLeftRight } from './overlapSides';
import interlagosLeft from '../../../../test-data/1747384033336/telemetry.json';
import interlagosLeftSession from '../../../../test-data/1747384033336/session.json';
import interlagos from '../../../../test-data/1752616787256/telemetry.json';
import interlagosSession from '../../../../test-data/1752616787256/session.json';
import brands from '../../../../test-data/1731663749009/telemetry.json';
import brandsSession from '../../../../test-data/1731663749009/session.json';
import watkins from '../../../../test-data/1781323503005/telemetry.json';
import watkinsSession from '../../../../test-data/1781323503005/session.json';
import paulRicard from '../../../../test-data/1763227688917/telemetry.json';
import paulRicardSession from '../../../../test-data/1763227688917/session.json';

/**
 * The radar's placement, checked against recordings rather than against its own
 * arithmetic. iRacing publishes no per-car world position, so lap distance is
 * the only geometry there is — but the sim *does* publish its own distance to
 * the car ahead and behind the player (`CarDistAhead`/`CarDistBehind`), and
 * that is an independent oracle for exactly the quantity the radar draws.
 *
 * A capture is one frame, which is what a placement assertion needs: the
 * recorded `CarIdxLapDistPct`, the recorded `CarLeftRight` verdict and the
 * recorded oracle distances all describe the same instant.
 */

const trackDrawings = tracks as unknown as Record<
  number,
  TrackDrawing | undefined
>;

const trackLengthOf = (session: { WeekendInfo: { TrackLength: string } }) => {
  const match = /([\d.]+)\s*(km|mi)?/.exec(session.WeekendInfo.TrackLength);
  if (!match) throw new Error('capture has no parsable track length');
  if (match[2] === 'km') return Number(match[1]) * 1000;
  if (match[2] === 'mi') return Number(match[1]) * 1609.344;
  return Number(match[1]);
};

interface Capture {
  name: string;
  telemetry: Record<string, { value: unknown[] }>;
  session: {
    Type: string;
    WeekendInfo: { TrackID: number; TrackLength: string };
    DriverInfo: { DriverCarIdx: number };
  };
}

const place = (capture: Capture) => {
  const { telemetry, session } = capture;
  const snapshot: RadarSnapshot = {
    carIdxLapDistPct: (telemetry.CarIdxLapDistPct?.value ?? []) as number[],
    carIdxOnPitRoad: (telemetry.CarIdxOnPitRoad?.value ?? []) as boolean[],
    focusCarIdx:
      (telemetry.CamCarIdx?.value?.[0] as number | undefined) ?? null,
    carSpeed: 0,
    isOnTrack: true,
    version: 0,
  };

  const result = computeRadarBlips({
    carIdxLapDistPct: snapshot.carIdxLapDistPct,
    carIdxOnPitRoad: snapshot.carIdxOnPitRoad,
    playerCarIdx: snapshot.focusCarIdx,
    trackDrawing: trackDrawings[session.WeekendInfo.TrackID],
    trackLengthM: trackLengthOf(session),
    radarRange: 15,
    hideInPit: true,
    overlap: overlapFromCarLeftRight(
      (telemetry.CarLeftRight?.value?.[0] as number) ?? 0
    ),
    vehicleWidth: 1.9,
    vehicleLength: 4.5,
    fadeBandM: 3,
    carNumbers: new Map(),
    paceCarIdx: null,
    previousTargets: emptyTargetState(snapshot.carIdxLapDistPct.length),
    nextTargets: emptyTargetState(snapshot.carIdxLapDistPct.length),
    followingMapBuffer: new Float64Array(128),
  });

  const scalar = (key: string) => telemetry[key]?.value?.[0] as number;
  return {
    blips: result.blips,
    hasGeometry: result.hasGeometry,
    playerOnRoad: result.playerOnRoad,
    simAheadM: scalar('CarDistAhead'),
    simBehindM: scalar('CarDistBehind'),
    playerCarIdx: session.DriverInfo.DriverCarIdx,
  };
};

const nearest = (blips: readonly RadarBlip[], sign: 1 | -1) =>
  blips
    .filter((blip) => Math.sign(blip.alongM) === sign)
    .sort((a, b) => a.gapM - b.gapM)[0];

const CAPTURES: Capture[] = [
  {
    name: 'Interlagos, a lap-up car closing',
    telemetry: interlagosLeft as never,
    session: interlagosLeftSession as never,
  },
  {
    name: 'Interlagos, a car just ahead',
    telemetry: interlagos as never,
    session: interlagosSession as never,
  },
  {
    name: 'Brands Hatch, one each way',
    telemetry: brands as never,
    session: brandsSession as never,
  },
  {
    name: 'Watkins Glen, a car alongside',
    telemetry: watkins as never,
    session: watkinsSession as never,
  },
  {
    name: 'Paul Ricard, a car ahead',
    telemetry: paulRicard as never,
    session: paulRicardSession as never,
  },
];

describe('radar placement over recorded telemetry', () => {
  for (const capture of CAPTURES) {
    it(`puts the nearest cars where the sim does — ${capture.name}`, () => {
      const placed = place(capture);
      expect(placed.hasGeometry).toBe(true);
      expect(placed.playerOnRoad).toBe(true);

      // The sim's own distances describe the nearest car each way. It publishes
      // a sentinel when there is nothing within half a kilometre, so a usable
      // distance inside the range must come back as a blip at that distance —
      // and one behind the player must come back negative, which is the case a
      // missing lap wrap gets wrong by a whole lap.
      const withinRange = (metres: number) =>
        Number.isFinite(metres) && metres >= 0 && metres <= 15;
      if (withinRange(placed.simAheadM))
        expect(nearest(placed.blips, 1)?.alongM).toBeCloseTo(
          placed.simAheadM,
          1
        );
      if (withinRange(placed.simBehindM))
        expect(nearest(placed.blips, -1)?.alongM).toBeCloseTo(
          -placed.simBehindM,
          1
        );

      for (const blip of placed.blips) {
        expect(blip.gapM).toBeCloseTo(Math.abs(blip.alongM), 6);
        expect(Math.abs(blip.alongM)).toBeLessThanOrEqual(15);
      }
    });
  }

  it('marks a level car the sim stayed silent about, on a recorded frame', () => {
    // Watkins Glen, recorded: car 17 is two millimetres from the player's own
    // lap distance with both on track, and CarLeftRight reads Clear — the sim
    // never calls it. A car cannot share that point of the road, so it is
    // beside the player, and only the side is unknown. This is the recorded
    // shape of "cars pass through me".
    const placed = place(CAPTURES[3]);
    const level = placed.blips.filter((blip) => blip.gapM <= 1);
    expect(level).toHaveLength(1);
    const [beside] = level;
    expect(beside.carIdx).toBe(17);
    expect(beside.side).toBeNull();
    expect(beside.rimSignal).toBe('both');
    // The car behind it, ten metres back in its own lane, is not beside us.
    const behind = placed.blips.find((blip) => blip.carIdx === 19);
    expect(behind?.rimSignal).toBeNull();
  });

  it('does not mark cars the sim did call, nor cars in their own lane', () => {
    // Interlagos with CarLeftRight = CarLeft: the sim named the side, so the
    // car is placed, not flagged as unknown.
    const placed = place(CAPTURES[0]);
    expect(placed.blips[0].side).toBe(-1);
    expect(placed.blips[0].rimSignal).toBeNull();
  });

  it('draws a car the sim reports alongside on that side, clear of the player', () => {
    // Interlagos with CarLeftRight = CarLeft: the car sits 4.6 m back on the
    // same centreline, so without the verdict it would be painted through the
    // player's own rectangle.
    const placed = place(CAPTURES[0]);
    expect(placed.blips).toHaveLength(1);
    const [alongside] = placed.blips;
    expect(alongside.side).toBe(-1);
    expect(alongside.lateralM).toBeLessThan(0);
    // One car width plus a margin, so the two bodies do not overlap.
    expect(Math.abs(alongside.lateralM)).toBeGreaterThan(1.9);
  });
});
