import { rivalFill, textColorFor, type RivalColorSource } from './radarColors';
import type { RadarCarAppearance, RadarFrame } from './components/RadarDisplay';
import type { CarSize } from '@irdashies/domain/radar/carSizes';
import type { RadarConfig } from '@irdashies/types';

/**
 * A scripted pack for demo mode and stories: one car slides up the left,
 * one drops back on the right, and two run nose to tail ahead.
 */
const DEMO_SPEED_MS = 40;

export const demoRadarFrame = (seconds: number): RadarFrame => {
  const cycle = (seconds % 12) / 12;
  const wave = Math.sin(cycle * Math.PI * 2);
  return {
    playerPct: 0,
    // Moving, so the dashes of the line ahead run past as on track.
    playerSpeed: DEMO_SPEED_MS,
    trackLength: 0,
    cars: [
      {
        carIdx: 1,
        dist: -22 + cycle * 30,
        closingSpeed: 0,
        lane: -1,
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
    ],
  };
};

export const DEMO_LABELS: Readonly<Record<number, string>> = {
  1: '7',
  2: '24',
  3: '3',
  4: '88',
};

/** Made-up licences and classes so every colour mode has something to show. */
export const DEMO_RIVALS: Readonly<Record<number, RivalColorSource>> = {
  1: { license: 'A 3.12', rating: 2400, classColor: '#ffda59' },
  2: { license: 'B 2.45', rating: 1800, classColor: '#33ceff' },
  3: { license: 'C 3.80', rating: 1500, classColor: '#ffda59' },
  4: { license: 'D 1.90', rating: 1100, classColor: '#33ceff' },
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
