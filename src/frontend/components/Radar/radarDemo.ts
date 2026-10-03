import { rivalFill, textColorFor, type RivalColorSource } from './radarColors';
import type { RadarCarAppearance, RadarFrame } from './components/RadarDisplay';
import type { CarSize } from '@irdashies/domain/radar/carSizes';
import type { RadarConfig } from '@irdashies/types';

/**
 * A scripted pack for demo mode and stories: one car dives up the left
 * while we brake, sits alongside and drops back, one drops back on the
 * right, two run nose to tail ahead, and a wreck sits by the road ahead
 * that we come up on and pass.
 */
const DEMO_SPEED_MS = 40;
const DEMO_CYCLE_S = 12;

/** The diving car: where it is and how fast it closes, at `t` seconds. */
const diver = (t: number) => {
  // Closes hard from far back, pulls out to the left and brakes level.
  if (t < 3) return { dist: -28 + 8 * t, closing: 8 };
  if (t < 8) return { dist: -4 + 1.2 * (t - 3), closing: 1.2 };
  return { dist: 2 - 7.5 * (t - 8), closing: -7.5 };
};

/** Metres ahead the wreck is when each cycle starts. */
const WRECK_START_M = 320;
/** The wreck joins the cars once it is this close. */
const WRECK_ON_DISC_M = 45;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export const demoRadarFrame = (seconds: number): RadarFrame => {
  const t = seconds % DEMO_CYCLE_S;
  const cycle = t / DEMO_CYCLE_S;
  const wave = Math.sin(cycle * Math.PI * 2);
  const dive = diver(t);
  // Moves out to the left once it is close, back in once it falls away.
  const diverLane =
    t < 8 ? -clamp01((dive.dist + 12) / 3) : -clamp01((dive.dist + 14) / 4);
  const wreckDist = WRECK_START_M - DEMO_SPEED_MS * t;
  const wreck = {
    carIdx: 5,
    dist: wreckDist,
    closingSpeed: -DEMO_SPEED_MS,
    lane: 2,
    offTrack: false,
  };
  return {
    playerPct: 0,
    // Moving, so the dashes of the line ahead run past as on track.
    playerSpeed: DEMO_SPEED_MS,
    trackLength: 0,
    // Braking for a corner while the diver comes in.
    focusBrake: t > 1.5 && t < 4.5 ? 0.8 : 0,
    cars: [
      {
        carIdx: 1,
        dist: dive.dist,
        closingSpeed: dive.closing,
        lane: diverLane,
        offTrack: false,
      },
      {
        carIdx: 2,
        dist: 3 - wave * 12,
        closingSpeed: 0,
        lane: 1,
        offTrack: false,
      },
      {
        carIdx: 3,
        dist: 16 + wave * 2,
        closingSpeed: 0,
        lane: 0,
        offTrack: false,
      },
      {
        carIdx: 4,
        dist: 23 + wave * 2,
        closingSpeed: 0,
        lane: 0,
        offTrack: false,
      },
      ...(wreckDist <= WRECK_ON_DISC_M && wreckDist > -WRECK_ON_DISC_M
        ? [wreck]
        : []),
    ],
    hazards:
      wreckDist > -20
        ? [{ carIdx: 5, dist: wreckDist, kind: 'crash', speed: 0 }]
        : [],
  };
};

export const DEMO_LABELS: Readonly<Record<number, string>> = {
  1: '7',
  2: '24',
  3: '3',
  4: '88',
  5: '42',
};

/** Made-up licences and classes so every colour mode has something to show. */
export const DEMO_RIVALS: Readonly<Record<number, RivalColorSource>> = {
  1: { license: 'A 3.12', rating: 2400, classColor: '#ffda59' },
  2: { license: 'B 2.45', rating: 1800, classColor: '#33ceff' },
  3: { license: 'C 3.80', rating: 1500, classColor: '#ffda59' },
  4: { license: 'D 1.90', rating: 1100, classColor: '#33ceff' },
  5: { license: 'R 2.50', rating: 900, classColor: '#ffda59' },
};

/** How the demo pack looks under the current colour settings. */
export const demoAppearance = (
  colorMode: RadarConfig['rivalColorMode'],
  customFill: string,
  size: CarSize
): Map<number, RadarCarAppearance> => {
  const map = new Map<number, RadarCarAppearance>();
  for (const [carIdx, label] of Object.entries(DEMO_LABELS)) {
    const fill = rivalFill(colorMode, customFill, DEMO_RIVALS[+carIdx]);
    map.set(Number(carIdx), {
      fill,
      textColor: textColorFor(fill),
      label,
      length: size.length,
      width: size.width,
    });
  }
  return map;
};
